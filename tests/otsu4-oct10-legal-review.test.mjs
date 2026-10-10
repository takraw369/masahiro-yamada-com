import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
const read=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');
const context={window:{}};
vm.runInNewContext(read('public/otsu4/questions.js')+';window.ROWS=OTSU4_QUESTIONS;',context);
vm.runInNewContext(read('public/otsu4/tests/core.js'),context);
const rows=context.window.ROWS,core=context.window.OTSU4_TOPIC_TESTS;
const ids=["l38","l39","l40","l41","l42","l43","l44","l45"];
const answers={"l38":0,"l39":2,"l40":1,"l41":3,"l42":0,"l43":2,"l44":3,"l45":2};
test('October legal scenarios are unique and provide four reviewed explanations each',()=>{
 assert.equal(new Set(rows.map(q=>q.id)).size,rows.length);
 for(const id of ids){
  const q=rows.find(row=>row.id===id);
  assert.ok(q,id);
  assert.equal(q.category,'law-common');
  assert.equal(q.answer,answers[id],id);
  assert.equal(q.choices.length,4,id);
  assert.equal(q.choiceNotes.length,4,id);
  assert.ok(q.choiceNotes.every(note=>note.length>=15),id);
  assert.match(q.source.url,/^https:\/\//);
  assert.doesNotMatch(q.question,/危険物取扱者/);
  assert.equal(q.lectureMarked,false);
 }
});
test('eight scenarios are available in dedicated and law-all quizzes without changing old IDs',()=>{
 const t=core.topics.find(t=>t.id==='photo-law-20261010');
 assert.ok(t);
 assert.deepEqual(Array.from(t.ids),ids);
 assert.equal(rows.filter(q=>core.matches(q,t)).length,8);
 assert.ok(['l32','l33','l34','l35','l36','l37'].every(id=>rows.some(q=>q.id===id)));
 const law=core.topics.find(t=>t.id==='law-all');
 const s=core.load({getItem:()=>null});
 const all=core.select(rows,law,s,'smart',Date.now(),'all');
 assert.ok(ids.every(id=>all.some(q=>q.id===id)));
 assert.equal(all.length,rows.filter(q=>q.category.startsWith('law-')).length);
 assert.match(read('src/pages/otsu4/hourei/index.astro'),/photo-law-20261010/);
});
test('old learning records remain readable and existing IDs are unchanged',()=>{
 const memory=new Map(),store={getItem:k=>memory.get(k)||null,setItem:(k,v)=>memory.set(k,v)};
 const s=core.load(store);
 s.attempts.l29=2;s.notes.l30='過去のメモ';
 store.setItem(core.STATE_KEY,JSON.stringify(s));
 core.select(rows,core.topics.find(t=>t.id==='photo-law-20261010'),core.load(store));
 assert.equal(store.getItem(core.STATE_KEY),JSON.stringify(s));
});
