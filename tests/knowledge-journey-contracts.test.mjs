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

test('Knowledge Journey checkout click is intent, never anonymous purchase proof', async () => {
  const client = await read('src/lib/knowledgeJourneyClient.ts');
  const endpoint = await read('src/pages/api/library/journey.ts');
  assert.match(client, /ks_checkout_start/);
  assert.ok(client.includes('buy') && client.includes('stripe_payment_link'), 'Stripe link only');
  assert.match(client, /stripe_payment_link/);
  assert.doesNotMatch(endpoint, /^\s*'ks_purchase',/m);
  assert.match(endpoint, /signature-verified payment webhook/);
});

test('isolated Worker smoke covers existing purchaser key, reader and fake purchase denial', async () => {
  const smoke = await read('scripts/smoke-preview.mjs');
  for (const name of ['/library/access', '/library/a3-decision-flow/read', '/api/library/claim-key', '/api/library/unlock', 'fakePurchase']) {
    assert.ok(smoke.includes(name), 'missing smoke case: ' + name);
  }
  assert.match(smoke, /no-store/);
  assert.match(smoke, /invalid_event/);
});


test('manual Cloudflare Preview job is isolated and cannot run on push or PR', async () => {
  const ci = await read('.github/workflows/ci.yml');
  const manual = ci.split('  shelf-preview-manual:')[1];
  assert.ok(manual, 'expected manual job inside existing CI workflow');
  assert.match(manual, /github.event_name == 'workflow_dispatch'/);
  assert.match(manual, /github.ref == 'refs\/heads\/fix\/shelf-journey-payment-signal-and-preview-20261014'/);
  assert.match(manual, /needs: \[test-and-build, secret-scan\]/);
  assert.match(manual, /--ignore-base-config/);
  assert.match(manual, /wrangler@4\.135\.0 preview/);
  assert.match(manual, /workers_dev = false/);
  assert.match(manual, /preview_urls = true/);
  assert.doesNotMatch(manual, /wrangler deploy\b/);
  assert.doesNotMatch(manual, /\[\[routes\]\]|\[\[d1_databases\]\]|\[\[services\]\]/);
});

test('Cloudflare shared preview deploy uses built client asset root and verifies public CSS', async () => {
  const workflow = await read('.github/workflows/ci.yml');
  assert.match(workflow, /built\.assets\?\.directory/);
  assert.match(workflow, /actualAssets/);
  assert.match(workflow, /cssRoot/);
  assert.match(workflow, /stylesheetCount > 0/);
  assert.match(workflow, /CSS not served:/);
  assert.match(workflow, /'\/library'/);
});
