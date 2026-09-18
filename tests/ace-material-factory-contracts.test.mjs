import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

const source = fs.readFileSync(new URL('../scripts/apps-script/ace-material-factory.gs', import.meta.url), 'utf8');

test('material factory uses CONTENT_OS and one-pending-draft human gate', () => {
  assert.match(source, /ACE_MATERIAL_CONTENT_OS_ID/);
  assert.match(source, /findPendingAceMaterialDraft_/);
  assert.match(source, /waiting_for_masa/);
  assert.match(source, /\^DRAFT｜/);
});

test('approval only moves explicitly approved drafts into ACE_ASSET_INBOX', () => {
  assert.match(source, /ACE_MATERIAL_INBOX_FOLDER_ID/);
  assert.match(source, /\^\(APPROVED\|READY\)｜/);
  assert.match(source, /file\.moveTo\(inboxFolder\)/);
  assert.doesNotMatch(source, /p_status:\s*['"]live['"]/i);
});

test('generator requires external AI key and marks MASA review points', () => {
  assert.match(source, /GEMINI_API_KEY/);
  assert.match(source, /x-goog-api-key/);
  assert.match(source, /MASA REVIEW/);
  assert.match(source, /要出典確認/);
});

test('autonomous candidate selection excludes reference-only and political rows', () => {
  assert.match(source, /参考資料限定/);
  assert.match(source, /POLITIC\|政治/i);
});
