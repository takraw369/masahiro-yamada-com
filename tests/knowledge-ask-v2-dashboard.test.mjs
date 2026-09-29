import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8');

test('Dashboard Knowledge Ask proxy keeps owner authentication server-side', async () => {
  const endpoint = await read('src/pages/api/dashboard/knowledge-ask.ts');
  assert.match(endpoint, /getDashboardOwnerKey/);
  assert.match(endpoint, /owner_key:\s*ownerKey/);
  assert.match(endpoint, /functions\/v1\/knowledge-ask-v2/);
  assert.doesNotMatch(endpoint, /SUPABASE_SERVICE_ROLE_KEY/);
  assert.doesNotMatch(endpoint, /owner_key.*record\./s);
});

test('Dashboard Knowledge Ask validates request bounds before calling Supabase', async () => {
  const endpoint = await read('src/pages/api/dashboard/knowledge-ask.ts');
  assert.match(endpoint, /MAX_BODY_BYTES/);
  assert.match(endpoint, /MAX_QUESTION_LENGTH/);
  assert.match(endpoint, /invalid_project_id/);
  assert.match(endpoint, /invalid_answer_mode/);
});

test('FLOW MIND Ask client only calls the protected same-origin dashboard proxy', async () => {
  const client = await read('public/scripts/flow-mind-ask-v2.js');
  assert.match(client, /fetch\('\/api\/dashboard\/knowledge-ask'/);
  assert.match(client, /credentials:\s*'same-origin'/);
  assert.doesNotMatch(client, /supabase\.co/);
  assert.doesNotMatch(client, /owner_key/);
});

test('FLOW MIND dashboard loads Ask v2 without replacing existing search', async () => {
  const page = await read('src/pages/dashboard/knowledge.astro');
  assert.match(page, /flow-mind-search\.js/);
  assert.match(page, /flow-mind-ask-v2\.js/);
});
