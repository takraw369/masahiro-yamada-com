import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
import { prepareXComposeReview, isCurrentXComposeReview } from '../src/lib/xComposerReview.ts';

const now = Date.parse('2026-10-11T10:00:00Z');
const accounts = [{ id:'a', username:'masa', isActive:true }, { id:'b', username:'other', isActive:true }, { id:'closed', username:'closed', isActive:false }];
const draft = { text:'一次体験から、一つを届ける。\n\n次に試すことは？', accountId:'a', mode:'now', scheduledAt:'' };

test('review preserves the exact outgoing copy and resolves the actual connected account', () => {
  assert.deepEqual(prepareXComposeReview(draft, accounts, now), { ...draft, username:'masa' });
  assert.equal(prepareXComposeReview({ ...draft, scheduledAt:'stale-unused-date' }, accounts, now).scheduledAt, '');
});
test('review rejects blank or oversized copy and unavailable accounts before submission', () => {
  for (const value of [{...draft,text:' \n '},{...draft,text:'あ'.repeat(281)},{...draft,accountId:'missing'},{...draft,accountId:'closed'}]) assert.throws(() => prepareXComposeReview(value,accounts,now));
  assert.equal(prepareXComposeReview({...draft,text:'あ'.repeat(280)},accounts,now).text.length,280);
});
test('scheduled review requires a valid future time and expires if left open past that time', () => {
  for (const scheduledAt of ['', 'invalid', '2026-10-11T09:59:00Z', '2026-10-11T10:00:00Z']) assert.throws(() => prepareXComposeReview({...draft,mode:'schedule',scheduledAt},accounts,now));
  const value = {...draft,mode:'schedule',scheduledAt:'2026-10-11T11:00:00Z'};
  const review = prepareXComposeReview(value,accounts,now);
  assert.equal(isCurrentXComposeReview(review,value,accounts,now),true);
  assert.equal(isCurrentXComposeReview(review,value,accounts,Date.parse(value.scheduledAt)),false);
});
test('editing copy, changing destination or mode, and revoked connections invalidate a review', () => {
  const review = prepareXComposeReview(draft,accounts,now);
  for (const value of [{...draft,text:'新しい本文'},{...draft,accountId:'b'},{...draft,mode:'schedule',scheduledAt:'2026-10-11T11:00:00Z'}]) assert.equal(isCurrentXComposeReview(review,value,accounts,now),false);
  assert.equal(isCurrentXComposeReview(review,draft,accounts.map(a=>({...a,isActive:false})),now),false);
});
test('phone layout puts the editor before supporting tools and retains drafts behind both tabs', async () => {
  const page = await readFile(new URL('../src/pages/dashboard/post.astro',import.meta.url),'utf8');
  const composer = await readFile(new URL('../src/components/dashboard/XCommandCenter.tsx',import.meta.url),'utf8');
  const css = await readFile(new URL('../src/styles/x-composer.css',import.meta.url),'utf8');
  assert.ok(page.indexOf('<XOperationsCenter') < page.indexOf('<PostDraftShelf'));
  assert.match(composer, /hidden=\{tab !== 'compose'\}/);
  assert.match(composer, /isCurrentXComposeReview\(review, value, accounts\)/);
  assert.match(css, /minmax\(0,1fr\)/);
  assert.match(css, /box-sizing:border-box/);
  assert.match(css, /font-size:16px!important/);
  assert.match(css, /min-height:44px/);
});

test('motion feedback honors reduced-motion without depending on motion for review or success', async () => {
  const css = await readFile(new URL('../src/styles/x-composer.css',import.meta.url),'utf8');
  const reduced = css.slice(css.indexOf('@media(prefers-reduced-motion:reduce)'));
  assert.match(reduced, /animation:none!important/);
  assert.match(reduced, /transition:none!important/);
  assert.match(reduced, /button:active\{transform:none\}/);
  assert.match(css, /\.x-review\{animation:x-quiet-fade/);
  assert.match(css, /\.x-status-ok\{animation:x-success/);
  assert.doesNotMatch(css, /animation[^;}]*infinite/);
});
