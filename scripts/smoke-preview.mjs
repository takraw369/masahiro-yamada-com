import assert from 'node:assert/strict';
import { once } from 'node:events';
import { createServer } from 'node:net';
import { startPreview } from './local-preview.mjs';

const server = createServer();
server.listen(0, '127.0.0.1');
await once(server, 'listening');
const port = server.address().port;
server.close();
await once(server, 'close');
const base = `http://127.0.0.1:${port}`;
const child = await startPreview(port);
let logs = '';
let startupError;
child.stdout.on('data', (chunk) => { logs = (logs + chunk).slice(-12000); });
child.stderr.on('data', (chunk) => { logs = (logs + chunk).slice(-12000); });
child.on('error', (error) => { startupError = error; });
try {
  let ready = false;
  for (let attempt = 0; attempt < 150; attempt++) {
    if (startupError) throw startupError;
    if (child.exitCode !== null) throw new Error(logs);
    try { const res = await fetch(base); await res.arrayBuffer(); ready = true; break; } catch {}
    await new Promise((resolve) => setTimeout(resolve, 200));
  }
  assert.ok(ready, logs);
  for (const path of ['/', '/contact', '/faq', '/tips', '/library', '/gate', '/dashboard/login']) {
    const res = await fetch(base + path);
    assert.equal(res.status, 200, path);
    assert.match(res.headers.get('content-type'), /text\/html/, path);
    assert.ok((await res.text()).includes('<html'), path);
  }
  const dashboard = await fetch(base + '/dashboard', { redirect: 'manual' });
  assert.equal(dashboard.status, 302);
  assert.equal(dashboard.headers.get('location'), '/dashboard/login');
  assert.match(dashboard.headers.get('cache-control'), /no-store/);
  for (const path of ['/api/dashboard/state', '/api/dashboard/voice', '/api/x-harness/x-accounts', '/api/line-harness/line-accounts']) {
    const res = await fetch(base + path);
    assert.equal(res.status, 401, path);
    assert.match(res.headers.get('cache-control'), /no-store/);
  }
  // These exact bootstrap routes must remain reachable, without accepting auth.
  for (const path of ['/api/dashboard/google-login', '/api/dashboard/reset-password']) {
    const res = await fetch(base + path, { method: 'POST', headers: { Origin: base } });
    assert.equal(res.status, 401);
    assert.equal((await res.json()).error, 'missing_access_token');
  }
  const csrf = await fetch(base + '/api/x-harness/posts', { method: 'POST', headers: { Origin: 'https://other.example.test' } });
  assert.equal(csrf.status, 403);
  console.log('Worker preview smoke passed: public pages, auth bootstrap and private boundaries.');
} catch (error) {
  console.error(logs);
  throw error;
} finally {
  child.kill('SIGTERM');
  await Promise.race([once(child, 'exit'), new Promise((resolve) => setTimeout(resolve, 3000))]);
  if (child.exitCode === null) child.kill('SIGKILL');
}
