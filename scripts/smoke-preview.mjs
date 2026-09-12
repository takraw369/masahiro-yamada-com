import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import { once } from 'node:events';
import { createServer as createHttpServer } from 'node:http';
import { createServer as createNetServer } from 'node:net';
import { createLineFixture, smokeLineObservability } from './smoke-line-observability.mjs';
import { startPreview } from './local-preview.mjs';

async function freePort() {
  const server = createNetServer();
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const port = server.address().port;
  server.close();
  await once(server, 'close');
  return port;
}

async function requestBody(request) {
  let body = '';
  for await (const chunk of request) body += chunk;
  return body;
}

function json(response, status, body) {
  response.writeHead(status, { 'Content-Type': 'application/json' });
  response.end(JSON.stringify(body));
}

function cookieFrom(response) {
  const setCookie = response.headers.get('set-cookie') || '';
  assert.match(setCookie, /ace-dash-auth=/);
  assert.match(setCookie, /HttpOnly/i);
  return setCookie.split(';', 1)[0];
}

const port = await freePort();
const stubPort = await freePort();
const base = `http://127.0.0.1:${port}`;
const stubBase = `http://127.0.0.1:${stubPort}`;
const publishableKey = 'preview-publishable-key';
const sessionKey = 'preview-only-session-key-32chars';
const ownerKey = createHmac('sha256', sessionKey).update('masahiro-yamada.com:dashboard-storage-owner:v1').digest('hex');
const calendarSyncSecret = 'calendar-preview-bearer';
const validPassword = 'preview-password-123';
const resetPassword = 'preview-reset-password-456';
const fixture = await createLineFixture(sessionKey);
const resetBodies = [];
const calendarReplaceBodies = [];

const calendarEvent = {
  event_id: 'preview-event-1',
  title: 'Preview Calendar Event',
  start_at: new Date(Date.now() + 3600000).toISOString(),
  end_at: new Date(Date.now() + 7200000).toISOString(),
  all_day: false,
  location: 'Preview Room',
};

const supabaseStub = createHttpServer(async (request, response) => {
  try {
    if (request.headers.apikey !== publishableKey) {
      json(response, 401, { error: 'bad_apikey' });
      return;
    }

    const url = new URL(request.url || '/', stubBase);
    if (request.method === 'POST' && url.pathname === '/rest/v1/rpc/masa_line_control_snapshot') {
      const result = await fetch(fixture.vars.SUPABASE_URL + url.pathname, {
        method: 'POST', body: await requestBody(request),
      });
      json(response, result.status, await result.json());
      return;
    }

    const authorization = request.headers.authorization || '';
    const isAdmin = authorization === 'Bearer admin-token';
    const isKnownUser = isAdmin || authorization === 'Bearer non-admin-token';

    if (request.method === 'GET' && url.pathname === '/auth/v1/user') {
      if (!isKnownUser) {
        json(response, 401, { error: 'invalid_token' });
        return;
      }
      json(response, 200, { id: isAdmin ? 'admin-user' : 'non-admin-user' });
      return;
    }

    if (request.method === 'POST' && url.pathname === '/rest/v1/rpc/is_dashboard_admin') {
      json(response, 200, isAdmin);
      return;
    }

    if (request.method === 'POST' && url.pathname === '/rest/v1/rpc/reset_dashboard_login_password') {
      if (!isAdmin) {
        json(response, 403, { error: 'admin_required' });
        return;
      }
      const body = JSON.parse((await requestBody(request)) || '{}');
      resetBodies.push(body);
      json(response, 200, true);
      return;
    }

    if (request.method === 'POST' && url.pathname === '/rest/v1/rpc/verify_dashboard_login_password') {
      const body = JSON.parse((await requestBody(request)) || '{}');
      json(response, 200, body.p_password === validPassword);
      return;
    }

    if (request.method === 'POST' && url.pathname === '/rest/v1/rpc/masa_calendar_snapshot_get_v2') {
      assert.equal(JSON.parse(await requestBody(request)).p_owner_key, ownerKey);
      json(response, 200, [calendarEvent]);
      return;
    }

    if (request.method === 'POST' && url.pathname === '/rest/v1/rpc/masa_calendar_sync_status_v2') {
      assert.equal(JSON.parse(await requestBody(request)).p_owner_key, ownerKey);
      json(response, 200, [{
        synced_at: new Date().toISOString(),
        source_synced_at: new Date(Date.now() - 1000).toISOString(),
        window_start: '2026-09-08T00:00:00.000Z',
        window_end: '2026-10-08T00:00:00.000Z',
        event_count: 1,
      }]);
      return;
    }

    if (request.method === 'POST' && url.pathname === '/rest/v1/rpc/masa_calendar_snapshot_replace_v2') {
      const body = JSON.parse((await requestBody(request)) || '{}');
      assert.equal(body.p_owner_key, ownerKey);
      calendarReplaceBodies.push(body);
      json(response, 200, 1);
      return;
    }

    json(response, 404, { error: 'not_found' });
  } catch (error) {
    json(response, 500, { error: String(error) });
  }
});

supabaseStub.listen(stubPort, '127.0.0.1');
await once(supabaseStub, 'listening');

let child;
let logs = '';
let startupError;

const previewFetch = (url, init = {}) => fetch(url, {
  ...init,
  signal: AbortSignal.timeout(1500),
});

try {
  child = await startPreview(port, { vars: {
    SUPABASE_URL: stubBase,
    SUPABASE_PUBLISHABLE_KEY: publishableKey,
    DASHBOARD_PASSWORD: sessionKey,
    CALENDAR_SYNC_SECRET: calendarSyncSecret,
  } });
  child.stdout.on('data', (chunk) => { logs = (logs + chunk).slice(-12000); });
  child.stderr.on('data', (chunk) => { logs = (logs + chunk).slice(-12000); });
  child.on('error', (error) => { startupError = error; });

  let ready = false;
  for (let attempt = 0; attempt < 120; attempt++) {
    if (startupError) throw startupError;
    if (child.exitCode !== null || child.signalCode !== null) throw new Error(logs);
    try {
      const res = await previewFetch(base);
      await res.arrayBuffer();
      ready = true;
      break;
    } catch {}
    await new Promise((resolve) => setTimeout(resolve, 200));
  }
  assert.ok(ready, logs || 'Worker preview did not answer the readiness probe within the bounded startup window.');

  await smokeLineObservability(base, fixture);

  for (const path of ['/', '/contact', '/faq', '/tips', '/library', '/gate']) {
    const res = await previewFetch(base + path);
    assert.equal(res.status, 200, path);
    assert.match(res.headers.get('content-type'), /text\/html/, path);
    assert.ok((await res.text()).includes('<html'), path);
  }

  const loginPage = await previewFetch(base + '/dashboard/login');
  assert.equal(loginPage.status, 200);
  const loginHtml = await loginPage.text();
  assert.ok(loginHtml.includes('<html'));
  assert.ok(loginHtml.includes('Googleでログイン'));
  assert.ok(loginHtml.includes('/auth/v1/authorize'));
  assert.ok(loginHtml.includes('/api/dashboard/google-login'));
  assert.ok(loginHtml.includes('/api/dashboard/reset-password'));

  for (const path of ['/dashboard', '/dashboard/schedule', '/dashboard/content-schedule']) {
    const response = await previewFetch(base + path, { redirect: 'manual' });
    assert.equal(response.status, 302, path);
    assert.equal(response.headers.get('location'), '/dashboard/login', path);
    assert.match(response.headers.get('cache-control'), /no-store/, path);
  }

  for (const path of ['/api/dashboard/state', '/api/dashboard/voice', '/api/dashboard/calendar', '/api/x-harness/x-accounts', '/api/line-harness/line-accounts']) {
    const res = await previewFetch(base + path);
    assert.equal(res.status, 401, path);
    assert.match(res.headers.get('cache-control'), /no-store/);
  }

  // Bootstrap routes must remain reachable without accepting missing auth.
  for (const path of ['/api/dashboard/google-login', '/api/dashboard/reset-password']) {
    const res = await previewFetch(base + path, { method: 'POST', headers: { Origin: base } });
    assert.equal(res.status, 401);
    assert.equal((await res.json()).error, 'missing_access_token');
  }

  const deniedGoogle = await previewFetch(base + '/api/dashboard/google-login', {
    method: 'POST',
    headers: { Origin: base, Authorization: 'Bearer non-admin-token' },
  });
  assert.equal(deniedGoogle.status, 403);
  assert.equal((await deniedGoogle.json()).error, 'dashboard_admin_required');

  const googleLogin = await previewFetch(base + '/api/dashboard/google-login', {
    method: 'POST',
    headers: { Origin: base, Authorization: 'Bearer admin-token' },
  });
  assert.equal(googleLogin.status, 200);
  assert.equal((await googleLogin.json()).ok, true);
  const googleCookie = cookieFrom(googleLogin);

  const googleDashboard = await previewFetch(base + '/dashboard', {
    headers: { Cookie: googleCookie },
    redirect: 'manual',
  });
  assert.equal(googleDashboard.status, 200);
  assert.match(googleDashboard.headers.get('content-type'), /text\/html/);

  const schedulePage = await previewFetch(base + '/dashboard/schedule', {
    headers: { Cookie: googleCookie },
    redirect: 'manual',
  });
  assert.equal(schedulePage.status, 200);
  assert.match(schedulePage.headers.get('content-type'), /text\/html/);
  assert.match(await schedulePage.text(), /PersonalSchedule/);
  for (const path of ['/dashboard/content-schedule', '/dashboard/lian', '/dashboard/funnel', '/dashboard/voice', '/dashboard/intelligence']) {
    const response = await previewFetch(base + path, { headers: { Cookie: googleCookie } });
    assert.equal(response.status, 200, path);
    assert.match(response.headers.get('cache-control'), /no-store/);
    await response.arrayBuffer();
  }

  const calendarRead = await previewFetch(base + '/api/dashboard/calendar', {
    headers: { Cookie: googleCookie },
  });
  assert.equal(calendarRead.status, 200);
  const calendarReadBody = await calendarRead.json();
  assert.equal(calendarReadBody.ok, true);
  assert.deepEqual(calendarReadBody.events, [calendarEvent]);
  assert.equal(calendarReadBody.sync.event_count, 1);

  const passwordLogin = await previewFetch(base + '/api/dashboard/password-login', {
    method: 'POST',
    headers: {
      Origin: base,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ password: validPassword }),
    redirect: 'manual',
  });
  assert.equal(passwordLogin.status, 200);
  assert.equal((await passwordLogin.json()).ok, true);
  const passwordCookie = cookieFrom(passwordLogin);
  const passwordDashboard = await previewFetch(base + '/dashboard', {
    headers: { Cookie: passwordCookie },
    redirect: 'manual',
  });
  assert.equal(passwordDashboard.status, 200);

  const reset = await previewFetch(base + '/api/dashboard/reset-password', {
    method: 'POST',
    headers: {
      Origin: base,
      Authorization: 'Bearer admin-token',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ password: resetPassword }),
  });
  assert.equal(reset.status, 200);
  assert.equal((await reset.json()).ok, true);
  assert.deepEqual(resetBodies, [{ p_new_password: resetPassword }]);
  const resetCookie = cookieFrom(reset);
  const resetDashboard = await previewFetch(base + '/dashboard', {
    headers: { Cookie: resetCookie },
    redirect: 'manual',
  });
  assert.equal(resetDashboard.status, 200);

  // Calendar ingestion is deliberately outside browser Origin/session middleware.
  // Its own Bearer secret must reject unauthenticated callers and accept Apps Script-style POSTs.
  const calendarUnauthorized = await previewFetch(base + '/api/dashboard/calendar/sync', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: '{}',
  });
  assert.equal(calendarUnauthorized.status, 401);
  assert.equal(calendarUnauthorized.headers.get('referrer-policy'), 'no-referrer');
  assert.equal((await calendarUnauthorized.json()).error, 'unauthorized');

  const sourceSyncedAt = new Date().toISOString();
  const windowStart = new Date(Date.now() - 60 * 60 * 1000).toISOString();
  const windowEnd = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
  const syncPayload = {
    source_synced_at: sourceSyncedAt,
    window_start: windowStart,
    window_end: windowEnd,
    events: [{
      event_id: calendarEvent.event_id,
      calendar_id: 'primary',
      title: calendarEvent.title,
      start_at: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
      end_at: new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString(),
      all_day: false,
      location: calendarEvent.location,
    }],
  };
  const calendarSync = await previewFetch(base + '/api/dashboard/calendar/sync', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${calendarSyncSecret}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(syncPayload),
  });
  assert.equal(calendarSync.status, 200);
  assert.deepEqual(await calendarSync.json(), { ok: true, event_count: 1 });
  assert.equal(calendarReplaceBodies.length, 1);
  assert.equal(calendarReplaceBodies[0].p_source_synced_at, sourceSyncedAt);
  assert.equal(calendarReplaceBodies[0].p_events[0].event_id, calendarEvent.event_id);

  const csrf = await previewFetch(base + '/api/x-harness/posts', {
    method: 'POST',
    headers: { Origin: 'https://other.example.test' },
  });
  assert.equal(csrf.status, 403);

  console.log('Worker preview smoke passed: public routes, auth/recovery, private Calendar read and Bearer Calendar sync contract.');
} catch (error) {
  console.error(logs);
  throw error;
} finally {
  if (child) {
    child.kill('SIGTERM');
    await Promise.race([once(child, 'exit'), new Promise((resolve) => setTimeout(resolve, 3000))]);
    if (child.exitCode === null) child.kill('SIGKILL');
  }
  supabaseStub.close();
  await once(supabaseStub, 'close');
  await fixture.close();
}
