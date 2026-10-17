import assert from 'node:assert/strict';
import { once } from 'node:events';
import { createServer } from 'node:net';
import { createLineFixture, smokeLineObservability } from './smoke-line-observability.mjs';
import { startPreview } from './local-preview.mjs';
import { createNoteFixture, smokeNoteHarness } from './smoke-note-harness.mjs';

const server = createServer();
server.listen(0, '127.0.0.1');
await once(server, 'listening');
const port = server.address().port;
server.close();
await once(server, 'close');
const base = `http://127.0.0.1:${port}`;
const fixture = await createLineFixture();
const noteFixture = await createNoteFixture(fixture);
const child = await startPreview(port, { vars: noteFixture.vars }).catch(async (error) => { await noteFixture.close(); await fixture.close(); throw error; });
let logs = '';
let startupError;
child.stdout.on('data', (chunk) => { logs = (logs + chunk).slice(-12000); });
child.stderr.on('data', (chunk) => { logs = (logs + chunk).slice(-12000); });
child.on('error', (error) => { startupError = error; });

const previewFetch = (url, init = {}) => fetch(url, {
  ...init,
  signal: AbortSignal.timeout(1000),
});

try {
  let ready = false;
  for (let attempt = 0; attempt < 30; attempt++) {
    if (startupError) throw startupError;
    if (child.exitCode !== null) throw new Error(logs);
    try {
      const res = await previewFetch(base);
      await res.arrayBuffer();
      ready = true;
      break;
    } catch {}
    await new Promise((resolve) => setTimeout(resolve, 200));
  }
  assert.ok(ready, logs || 'Worker preview did not answer the readiness probe within the bounded startup window.');
  for (const path of ['/', '/contact', '/faq', '/tips', '/library', '/gate', '/mental-check', '/trinity', '/library/entry-toolkit', '/dashboard/login']) {
    const res = await previewFetch(base + path);
    assert.equal(res.status, 200, path);
    assert.match(res.headers.get('content-type'), /text\/html/, path);
    assert.ok((await res.text()).includes('<html'), path);
  }
  // GEO foundation: the public llms.txt must be served by the Worker with
  // an explicit UTF-8 charset, not merely by a static _headers assertion.
  const llmsResponse = await previewFetch(base + '/llms.txt');
  assert.equal(llmsResponse.status, 200, '/llms.txt must be public');
  assert.match(llmsResponse.headers.get('content-type') || '', /^text\/plain;\s*charset=utf-8/i);
  assert.ok((await llmsResponse.text()).startsWith('# MASA / 山田昌寛 — ACE METHOD\n'));

  // Revenue entrance (Issue #215): verify actual rendered Worker HTML, not only source text.
  // The isolated preview has no production Supabase/LINE access; never POST a lead here.
  const landingHtml = await (await previewFetch(base)).text();
  assert.ok(landingHtml.includes('href="/mental-check"'), 'homepage must expose the real questionnaire');
  const checkHtml = await (await previewFetch(base + '/mental-check')).text();
  assert.match(checkHtml, /id="mental-form"/, 'questionnaire must render');
  assert.ok(checkHtml.includes('/api/questionnaire/mental'), 'questionnaire API contract must remain wired');
  assert.match(checkHtml, /id="success-card"/, 'post-submission next-step panel must render');
  assert.ok(checkHtml.includes('https://lin.ee/pcAHpTBy'), 'existing LINE CTA must remain present');
  assert.ok(checkHtml.includes('/library/entry-toolkit'), 'low-intent preview CTA must remain present');
  const toolkitHtml = await (await previewFetch(base + '/library/entry-toolkit')).text();
  assert.match(toolkitHtml, /PREVIEW|先行案内|公開準備中/, 'toolkit must not be misrepresented as a delivered free Quest');

  // Public runtime CSS must bypass Dashboard auth and actually reach the browser.
  for (const path of ['/assets/dashboard-runtime/tasks.css', '/assets/dashboard-runtime/graph.css']) {
    const res = await previewFetch(base + path, { redirect: 'manual' });
    assert.equal(res.status, 200, path + ' must be reachable before login');
    assert.match(res.headers.get('content-type') || '', /text\/css/, path);
    assert.match(await res.text(), /@scope\s*\(\./, path);
  }
  // Task Pipeline is private and must not leak a task board to anonymous users.
  const privatePipeline = await previewFetch(base + '/dashboard/pipeline', { redirect: 'manual' });
  assert.equal(privatePipeline.status, 302, 'Pipeline is a private Dashboard route');
  assert.equal(privatePipeline.headers.get('location'), '/dashboard/login');
  assert.match(privatePipeline.headers.get('cache-control'), /no-store/);
  const dashboard = await previewFetch(base + '/dashboard', { redirect: 'manual' });
  assert.equal(dashboard.status, 302);
  assert.equal(dashboard.headers.get('location'), '/dashboard/login');
  assert.match(dashboard.headers.get('cache-control'), /no-store/);
  for (const path of ['/mind', '/mind/']) {
    const res = await previewFetch(base + path, { redirect: 'manual' });
    assert.equal(res.status, 302, path);
    assert.equal(res.headers.get('location'), '/dashboard/login', path);
    assert.match(res.headers.get('cache-control'), /no-store/, path);
    assert.equal(res.headers.get('referrer-policy'), 'no-referrer', path);
  }
  for (const path of ['/api/dashboard/state', '/api/dashboard/task-move', '/api/dashboard/design-state', '/api/dashboard/voice', '/api/x-harness/x-accounts', '/api/line-harness/line-accounts']) {
    const res = await previewFetch(base + path);
    assert.equal(res.status, 401, path);
    assert.match(res.headers.get('cache-control'), /no-store/);
  }
  const anonymousMove = await previewFetch(base + '/api/dashboard/task-move', {
    method:'POST', headers:{ Origin:base, 'Content-Type':'application/json' },
    body:JSON.stringify({taskId:'T0001',fromStatus:'NEXT',toStatus:'NOW',expectedRevision:1})
  });
  assert.equal(anonymousMove.status,401,'anonymous users may not mutate canonical Task Sheet');
  assert.match(anonymousMove.headers.get('cache-control'),/no-store/);
  // These exact bootstrap routes must remain reachable, without accepting auth.
  for (const path of ['/api/dashboard/google-login', '/api/dashboard/reset-password']) {
    const res = await previewFetch(base + path, { method: 'POST', headers: { Origin: base } });
    assert.equal(res.status, 401);
    assert.equal((await res.json()).error, 'missing_access_token');
  }
  const csrf = await previewFetch(base + '/api/x-harness/posts', { method: 'POST', headers: { Origin: 'https://other.example.test' } });
  assert.equal(csrf.status, 403);
  // Same-origin conversion telemetry must reject outside traffic before touching production storage.
  const badOrigin = await previewFetch(base + '/api/funnel/mental-check', {
    method: 'POST',
    headers: { Origin: 'https://external.example', 'Content-Type': 'application/json' },
    body: JSON.stringify({ event: 'mental_check_line_click', sessionKey: '00000000-0000-0000-0000-000000000000' }),
  });
  assert.equal(badOrigin.status, 403, 'cross-origin mental-check beacon must be rejected');
  const invalidConversion = await previewFetch(base + '/api/funnel/mental-check', {
    method: 'POST',
    headers: { Origin: base, 'Content-Type': 'application/json' },
    body: JSON.stringify({ event: 'not_real', sessionKey: '00000000-0000-0000-0000-000000000000' }),
  });
  assert.equal(invalidConversion.status, 400, 'only known CTA events may be accepted');
  await smokeLineObservability(base, fixture);
  await smokeNoteHarness(base, noteFixture, fixture);
  console.log('Worker preview smoke passed: public pages, auth bootstrap and private boundaries.');
} catch (error) {
  console.error(logs);
  throw error;
} finally {
  child.kill('SIGTERM');
  await Promise.race([once(child, 'exit'), new Promise((resolve) => setTimeout(resolve, 3000))]);
  if (child.exitCode === null) child.kill('SIGKILL');
  await noteFixture.close();
  await fixture.close();
}
