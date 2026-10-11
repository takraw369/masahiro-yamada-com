import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';

const endpoint = await readFile(
  new URL('../src/pages/api/dashboard/profile-preview.ts', import.meta.url),
  'utf8',
);
const page = await readFile(
  new URL('../src/pages/dashboard/profile-import.astro', import.meta.url),
  'utf8',
);

test('JEV profile preview stays behind the existing private dashboard API boundary', () => {
  assert.match(endpoint, /FLOW_RUNNER/);
  assert.match(endpoint, /profileJevPreview\(rawText: string\)/);
  assert.match(endpoint, /rawText\.length > 4000/);
  assert.match(endpoint, /Cache-Control': 'no-store'/);
});

test('profile import requires explicit review before local persistence', () => {
  assert.match(page, /HUMAN GATE/);
  assert.match(page, /id="save-profile"/);
  assert.match(page, /localStorage\.setItem\(STORAGE_KEY/);
  assert.match(page, /const\s+STORAGE_KEY\s*=\s*'masa\.profile\.v1'/);
  assert.doesNotMatch(page, /localStorage\.setItem\([^\n]+rawText/);
});

test('profile import warns against high-risk secrets and identifiers', () => {
  assert.match(page, /マイナンバー/);
  assert.match(page, /パスポート番号/);
  assert.match(page, /銀行口座/);
  assert.match(page, /クレジットカード番号/);
  assert.match(page, /パスワード/);
  assert.match(page, /APIキー/);
});

test('iPhone preview remains within the viewport with 16px inputs', () => {
  assert.match(page, /textarea,\.field input\{[^}]*box-sizing:border-box;font-size:16px/);
  assert.match(page, /\.profile-page\{width:100%\}/);
  assert.match(page, /@media\(max-width:560px\)/);
});

test('JEV errors are explained without blaming user-provided text', () => {
  assert.match(page, /flow_runner_unavailable:'解析サービスに接続できません/);
  assert.match(page, /profile_preview_failed:'JEVの解析処理に失敗しました/);
  assert.match(page, /partial_jev_unavailable/);
});

test('runtime-built review fields receive global-scoped styles and readable iPhone controls', () => {
  assert.match(page, /\.field-grid :global\(\.field label\)/);
  assert.match(page, /\.field-grid :global\(\.field \.meta\)/);
  assert.match(page, /\.field-grid :global\(\.field input\)[^\n]*font-size:16px !important/);
  assert.match(page, /\.profile-page textarea\{font-size:16px !important\}/);
});

test('profile route prevents document-level horizontal scroll without changing other dashboard routes', () => {
  assert.match(page, /:global\(html\),:global\(body\)\{width:100%;max-width:100%;overflow-x:clip\}/);
  assert.match(page, /:global\(\.app\),:global\(\.main\),:global\(\.topbar\)/);
  assert.match(page, /:global\(\.topbar \.page-meta\)/);
});

test('privacy copy reflects labeled-local extraction instead of claiming every name needs JEV', () => {
  assert.match(page, /ラベルが明確な氏名・住所・職業・所属/);
  assert.match(page, /解析結果は自動保存しない/);
});
