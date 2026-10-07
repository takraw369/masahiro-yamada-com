import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';

test('MASA design language is reusable and opt-in', async () => {
  const tokens = await readFile(new URL('../src/styles/masa-design-language.css', import.meta.url), 'utf8');
  const layout = await readFile(new URL('../src/layouts/DashboardLayout.astro', import.meta.url), 'utf8');
  const page = await readFile(new URL('../src/pages/dashboard/index.astro', import.meta.url), 'utf8');

  assert.match(tokens, /--masa-night-0:/);
  assert.match(tokens, /--masa-surface:/);
  assert.match(tokens, /--masa-gold:/);
  assert.match(tokens, /--masa-cyan:/);
  assert.match(tokens, /\.masa-world\s*\{/);
  assert.match(layout, /masa-design-language\.css/);
  assert.match(page, /class="dash-shell masa-world"/);
});

test('depth treatment keeps mobile action-first guardrails', async () => {
  const page = await readFile(new URL('../src/pages/dashboard/index.astro', import.meta.url), 'utf8');
  const standard = await readFile(new URL('../docs/dashboard-mobile-ui-standard.md', import.meta.url), 'utf8');

  assert.match(page, /@media\(max-width:620px\)\{\.dash-shell\{/);
  assert.match(page, /\.dash-head\{display:none\}/);
  assert.match(page, /safe-area-inset-bottom/);
  assert.match(standard, /Design depth never outranks action/);
  assert.match(standard, /Reusable style becomes grammar/);
});
