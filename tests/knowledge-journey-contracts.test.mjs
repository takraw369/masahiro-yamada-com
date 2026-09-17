import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8');

test('Knowledge Journey uses random pseudonymous IDs and no device fingerprint inputs', async () => {
  const client = await read('src/lib/knowledgeJourneyClient.ts');
  assert.match(client, /crypto\.randomUUID/);
  assert.match(client, /masa_ks_visitor_id/);
  assert.match(client, /masa_ks_session_id/);
  for (const forbidden of [
    'navigator.userAgent',
    'navigator.hardwareConcurrency',
    'navigator.deviceMemory',
    'screen.width',
    'screen.height',
    'canvas.toDataURL',
    'AudioContext',
    'webgl',
  ]) {
    assert.equal(client.includes(forbidden), false, `must not fingerprint via ${forbidden}`);
  }
});

test('Knowledge Journey captures learning-depth signals instead of only page views', async () => {
  const client = await read('src/lib/knowledgeJourneyClient.ts');
  for (const eventName of ['ks_item_view', 'ks_engaged_30s', 'ks_engaged_120s', 'ks_scroll_50', 'ks_scroll_90']) {
    assert.match(client, new RegExp(eventName));
  }
});

test('Library lead endpoint upgrades anonymous journey to consented identity path', async () => {
  const lead = await read('src/pages/api/library/lead.ts');
  assert.match(lead, /submit_library_lead_v2/);
  assert.match(lead, /masa_ks_vid/);
  assert.match(lead, /masa_ks_sid/);
  assert.match(lead, /consent_required/);
});

test('Public layout initializes tracking while privacy policy discloses no fingerprinting', async () => {
  const layout = await read('src/layouts/PublicPageLayout.astro');
  const privacy = await read('src/pages/legal/privacy.astro');
  assert.match(layout, /initKnowledgeJourney/);
  assert.match(privacy, /端末フィンガープリンティング.*行いません/s);
  assert.match(privacy, /ランダムな匿名識別子/);
});

test('Knowledge Journey dashboard labels drop-off as a signal, not certainty', async () => {
  const dashboard = await read('src/pages/dashboard/knowledge-journey.astro');
  assert.match(dashboard, /DROP SIGNAL/);
  assert.match(dashboard, /離脱確定.*ではなく/s);
  assert.match(dashboard, /masa_knowledge_journey_snapshot_v1/);
});
