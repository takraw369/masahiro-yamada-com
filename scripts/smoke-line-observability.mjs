import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { once } from 'node:events';
import { createDashboardSession, dashboardOwnerKey } from '../src/lib/dashboardAuth.ts';

// Synthetic fixture only. No inherited credentials or production requests.
export async function createLineFixture(password = 'local-line-observability-fixture') {
  const owner = await dashboardOwnerKey(password);
  const empty = { generated_at: '2026-09-09T02:00:00Z', summary: { line_contacts: 1, total_xp: 0, active_enrollments: 1, active_sequences: 1, draft_sequences: 0, messages_24h: 3, inbound_7d: 1, outbound_7d: 2 },
    sequences: [], recent_messages: [], progress: [], active_hours: [], sources: [], automation_runs: [] };
  const full = { ...empty, recent_messages: [
    { message_id: '101', contact_id: 'local-contact', direction: 'inbound', contact_label: 'Local contact', sent_at: empty.generated_at, body: 'Inbound fixture' },
    { message_id: '102', contact_id: 'local-contact', direction: 'outbound', contact_label: 'Local contact', sent_at: empty.generated_at,
      body: '<script>window.lineFixtureInjected=true</script>' + 'Long-unbroken-message-'.repeat(30), why_sent: {
        sequence_key: 'welcome-fixture', sequence_name: 'Welcome', step_index: '1', step_name: 'First step', step_id: 'step-fixture', enrollment_id: 'enrollment-fixture',
        delivery_mode: 'push', duplicate_candidate_message_ids: ['103'], idempotency: null,
      } },
    { direction: 'outbound', contact_label: 'Historical contact', sent_at: empty.generated_at, body: 'Historical fixture without IDs' },
  ] };
  let mode = 'full';
  let calls = 0;
  const server = createServer(async (req, res) => {
    if (req.method !== 'POST' || req.url !== '/rest/v1/rpc/masa_line_control_snapshot') {
      res.writeHead(404); res.end(); return;
    }
    let raw = ''; for await (const chunk of req) raw += chunk;
    if (JSON.parse(raw).p_owner_key !== owner) { res.writeHead(403); res.end('unauthorized'); return; }
    calls++;
    res.setHeader('Content-Type', 'application/json');
    if (mode === 'failure') { res.writeHead(503); res.end('{"error":"PRIVATE_UPSTREAM_SENTINEL"}'); return; }
    res.end(JSON.stringify(mode === 'malformed' ? null : mode === 'empty' ? empty : full));
  });
  server.listen(0, '127.0.0.1'); await once(server, 'listening');
  return {
    vars: { DASHBOARD_PASSWORD: password, SUPABASE_URL: `http://127.0.0.1:${server.address().port}`, SUPABASE_PUBLISHABLE_KEY: 'local-fixture-only' },
    setMode: (value) => { mode = value; },
    cookie: async (base) => `ace-dash-auth=${await createDashboardSession(password, base)}`,
    calls: () => calls,
    close: () => new Promise((resolve) => server.close(resolve)),
  };
}

export async function smokeLineObservability(base, fixture) {
  const cookie = await fixture.cookie(base);
  const request = () => fetch(base + '/dashboard/lian', { headers: { Cookie: cookie }, signal: AbortSignal.timeout(10000) });
  const response = await request();
  assert.equal(response.status, 200);
  assert.match(response.headers.get('cache-control'), /no-store/);
  const html = await response.text();
  assert.equal((html.match(/<details\b/g) || []).length, 2, 'outbound-only disclosures including legacy message');
  assert.ok(!/<details[^>]*\bopen\b/.test(html), 'disclosures initially collapsed');
  for (const text of ['welcome-fixture', 'step-fixture', 'enrollment-fixture', 'Not captured', 'Duplicate candidate', 'Historical fixture without IDs']) assert.ok(html.includes(text), text);
  assert.ok(html.includes('&lt;script&gt;'), 'message body escaped');
  assert.ok(!html.includes('<script>window.lineFixtureInjected'), 'no body script execution');
  for (const mode of ['empty', 'failure', 'malformed']) {
    fixture.setMode(mode);
    const result = await request(); assert.equal(result.status, 200, mode);
    const body = await result.text();
    assert.ok(body.includes('メッセージ履歴はありません。'), mode);
    assert.ok(!body.includes('<details'), mode);
    assert.ok(!body.includes('PRIVATE_UPSTREAM_SENTINEL'), 'upstream error must not reach UI');
    if (mode !== 'empty') assert.ok(body.includes('LINEデータを取得できませんでした'), mode);
  }
  assert.equal(fixture.calls(), 4);
  fixture.setMode('full');
  console.log('LINE authenticated Worker smoke passed: outbound disclosure, historical gaps, escaped long body, empty and RPC failure/malformed states.');
}
