import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const css = readFileSync(new URL('../src/styles/knowledge-os.css', import.meta.url), 'utf8');
const rule = (selector) => {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const match = css.match(new RegExp(escaped + '\\{([^}]+)\\}'));
  assert.ok(match, 'missing CSS rule: ' + selector);
  return match[1];
};

test('FLOW MIND Ask overlay fits the viewport and scrolls long answers', () => {
  assert.match(rule('.ko-command'), /inset:0/);
  assert.match(rule('.ko-command'), /box-sizing:border-box/);
  assert.match(rule('.ko-command-card'), /max-height:100%/);
  assert.match(rule('.ko-command-card'), /flex-direction:column/);
  assert.match(rule('.ko-command-card'), /overflow:hidden/);
  assert.match(rule('.ko-command-list'), /min-height:0/);
  assert.match(rule('.ko-command-list'), /overflow-y:auto/);
  assert.match(rule('.ko-command-list'), /-webkit-overflow-scrolling:touch/);
  assert.match(rule('.ko-command-card input'), /font-size:16px/);
});
