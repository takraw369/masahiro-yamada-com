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
