import test from 'node:test';
import assert from 'node:assert/strict';
import { env } from './helpers/worker-runtime.mjs';
const { POST } = await import('../src/pages/api/dashboard/automation.ts');
const calls = [];
const target = {
  sourceId: 1851849520, sourceUrl: 'https://example.com/source', targetId: 'canonical_id',
  action: 'NO_NEW_FILE', appendText: '', evidenceText: 'Existing exact evidence.\n', conflictStatus: 'clear',
};
const auth = { ...target, targetRevision: 'revision_1', targetDigest: 'a'.repeat(64), sourceDigest: 'b'.repeat(64), deltaDigest: 'c'.repeat(64) };
test.beforeEach(() => {
  calls.length = 0;
  env.FLOW_RUNNER = {
    health: async () => ({ canonicalTargetContract: "exact_source_target_v2" }),
    canonicalAssetPreview: async (...args) => { calls.push(args); return { ok:true }; },
    canonicalAssetWrite: async (...args) => { calls.push(args); return { ok:true }; },
  };
});
async function invoke(action, fields = {}) {
  return POST({ request: new Request('https://example.com/api/dashboard/automation', {
    method:'POST', headers:{'content-type':'application/json'}, body:JSON.stringify({ action, sourceId: target.sourceId, ...fields }),
  }) });
}
test('preview forwards exact source/target evidence without trimming or write authority', async () => {
  assert.equal((await invoke('canonical.preview',{ target })).status,200);
  assert.deepEqual(calls,[[target.sourceId,target]]);
});
test('write forwards exact authorization and preserves delta bytes; legacy path stays two-argument', async () => {
  const confirmation='CONFIRM_ONE_CANONICAL_WRITE';
  assert.equal((await invoke('canonical.write',{ confirmation,target:auth })).status,200);
  assert.deepEqual(calls[0],[target.sourceId,confirmation,auth]);
  assert.equal((await invoke('canonical.write',{ confirmation })).status,200);
  assert.deepEqual(calls[1],[target.sourceId,confirmation]);
});
test('explicit malformed target never falls back to unbound legacy write', async () => {
  for (const bad of [null, [], { ...auth, sourceId:1 }, { ...auth, sourceUrl:'javascript:alert(1)' }, { ...auth, targetDigest:'wrong' }, { ...auth, appendText:'unexpected noop delta' }, { ...auth, targetRevision:undefined }]) {
    assert.equal((await invoke('canonical.write',{ confirmation:'CONFIRM_ONE_CANONICAL_WRITE',target:bad })).status,400);
  }
  assert.equal(calls.length,0);
});
test('valid target cannot authorize write without the exact Human Gate token', async () => {
  assert.equal((await invoke('canonical.write',{ target:auth,confirmation:'yes' })).status,400);
  assert.equal(calls.length,0);
});

test('old runner cannot silently ignore target arguments and create a candidate', async () => {
  env.FLOW_RUNNER.health = async () => ({ canonicalAssetWrite:true });
  assert.equal((await invoke('canonical.preview',{ target })).status,503);
  assert.equal((await invoke('canonical.write',{ confirmation:'CONFIRM_ONE_CANONICAL_WRITE',target:auth })).status,503);
  assert.equal(calls.length,0);
  assert.equal((await invoke('canonical.write',{ confirmation:'CONFIRM_ONE_CANONICAL_WRITE' })).status,200);
  assert.deepEqual(calls,[[target.sourceId,'CONFIRM_ONE_CANONICAL_WRITE']]);
});
