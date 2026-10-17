import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
import { CONTENT_LIBRARY_KEY, readContentLibrary, mergeContentLibrary, saveXTextDraft, isResumableXDraft, contentLibraryError } from '../src/lib/contentLibrary.ts';

const row = (id, extra = {}) => ({ id, platform:'x', category:null, text:'既存の本文', title:'既存の題名', scheduledHour:null, status:'draft', createdAt:'2026-10-17T00:00:00Z', order:0, ...extra });
function storage(posts = []) {
  const values = new Map([[CONTENT_LIBRARY_KEY, JSON.stringify(posts)]]);
  return { values, getItem(key) { return values.get(key) ?? null; }, setItem(key, value) { values.set(key, value); } };
}

test('explicit X save uses the existing library and preserves exact text and unrelated records', () => {
  const originals = [row('line', {platform:'line', lineAccountId:'line-id'}), row('sent', {status:'sent', extraMetadata:{keep:true}})];
  const store = storage(originals), text = '  自分の言葉\n\n一つずつ。 👣  ';
  const item = saveXTextDraft(store, text, 'actual-account');
  assert.equal(item.text, text);assert.equal(item.xAccountId, 'actual-account');
  assert.equal(item.scheduledHour, null);assert.equal(item.status, 'draft');
  assert.deepEqual(readContentLibrary(store).slice(1), originals);
  assert.deepEqual([...store.values.keys()], ['ace-content-lib'], 'no second draft store');
});

test('updating a resumed draft retains its identity, provenance and unrelated concurrent additions', () => {
  const original = row('draft', {sourceAssetId:'SOURCE-QA', xAccountId:'first', custom:{rights:'preserve'}});
  const store = storage([original]);
  const added = saveXTextDraft(store, '別の画面から追加', 'other');
  const updated = saveXTextDraft(store, '編集後の本文', 'second', original);
  assert.equal(updated.id, original.id);assert.equal(updated.createdAt, original.createdAt);
  assert.deepEqual(updated.custom, original.custom);assert.equal(updated.sourceAssetId, original.sourceAssetId);
  assert.equal(readContentLibrary(store).find(p=>p.id===added.id).text, added.text);
  assert.equal(readContentLibrary(store).length, 2);
});

test('stale text, deleted records and no-op saves cannot overwrite or falsely claim a save', () => {
  for (const latest of [[row('one',{text:'別の更新'})], []]) {
    for (const text of ['自分の更新', '既存の本文']) {
      const previous=row('one'),store=storage(latest),before=store.getItem(CONTENT_LIBRARY_KEY);
      assert.throws(()=>saveXTextDraft(store,text,'account',previous),/content_library_conflict/);
      assert.equal(store.getItem(CONTENT_LIBRARY_KEY),before);
    }
  }
});

test('scheduled, sending, sent and LINE items are never Composer resume/update targets', () => {
  for (const item of [row('one',{status:'scheduled'}),row('one',{status:'sending'}),row('one',{status:'sent'}),row('one',{scheduledHour:'2030-01-01T12:00'}),row('one',{platform:'line'}),row('one',{text:' \n '})]) {
    assert.equal(isResumableXDraft(item),false);
    const store=storage([item]);assert.throws(()=>saveXTextDraft(store,'new','account',item),/x_draft_not_editable/);
  }
});

test('corrupt storage, unexpected records and duplicate IDs fail without replacing original bytes', () => {
  for (const raw of ['{','null','{}',JSON.stringify([row('same'),row('same')]),JSON.stringify([row('bad',{text:42})])]) {
    const store=storage();store.values.set(CONTENT_LIBRARY_KEY,raw);
    assert.throws(()=>readContentLibrary(store),/content_library_invalid/);
    assert.throws(()=>saveXTextDraft(store,'keep this text','account'),/content_library_invalid/);
    assert.equal(store.getItem(CONTENT_LIBRARY_KEY),raw);
  }
});

test('storage read/write failures remain failures and offer copy recovery', () => {
  for (const store of [{getItem(){throw Error('blocked');},setItem(){throw Error('unreachable');}}, {getItem(){return '[]';},setItem(){throw Error('quota');}}]) {
    assert.throws(()=>saveXTextDraft(store,'本文は画面に保持','account'));
  }
  assert.match(contentLibraryError(Error('quota')),/コピー/);
  assert.match(contentLibraryError(Error('content_library_conflict')),/新しい下書きとして保存/);
  assert.match(contentLibraryError(Error('content_library_conflict'),'scheduler'),/このページを再読み込み/);
  assert.doesNotMatch(contentLibraryError(Error('content_library_conflict'),'scheduler'),/新しい下書きとして保存/);
  for (const text of ['', ' \n ', 'あ'.repeat(281)]) assert.throws(()=>saveXTextDraft(storage(),text,'account'),/x_draft_text_invalid/);
});

test('legacy Scheduler updates merge only its delta, preserving new drafts and unrelated newer edits', () => {
  const base=[row('x'),row('line',{platform:'line'})],store=storage(base);
  const newerLine={...base[1],text:'別の画面で更新したLINE'};
  mergeContentLibrary(store,base,[base[0],newerLine]);
  const added=saveXTextDraft(store,'Composerで保存したX','account');
  const merged=mergeContentLibrary(store,base,[{...base[0],scheduledHour:'2030-01-01T12:00',status:'scheduled'},base[1]]);
  assert.equal(merged.find(p=>p.id===added.id).text,added.text);
  assert.equal(merged.find(p=>p.id==='line').text,newerLine.text);
  assert.equal(merged.find(p=>p.id==='x').status,'scheduled');
});

test('deleting or reordering a stale Scheduler row cannot erase another edit', () => {
  const base=[row('one'),row('two',{order:1})],store=storage([{...base[0],text:'新しい更新'},base[1]]);
  const before=store.getItem(CONTENT_LIBRARY_KEY);
  assert.throws(()=>mergeContentLibrary(store,base,[base[1]]),/content_library_conflict/);
  assert.throws(()=>mergeContentLibrary(store,base,[{...base[0],order:2},base[1]]),/content_library_conflict/);
  assert.equal(store.getItem(CONTENT_LIBRARY_KEY),before);
});

test('successful publication state can retire only the exact saved draft; later edits are protected', () => {
  const item=row('one'),store=storage([item]);
  mergeContentLibrary(store,[item],[{...item,status:'sent'}]);
  assert.equal(readContentLibrary(store).filter(isResumableXDraft).length,0);
  const other=storage([{...item,text:'投稿中に別画面で追記'}]);
  assert.throws(()=>mergeContentLibrary(other,[item],[{...item,status:'sent'}]),/content_library_conflict/);
  assert.equal(readContentLibrary(other)[0].text,'投稿中に別画面で追記');
});

test('Composer save/restore stays local and keeps the existing explicit publication review', async () => {
  const composer=await readFile(new URL('../src/components/dashboard/XCommandCenter.tsx',import.meta.url),'utf8');
  const scheduler=await readFile(new URL('../src/components/dashboard/ContentScheduler.tsx',import.meta.url),'utf8');
  assert.match(composer,/saveXTextDraft\(localStorage/);
  assert.match(composer,/window\.confirm\('編集中の本文/);
  assert.match(composer,/setReview\(null\); setText\(latest.text\)/);
  assert.match(composer,/beforeunload/);
  assert.match(composer,/isCurrentXComposeReview\(review, value, accounts\)/);
  assert.doesNotMatch(composer.slice(composer.indexOf('function saveLocalDraft'),composer.indexOf('const value =')),/fetch\(/);
  assert.match(scheduler,/mergeContentLibrary\(localStorage, base, next\)/);
  assert.match(scheduler,/if \(!updateLib\(\[item, \.\.\.lib\]\)\) return/);
});
