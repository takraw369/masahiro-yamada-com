import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { once } from 'node:events';
import { dashboardOwnerKey } from '../src/lib/dashboardAuth.ts';

// Local synthetic RPC fixture only, sharing the existing isolated preview.
export async function createNoteFixture(lineFixture) {
  const owner = await dashboardOwnerKey(lineFixture.vars.DASHBOARD_PASSWORD);
  const links = new Map();
  const publications = new Map();
  const receipts = [];
  let unavailable = false;
  const id = '00000000-0000-4000-8000-000000000001';
  const server = createServer(async (req, res) => {
    const name = req.url?.replace('/rest/v1/rpc/', '');
    let raw = ''; for await (const chunk of req) raw += chunk;
    if (name === 'masa_line_control_snapshot') {
      const response = await fetch(lineFixture.vars.SUPABASE_URL + req.url, { method: 'POST', body: raw });
      res.writeHead(response.status, { 'Content-Type': 'application/json' });res.end(await response.text());return;
    }
    res.setHeader('Content-Type', 'application/json');
    const args = JSON.parse(raw || '{}');
    if (args.p_owner_key !== owner) { res.writeHead(403);res.end('{"error":"unauthorized"}');return; }
    if (unavailable) { res.writeHead(404);res.end('{"message":"NOTE_PRIVATE_SENTINEL"}');return; }
    let result;
    switch (name) {
      case 'masa_tracked_link_upsert_v1': {
        const fields = Object.fromEntries(Object.entries(args).map(([key, value]) => [key.replace(/^p_/, ''), value]));
        const link = { ...fields, id, created_at: '2026-10-06T00:00:00Z', updated_at: '2026-10-06T00:00:00Z', human_clicks: 1, bot_clicks: 0 };
        links.set(link.slug, link);result = id;break;
      }
      case 'resolve_tracked_link_v1': {
        const link = links.get(args.p_slug);
        result = link?.status === 'active' ? [{ ...link, link_id: link.id }] : [];
        if (result.length) receipts.push(args);
        break;
      }
      case 'masa_tracked_link_list_v1': result = [...links.values()];break;
      case 'masa_note_publication_register_v1':
        publications.set(id, { id, asset_id: args.p_asset_id, title: 'Synthetic Note', published_url: args.p_published_url, status: 'published', clicks: 1 });result = id;break;
      case 'masa_note_metrics_record_v1': {
        const publication = publications.get(args.p_publication_id);
        Object.assign(publication, { impressions: args.p_impressions, views: args.p_views, likes: args.p_likes, comments: args.p_comments, status: 'measured' });result = id;break;
      }
      case 'masa_note_publication_list_v1': result = [...publications.values()];break;
      case 'masa_note_attribution_summary_v1': result = [...links.values()].map(link => ({ ...link, link_id: link.id, consented_contacts: 1, line_engaged_contacts: 1, first_touch_paid_customers: 1, first_touch_paid_purchases: 1, first_touch_revenue_yen: 100 }));break;
      default: res.writeHead(404);res.end('{}');return;
    }
    res.end(JSON.stringify(result));
  });
  server.listen(0, '127.0.0.1');await once(server, 'listening');
  return { vars: { ...lineFixture.vars, SUPABASE_URL: `http://127.0.0.1:${server.address().port}` },
    receipts, fail: () => { unavailable = true; }, close: () => new Promise(resolve => server.close(resolve)) };
}

export async function smokeNoteHarness(base, fixture, lineFixture) {
  const cookie = await lineFixture.cookie(base);
  const get = (path, options = {}) => fetch(base + path, { headers: { Cookie: cookie, 'User-Agent': 'Mozilla/5.0' }, redirect: 'manual', ...options });
  const post = (path, body) => get(path, { method: 'POST', headers: { Cookie: cookie, Origin: base, 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  for (const path of ['/api/dashboard/note-harness-links', '/api/dashboard/note-publications', '/api/dashboard/note-attribution']) {
    assert.equal((await get(path, { headers: {} })).status, 401, path);
  }
  assert.equal((await get('/dashboard/note-harness', { headers: {} })).status, 302);
  const link = { slug: 'smoke-link', destinationUrl: 'https://masahiroyamada.com/library?utm_campaign=stale', campaignRef: 'nh-shared', placement: 'article_end' };
  for (const status of ['active', 'paused', 'archived']) {
    assert.equal((await post('/api/dashboard/note-harness-links', { ...link, status })).status, 200);
    const response = await get('/go/smoke-link?url=https://evil.example&to=https://evil.example&utm_campaign=evil');
    assert.equal(response.status, status === 'active' ? 302 : 404);
    if (status === 'active') {
      const url = new URL(response.headers.get('location'));
      assert.equal(url.hostname, 'masahiroyamada.com');assert.equal(url.searchParams.get('utm_campaign'), 'nh-shared');
    }
  }
  await post('/api/dashboard/note-harness-links', { ...link, status: 'active' });
  for (const options of [{ method: 'HEAD' }, { headers: { 'User-Agent': 'Mozilla/5.0', 'Sec-Purpose': 'prefetch' } }, { headers: { 'User-Agent': 'Twitterbot' } }]) {
    assert.equal((await get('/go/smoke-link', options)).status, 302);
    assert.equal(fixture.receipts.at(-1).p_user_agent_class, 'bot');
  }
  const external = 'https://line.me/test?x=1';
  assert.equal((await post('/api/dashboard/note-harness-links', { ...link, slug: 'external-link', destinationUrl: external, status: 'active' })).status, 200);
  assert.equal((await get('/go/external-link?utm_source=evil')).headers.get('location'), external);
  assert.equal((await post('/api/dashboard/note-publications', { action: 'register', assetId: 'test-note', publishedUrl: 'https://note.com/test/n_fixture' })).status, 200);
  const list = await (await get('/api/dashboard/note-publications')).json();
  const publicationId = list.publications[0].id;
  assert.equal((await post('/api/dashboard/note-publications', { action: 'metrics', publicationId, impressions: 100, views: 80, likes: 5 })).status, 200);
  assert.equal((await post('/api/dashboard/note-publications', { action: 'metrics', publicationId, impressions: 2147483648 })).status, 400);
  const html = await (await get('/dashboard/note-harness')).text();
  for (const text of ['data-edit-link', 'smoke-link', 'external-link', 'note.com/test/n_fixture', 'FIRST-TOUCH', 'LINE ENGAGED', '/dashboard/note-harness']) assert.ok(html.includes(text), text);
  const revenue = html.match(/<span[^>]*>ASSISTED ¥<\/span>\s*<strong[^>]*>([^<]*)/);
  assert.match(revenue?.[1] || '', /^[¥￥]100$/, 'shared campaign outcomes counted once');
  const attribution = await (await get('/api/dashboard/note-attribution')).json();
  assert.equal(attribution.rows.length, 2);assert.ok(attribution.caveats.campaignOutcomes);
  fixture.fail();
  assert.equal((await get('/go/smoke-link?url=https://evil.example')).status, 503);
  for (const path of ['/api/dashboard/note-harness-links', '/api/dashboard/note-publications', '/api/dashboard/note-attribution']) assert.equal((await get(path)).status, 503, path);
  const failed = await (await get('/dashboard/note-harness')).text();
  assert.ok(failed.includes('Note Harnessを利用できません'));
  assert.ok(!failed.includes('NOTE_PRIVATE_SENTINEL'));
  assert.ok(!failed.includes('id="link-form"'));assert.ok(!failed.includes('id="metrics-form"'));
  console.log('Note Harness isolated Worker smoke passed: lifecycle, query redirect rejection, preview/HEAD classification, external UTM isolation, publication/metrics, shared-campaign totals and migration fail-closed.');
}
