import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';

test('X Draft Shelf never sends Intelligence metadata seed directly to composer', async () => {
  const shelf = await readFile(new URL('../src/components/dashboard/PostDraftShelf.tsx', import.meta.url), 'utf8');

  assert.match(shelf, /この素材から投稿案を作る/);
  assert.match(shelf, /INTERNAL MATERIAL/);
  assert.match(shelf, /投稿不可/);
  assert.match(shelf, /action, id/);
  assert.match(shelf, /intelligenceAction\('x_draft', id\)/);
  assert.match(shelf, /internal_seed_blocked/);
  assert.match(shelf, /looksLikeInternalSeed/);
  assert.doesNotMatch(shelf, /fillComposer\(item\.contentSeed/);
  assert.doesNotMatch(shelf, /sendToComposer\(item\.contentSeed/);
});

test('X Draft Shelf excludes archived rows and only refreshes a genuinely missing queue draft', async () => {
  const shelf = await readFile(new URL('../src/components/dashboard/PostDraftShelf.tsx', import.meta.url), 'utf8');

  assert.match(shelf, /item\.status !== 'archived'/);
  assert.match(shelf, /firstError\.includes\('x_draft_not_found'\)/);
  assert.match(shelf, /if \(!firstError\.includes\('x_draft_not_found'\)\) throw new Error\(firstError\)/);
  assert.match(shelf, /intelligence_archived/);
  assert.match(shelf, /intelligence_not_found/);
});

test('Intelligence API reads the existing review-gated X publish_queue draft', async () => {
  const api = await readFile(new URL('../src/pages/api/dashboard/intelligence.ts', import.meta.url), 'utf8');
  const migration = await readFile(new URL('../migrations/20260918_intelligence_x_draft_read.sql', import.meta.url), 'utf8');

  assert.match(api, /action === 'x_draft'/);
  assert.match(api, /masa_intelligence_get_x_draft_v1/);
  assert.match(migration, /masa_intelligence_get_x_draft_v1/);
  assert.match(migration, /masa_evidence_owner_ok_v1/);
  assert.match(migration, /from public\.publish_queue/);
  assert.match(migration, /pq\.provider = 'x'/);
  assert.match(migration, /pq\.payload->>'intelligence_id' = p_id::text/);
  assert.match(migration, /'text', v_payload->>'text'/);
  assert.match(migration, /'humanApproved'/);
  assert.match(migration, /'readyForPublish'/);
});

test('X draft v2 converts Intelligence into safe social copy instead of title plus WHY concatenation', async () => {
  const migration = await readFile(new URL('../migrations/20260919_intelligence_x_copy_v2.sql', import.meta.url), 'utf8');

  assert.match(migration, /masa_intelligence_refresh_x_copy_v2/);
  assert.match(migration, /研究は「答え」ではなく、現場を見る角度を増やす材料/);
  assert.match(migration, /一致する点、ズレる点、次に試すこと/);
  assert.match(migration, /intelligence-x-copy-v2/);
  assert.match(migration, /copy_mode/);
  assert.match(migration, /deterministic_safe_template/);
  assert.match(migration, /fact_check_required/);
  assert.match(migration, /human_approved/);
  assert.match(migration, /ready_for_publish/);
  assert.match(migration, /return public\.masa_intelligence_refresh_x_copy_v2\(p_owner_key, p_id\)/);
  assert.doesNotMatch(migration, /left\(concat_ws\(E'\\n\\n', v_hook, v_one_thing\), 280\)/);
});

test('X Draft Shelf tries account-aware Flow Runner AI first and preserves deterministic v2 fallback', async () => {
  const shelf = await readFile(new URL('../src/components/dashboard/PostDraftShelf.tsx', import.meta.url), 'utf8');
  const automation = await readFile(new URL('../src/pages/api/dashboard/automation.ts', import.meta.url), 'utf8');
  const accountOs = await readFile(new URL('../src/lib/xAccountPlaybook.ts', import.meta.url), 'utf8');
  const playbook = await readFile(new URL('../src/components/dashboard/SocialAccountPlaybook.tsx', import.meta.url), 'utf8');

  assert.match(shelf, /action: 'x\.postDraft'/);
  assert.match(shelf, /concept: account\.concept/);
  assert.match(shelf, /worldview: account\.worldview/);
  assert.match(shelf, /audience: account\.audience/);
  assert.match(shelf, /tone: account\.tone/);
  assert.match(shelf, /boundary: account\.boundary/);
  assert.match(shelf, /const draft = await getReviewDraft\(item\.id\)/);
  assert.match(shelf, /mode: 'fallback'/);
  assert.match(shelf, /事実確認とMASA Human Gate/);

  assert.match(automation, /generateXPostDraft/);
  assert.match(automation, /case 'x\.postDraft'/);
  assert.match(automation, /invalid_x_post_draft_input/);
  assert.match(automation, /await flow\.generateXPostDraft\(input\)/);

  assert.match(accountOs, /X_ACCOUNT_PLAYBOOKS/);
  assert.match(accountOs, /LAST_X_ACCOUNT_KEY/);
  assert.match(playbook, /X_ACCOUNT_PLAYBOOKS/);
  assert.doesNotMatch(playbook, /const ACCOUNTS:/);
});
