import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';

const home = await readFile(new URL('../src/pages/dashboard/index.astro', import.meta.url), 'utf8');
const nudge = home.match(/<section class="home-asset-nudge"[^]*?<\/section>/)?.[0] || '';
const styles = home.match(/<style>[^]*?<\/style>/)?.[0] || '';

test('slide-asset nudge appears visibly above the app shelf, even on mobile', () => {
  assert.ok(nudge, 'expected a single visible home-asset-nudge section');
  assert.equal((home.match(/<section class="home-asset-nudge"/g) || []).length, 1);
  assert.ok(home.indexOf('<section class="home-asset-nudge"') < home.indexOf('<section class="home-app-shelf"'));
  assert.ok(home.indexOf('<section class="home-asset-nudge"') < home.indexOf('class="home-layout-grid"'));
  assert.match(nudge, /aria-labelledby="home-asset-nudge-title"/);
  assert.match(nudge, /id="home-asset-nudge-title"/);
  assert.match(styles, /@media\(max-width:590px\)/);
});

test('nudge links to the existing, verified Drive assets and registration guide', () => {
  assert.match(nudge, /https:\/\/drive\.google\.com\/drive\/folders\/1JdWD5OtfIZjNhZOZsDN7HFEFOhDyxK0k/);
  assert.match(nudge, /https:\/\/docs\.google\.com\/document\/d\/1Qapwgi6Bmc_11oP-iTkG0P7aA29Qdt1tICgpzsZwjSw\/edit/);
  assert.equal((nudge.match(/target="_blank" rel="noopener noreferrer"/g) || []).length, 2);
  assert.match(nudge, /名前・好きな理由・使い道・出典／利用権利/);
  assert.match(nudge, /重複保存はしない/);
});

test('nudge is accessible and cannot falsely claim curation was saved', () => {
  assert.match(styles, /\.home-asset-nudge-actions a\{[^}]*min-height:44px/);
  assert.match(styles, /\.home-asset-nudge-actions a:focus-visible/);
  assert.match(styles, /var\(--preset-paper/);
  assert.match(styles, /var\(--preset-ink/);
  assert.doesNotMatch(nudge, /<button|<form|onClick=|fetch\(|完了済み|保存しました/);
  assert.doesNotMatch(nudge, /role="button"/);
});
