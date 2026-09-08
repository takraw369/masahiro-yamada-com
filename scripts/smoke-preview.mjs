import assert from 'node:assert/strict';
import { once } from 'node:events';
import { createServer } from 'node:net';
import { startPreview, ISOLATED_SESSION_SECRET } from './local-preview.mjs';
import { createDashboardSession } from '../src/lib/dashboardAuth.ts';

const server = createServer();
server.listen(0, '127.0.0.1');
await once(server, 'listening');
const port = server.address().port;
server.close();
await once(server, 'close');
const base = `http://127.0.0.1:${port}`;
const child = await startPreview(port, { authenticated: true });
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
  for (const path of ['/', '/contact', '/faq', '/tips', '/library', '/gate', '/dashboard/login']) {
    const res = await previewFetch(base + path);
    assert.equal(res.status, 200, path);
    assert.match(res.headers.get('content-type'), /text\/html/, path);
    assert.ok((await res.text()).includes('<html'), path);
  }
  const dashboard = await previewFetch(base + '/dashboard', { redirect: 'manual' });
  assert.equal(dashboard.status, 302);
  assert.equal(dashboard.headers.get('location'), '/dashboard/login');
  assert.match(dashboard.headers.get('cache-control'), /no-store/);
  for (const path of ['/api/dashboard/state', '/api/dashboard/voice', '/api/x-harness/x-accounts', '/api/line-harness/line-accounts']) {
    const res = await previewFetch(base + path);
    assert.equal(res.status, 401, path);
    assert.match(res.headers.get('cache-control'), /no-store/);
  }
  // These exact bootstrap routes must remain reachable, without accepting auth.
  for (const path of ['/api/dashboard/google-login', '/api/dashboard/reset-password']) {
    const res = await previewFetch(base + path, { method: 'POST', headers: { Origin: base } });
    assert.equal(res.status, 401);
    assert.equal((await res.json()).error, 'missing_access_token');
  }
  const csrf = await previewFetch(base + '/api/x-harness/posts', { method: 'POST', headers: { Origin: 'https://other.example.test' } });
  assert.equal(csrf.status, 403);
  const session = await createDashboardSession(ISOLATED_SESSION_SECRET, base);
  for (const path of ['/dashboard', '/dashboard/lian', '/dashboard/funnel', '/dashboard/schedule', '/dashboard/voice']) {
    const res = await previewFetch(base + path, { redirect: 'manual', headers: { Cookie: `ace-dash-auth=${session}` } });
    assert.equal(res.status, 200, path);
    assert.match(res.headers.get('cache-control'), /no-store/, path);
    assert.match(res.headers.get('set-cookie'), /ace-dash-auth=v2\./, path);
    const html = await res.text();
    assert.ok(html.includes('<html'), path);
    if (path === '/dashboard/lian') assert.ok(html.includes('LINEの情報を取得できませんでした'));
    if (path === '/dashboard/funnel') assert.ok(html.includes('現在の集計ではありません'));
  }
  console.log('Worker preview smoke passed: public routes, auth bootstrap, private boundaries and authenticated Dashboard rendering.');
} catch (error) {
  console.error(logs);
  throw error;
} finally {
  child.kill('SIGTERM');
  await Promise.race([once(child, 'exit'), new Promise((resolve) => setTimeout(resolve, 3000))]);
  if (child.exitCode === null) child.kill('SIGKILL');
}
