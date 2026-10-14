import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

test('one-click Decision Lens orchestrates server-side AI generation and locked prediction', () => {
  const proxy=readFileSync(new URL('../src/pages/api/dashboard/decision-auto.ts',import.meta.url),'utf8');
  const screen=readFileSync(new URL('../src/pages/dashboard/decision-lens.astro',import.meta.url),'utf8');
  const functionCode=readFileSync(new URL('../supabase/functions/cognitive-compose/index.ts',import.meta.url),'utf8');
  for(const feature of ['auto-predict','auto-compare','/api/dashboard/decision-auto']) assert.match(screen,new RegExp(feature));
  assert.match(proxy,/getDashboardOwnerKey/);
  assert.match(proxy,/masa_cognitive_case_save_v1/);
  assert.match(proxy,/p_action:'lock'/);
  assert.match(proxy,/p_action:'actual'/);
  assert.match(proxy,/prediction_lock_failed/);
  assert.match(proxy,/AbortController/);
  assert.match(functionCode,/masa_evidence_owner_ok_v1/);
  assert.match(functionCode,/OPENAI_API_KEY/);
  assert.match(functionCode,/store:false/);
  assert.match(functionCode,/json_schema/);
  assert.match(functionCode,/source_synced/);
  assert.doesNotMatch(screen,/OPENAI_API_KEY|SUPABASE_SERVICE_ROLE_KEY/);
});
