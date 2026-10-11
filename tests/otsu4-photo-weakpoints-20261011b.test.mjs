import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';

const read = path => readFileSync(new URL('../'+path, import.meta.url), 'utf8');
function load() {
  const ctx={window:{}};
  vm.runInNewContext(
    read('public/otsu4/questions.js')+'\n'+
    read('public/otsu4/photo-weakpoints-20261011b.js')+
    '\nwindow.rows=OTSU4_QUESTIONS;',ctx
  );
  vm.runInNewContext(read('public/otsu4/tests/core.js'),ctx);
  return {rows:ctx.window.rows,core:ctx.window.OTSU4_TOPIC_TESTS};
}
const ids=['l60','l61','l62','l63','l64','l65'];

test('new marked-paper questions are original, fully reasoned, sourced and uniquely identified', () => {
  const {rows,core}=load();
  assert.equal(new Set(rows.map(q=>q.id)).size,rows.length);
  for(const id of ids){
    const q=rows.find(x=>x.id===id);
    assert.ok(q,id);
    assert.equal(q.category,'law-common');
    assert.equal(q.choices.length,4);
    assert.equal(q.choiceNotes.length,4);
    assert.ok(q.choiceNotes.every(reason=>reason.length>20));
    assert.equal(q.paperMarked,true);
    assert.equal(q.freshPaperFocus,true);
    assert.ok(q.guide);
    assert.match(q.source.url,/^https:\/\//);
    assert.equal(core.grade(q,q.answer),true);
    for(let answer=0;answer<4;answer++)if(answer!==q.answer)assert.equal(core.grade(q,answer),false,id);
  }
});
test('new focused session reuses existing questions and starts with six newly marked concepts',()=>{
  const {rows,core}=load();
  const topic=core.topics.find(q=>q.id==='paper-weakpoints-20261011b');
  assert.ok(topic);
  assert.ok(topic.ids.every(id=>rows.some(q=>q.id===id)));
  assert.ok(topic.ids.includes('l57') && topic.ids.includes('l55'));
  const selected=core.select(rows,topic,core.load({getItem:()=>null}));
  assert.equal(selected.length,10);
  assert.deepEqual(selected.slice(0,6).map(q=>q.id),ids);
  assert.equal(new Set(selected.map(q=>q.concept)).size,10);
});
test('paper marks are not fabricated wrong answers and two confident correct attempts release the weakness',()=>{
  const {rows,core}=load();
  const q=rows.find(x=>x.id==='l60');
  const data=new Map();
  const storage={getItem:k=>data.get(k)||null,setItem:(k,v)=>data.set(k,v)};
  const start=core.load(storage);
  assert.equal(start.wrong[q.id],undefined);
  assert.equal(core.weak(q,start),true);
  let s=core.record(storage,q,true,'ok','',1000);
  assert.equal(core.weak(q,s),true);
  s=core.record(storage,q,true,'ok','',2000);
  assert.equal(core.weak(q,s),false);
  assert.equal(s.wrong[q.id],0);
});
test('guide and app are linked in tests/home without rewriting old question DB',()=>{
  const tests=read('src/pages/otsu4/tests/index.astro');
  const home=read('src/pages/otsu4/index.astro');
  const app=read('public/otsu4/tests/app.js');
  const guide=read('src/pages/otsu4/weakpoints/index.astro');
  const source='/otsu4/photo-weakpoints-20261011b.js';
  for(const page of [tests,home])assert.ok(page.includes(source));
  assert.ok(tests.indexOf('/otsu4/questions.js')<tests.indexOf(source));
  assert.ok(tests.indexOf(source)<tests.indexOf('/otsu4/tests/core.js'));
  assert.match(app,/deep\.hidden=!section/);
  for(const section of ['command','classifications','mixed','inspection','retro','qualification']){
    assert.ok(guide.includes('id="'+section+'"'));
  }
});
