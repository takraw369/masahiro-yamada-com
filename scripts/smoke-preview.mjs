import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { createServer } from 'node:net';
import { once } from 'node:events';
import { join } from 'node:path';

const requiredSecrets = [
  'DASHBOARD_PASSWORD',
  'DASHBOARD_OPERATOR_PASSWORD',
  'DASHBOARD_SESSION_SECRET',
  'X_HARNESS_API_KEY',
  'LINE_HARNESS_API_KEY',
];

async function availablePort() {
  const server = createServer();
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const address = server.address();
  const port = typeof address === 'object' && address ? address.port : null;
  server.close();
  await once(server, 'close');
  if (!port) throw new Error('Unable to allocate a preview port');
  return port;
}

async function waitUntilReady(url, child, diagnostics) {
  const deadline = Date.now() + 30_000;
  while (Date.now() < deadline) {
    if (child.exitCode !== null) {
      throw new Error(`Preview exited before becoming ready (${child.exitCode})\n${diagnostics()}`);
    }
    try {
      const response = await fetch(url);
      await response.arrayBuffer();
      return;
    } catch {
      await new Promise((resolve) => setTimeout(resolve, 200));
    }
  }
  throw new Error(`Timed out waiting for preview\n${diagnostics()}`);
}

const port = await availablePort();
const baseUrl = `http://127.0.0.1:${port}`;
const childEnv = { ...process.env };
for (const secret of requiredSecrets) delete childEnv[secret];

const wrangler = join(process.cwd(), 'node_modules', '.bin', 'wrangler');
const child = spawn(wrangler, ['dev', '--ip', '127.0.0.1', '--port', String(port)], {
  env: childEnv,
  stdio: ['ignore', 'pipe', 'pipe'],
});

let output = '';
const capture = (chunk) => {
  output = `${output}${chunk}`.slice(-20_000);
};
child.stdout.on('data', capture);
child.stderr.on('data', capture);

try {
  await waitUntilReady(`${baseUrl}/`, child, () => output);

  const publicRoutes = [
    ['/', 'ACE METHOD'],
    ['/contact', '企業・取材向けお問い合わせ'],
    ['/about', 'About'],
    ['/ace', 'ACE METHOD'],
    ['/tips', 'Tips'],
  ];
  for (const [path, marker] of publicRoutes) {
    const response = await fetch(`${baseUrl}${path}`);
    const body = await response.text();
    assert.equal(response.status, 200, path);
    assert.match(response.headers.get('content-type') ?? '', /^text\/html/u, path);
    assert.ok(body.includes(marker), `${path} is missing ${marker}`);
  }

  const dashboard = await fetch(`${baseUrl}/dashboard`, { redirect: 'manual' });
  assert.equal(dashboard.status, 302);
  assert.equal(dashboard.headers.get('location'), '/dashboard/login');
  assert.equal(dashboard.headers.get('cache-control'), 'no-store, max-age=0');

  for (const path of ['/api/dashboard/state', '/api/x-harness/status']) {
    const response = await fetch(`${baseUrl}${path}`);
    assert.equal(response.status, 503, path);
    assert.equal(response.headers.get('cache-control'), 'no-store, max-age=0', path);
    assert.deepEqual(await response.json(), { error: 'service_unavailable' }, path);
  }

  console.log('Preview smoke test passed: public routes available; private routes fail closed.');
} finally {
  const exited = child.exitCode === null ? once(child, 'exit') : Promise.resolve();
  if (child.exitCode === null) child.kill('SIGTERM');
  await Promise.race([exited, new Promise((resolve) => setTimeout(resolve, 5_000))]);
  if (child.exitCode === null) child.kill('SIGKILL');
}
