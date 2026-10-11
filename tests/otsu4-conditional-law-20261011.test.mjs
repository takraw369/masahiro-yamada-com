import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
const context={window:{}};
vm.runInNewContext(read('public/otsu4/questions.js')+';window.rows=OTSU4_QUESTIONS;',context);
vm.runInNewContext(read('public/otsu4/tests/core.js'),context);
const rows=context.window.rows,engine=context.window.OTSU4_TOPIC_TESTS;
const ids=["l46","l47","l48"];
const answers={"l46":1,"l47":3,"l48":2};
test('three conditional fire-law questions have unique IDs, one correct answer, four option notes and original references',()=>{
 assert.equal(new Set(rows.map(q=>q.id)).size,rows.length);
 for(const id of ids) {
  const q=rows.find(q=>q.id===id);
  assert.ok(q,id);assert.equal(q.category,'law-common');
  assert.equal(q.answer,answers[id]);assert.equal(q.choices.length,4);
  assert.equal(q.choiceNotes.length,4);
  assert.ok(q.choiceNotes.every(t=>t.length>=18));
  assert.match(q.source.url,/laws\.e-gov\.go\.jp\/law\/336CO0000000037/);
 }
});
test('dedicated confirmed-law review topic works and preserves old legal quizzes',()=>{
 const topic=engine.topics.find(t=>t.id==='photo-law-reviewed-20261011');
 assert.ok(topic);assert.deepEqual(Array.from(topic.ids),ids);
 const store={getItem:()=>null};
 const pool=engine.select(rows,topic,engine.load(store));
 assert.equal(pool.length,3);
 assert.deepEqual(Array.from(pool,q=>q.id).sort(),[...ids].sort());
 const previous=engine.topics.find(t=>t.id==='photo-law-20261010');
 assert.ok(previous);assert.equal(previous.ids.length,8);
 assert.equal(rows.filter(q=>engine.matches(q,previous)).length,8);
 const law=engine.topics.find(t=>t.id==='law-all');
 const all=engine.select(rows,law,engine.load(store),'smart',Date.now(),'all');
 assert.ok(ids.every(id=>all.some(q=>q.id===id)));
 assert.match(read('src/pages/otsu4/hourei/index.astro'),/photo-law-reviewed-20261011/);
});