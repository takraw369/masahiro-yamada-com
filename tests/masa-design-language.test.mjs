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
  assert.match(page, /class="dash-shell"/);
  assert.doesNotMatch(page, /class="dash-shell masa-world"/);
});

test('depth treatment keeps mobile action-first guardrails', async () => {
  const page = await readFile(new URL('../src/pages/dashboard/index.astro', import.meta.url), 'utf8');
  const standard = await readFile(new URL('../docs/dashboard-mobile-ui-standard.md', import.meta.url), 'utf8');

  assert.match(page, /@media\(max-width:620px\)\{\.dash-head\{display:none\}/);
  assert.match(page, /\.dash-head\{display:none\}/);
  const layout = await readFile(new URL('../src/layouts/DashboardLayout.astro', import.meta.url), 'utf8');
  assert.match(layout, /safe-area-inset-bottom/);
  assert.match(standard, /Design depth never outranks action/);
  assert.match(standard, /Reusable style becomes grammar/);
});

test('Dashboard stays readable and puts one high-contrast quest in the task widget', async () => {
  const page = await readFile(new URL('../src/pages/dashboard/index.astro', import.meta.url), 'utf8');
  const cockpit = await readFile(new URL('../src/components/dashboard/DashboardCockpit.tsx', import.meta.url), 'utf8');
  assert.doesNotMatch(page, /class="dash-shell masa-world"/);
  assert.match(cockpit, /className="primary-focus masa-world"/);
  assert.match(cockpit, /focus-signals/);
  assert.match(cockpit, /nowTasks\.length/);
  assert.match(cockpit, /nextTasks\.length/);
  assert.match(cockpit, /waitTasks\.length/);
  assert.match(cockpit, /このTaskをGPTで着手・相談/);
  assert.match(cockpit, /encodeURIComponent\(primaryTask\.taskId\)/);
  assert.match(cockpit, /\.focus-cta\{min-height:46px/);
  assert.match(cockpit, /\.primary-focus\.masa-world \.focus-next-copy/);
});

test('iPhone cockpit CTA stays inside the task card at narrow widths', async () => {
  const cockpit = await readFile(new URL('../src/components/dashboard/DashboardCockpit.tsx', import.meta.url), 'utf8');
  const page = await readFile(new URL('../src/pages/dashboard/index.astro', import.meta.url), 'utf8');
  assert.match(cockpit, /\.cockpit,\.cockpit \*,\.cockpit \*::before,\.cockpit \*::after\{box-sizing:border-box\}/);
  assert.match(cockpit, /\.focus-cta\{[^}]*width:100%;max-width:100%;min-width:0;box-sizing:border-box/);
  assert.match(cockpit, /\.focus-cta span\{[^}]*flex:0 0 auto/);
  assert.match(cockpit, /\.primary-focus\.masa-world\{[^}]*max-width:100%;min-width:0;box-sizing:border-box/);
  assert.match(cockpit, /\.focus-next-copy\{[^}]*overflow-wrap:anywhere/);
  assert.match(page, /eyebrow="MASA OS · TODAY"/);
});
