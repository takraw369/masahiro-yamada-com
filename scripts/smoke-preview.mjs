import assert from 'node:assert/strict';
import { once } from 'node:events';
import { createServer as createHttpServer } from 'node:http';
import { createServer as createNetServer } from 'node:net';
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
const validPassword = 'preview-password-123';
const resetPassword = 'preview-reset-password-456';
const resetBodies = [];

const supabaseStub = createHttpServer(async (request, response) => {
  try {
    if (request.headers.apikey !== publishableKey) {
      json(response, 401, { error: 'bad_apikey' });
      return;
    }

    const url = new URL(request.url || '/', stubBase);
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
  child = await startPreview(port, {
    SUPABASE_URL: stubBase,
    SUPABASE_PUBLISHABLE_KEY: publishableKey,
    DASHBOARD_PASSWORD: sessionKey,
  });
  child.stdout.on('data', (chunk) => { logs = (logs + chunk).slice(-12000); });
  child.stderr.on('data', (chunk) => { logs = (logs + chunk).slice(-12000); });
  child.on('error', (error) => { startupError = error; });

  let ready = false;
  for (let attempt = 0; attempt < 120; attempt++) {
    if (startupError) throw startupError;
    if (child.exitCode !== null || child.signalCode !== null) throw new Error(`Worker exited: ${child.exitCode ?? child.signalCode}. ${logs}`);
    try {
      const res = await previewFetch(base);
      await res.arrayBuffer();
      ready = true;
      break;
    } catch {}
    await new Promise((resolve) => setTimeout(resolve, 200));
  }
  assert.ok(ready, logs || 'Worker preview did not answer the readiness probe within the bounded startup window.');

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

  const dashboard = await previewFetch(base + '/dashboard', { redirect: 'manual' });
  assert.equal(dashboard.status, 302);
  assert.equal(dashboard.headers.get('location'), '/dashboard/login');
  assert.match(dashboard.headers.get('cache-control'), /no-store/);

  for (const path of ['/api/dashboard/state', '/api/dashboard/voice', '/api/x-harness/x-accounts', '/api/line-harness/line-accounts']) {
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

  for (const path of ['/dashboard/lian', '/dashboard/funnel', '/dashboard/schedule', '/dashboard/voice']) {
    const res = await previewFetch(base + path, { redirect: 'manual', headers: { Cookie: googleCookie } });
    assert.equal(res.status, 200, path);
    assert.match(res.headers.get('cache-control'), /no-store/, path);
    assert.match(res.headers.get('set-cookie'), /ace-dash-auth=v2\./, path);
    const html = await res.text();
    assert.ok(html.includes('<html'), path);
    if (path === '/dashboard/lian') assert.ok(html.includes('LINE Control Plane'));
    if (path === '/dashboard/funnel') assert.ok(html.includes('現在の集計ではありません'));
  }

  const passwordLogin = await previewFetch(base + '/dashboard/login', {
    method: 'POST',
    headers: {
      Origin: base,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({ password: validPassword }),
    redirect: 'manual',
  });
  assert.equal(passwordLogin.status, 302);
  assert.equal(passwordLogin.headers.get('location'), '/dashboard');
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

  const csrf = await previewFetch(base + '/api/x-harness/posts', {
    method: 'POST',
    headers: { Origin: 'https://other.example.test' },
  });
  assert.equal(csrf.status, 403);

  console.log('Worker preview smoke passed: public routes, auth boundaries, Google-admin session, password login and recovery contract.');
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
}
