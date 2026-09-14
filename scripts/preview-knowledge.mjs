import { createServer } from 'node:http';
import { once } from 'node:events';
import { startPreview } from './local-preview.mjs';

// Synthetic local RPC implements only the existing password-login contract.
// No production credentials, data, network endpoint or auth bypass is used.
const password = 'knowledge-flow-local-demo';
const fixture = createServer(async (req, res) => {
  if (req.method !== 'POST' || req.url !== '/rest/v1/rpc/verify_dashboard_login_password') {
    res.writeHead(404); res.end(); return;
  }
  try {
    let raw = '';
    for await (const chunk of req) { raw += chunk; if (raw.length > 2000) { res.writeHead(413); res.end(); return; } }
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify(JSON.parse(raw).p_password === password));
  } catch { res.writeHead(400); res.end(); }
});
fixture.listen(0, '127.0.0.1');
await once(fixture, 'listening');
let child;
try {
  child = await startPreview(8787, { vars: {
    DASHBOARD_PASSWORD: password,
    SUPABASE_URL: `http://127.0.0.1:${fixture.address().port}`,
    SUPABASE_PUBLISHABLE_KEY: 'knowledge-local-fixture-only',
  } });
} catch (error) { fixture.close(); throw error; }
child.stdout.pipe(process.stdout);
child.stderr.pipe(process.stderr);
console.log('Knowledge Flow: http://127.0.0.1:8787/dashboard/knowledge');
console.log(`Local-only password: ${password}`);
child.on('error', error => { fixture.close(); console.error(error.message); process.exitCode = 1; });
child.on('exit', code => { fixture.close(); process.exitCode = code || 0; });
for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => child.kill(signal));
