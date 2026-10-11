import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const context={window:{}};
vm.runInNewContext(readFileSync(new URL('../public/otsu4/questions.js',import.meta.url),'utf8')+';window.rows=OTSU4_QUESTIONS;',context);
vm.runInNewContext(readFileSync(new URL('../public/otsu4/tests/core.js',import.meta.url),'utf8'),context);
const C=context.window.OTSU4_TOPIC_TESTS,rows=context.window.rows;
const storage=()=>{const data=new Map();return {getItem:k=>data.get(k)||null,setItem:(k,v)=>data.set(k,v)};};
const topic=id=>C.topics.find(t=>t.id===id);

test('every topic resolves to canonical questions and category-only tests cannot spill',()=>{
  for(const t of C.topics){
    if(t.ids)assert.ok(t.ids.every(id=>rows.some(q=>q.id===id)));
    const selected=C.select(rows,t,C.load(storage()));
    assert.ok(selected.length>0&&selected.length<=10,t.id);
    assert.ok(selected.every(q=>C.matches(q,t)),t.id);
    assert.equal(new Set(selected.map(q=>q.concept)).size,selected.length,t.id);
  }
});

test('fresh morning diagnostic preserves the exact 2/1/2/4/1 composition',()=>{
  const selected=C.select(rows,topic('morning'),C.load(storage()));
  assert.equal(selected.length,10);
  for(const [category,n] of Object.entries(topic('morning').quota))assert.equal(selected.filter(q=>q.category===category).length,n);
});

test('weak and unseen modes stay strict even with fewer than ten candidates',()=>{
  const state=C.load(storage());
  for(const q of rows)state.attempts[q.id]=1;
  state.wrong.e01=1;state.ratings.e02='repeat';state.attempts.e03=0;
  assert.deepEqual(Array.from(C.select(rows,topic('electric'),state,'weak'),q=>q.id).sort(),['e01','e02']);
  assert.deepEqual(Array.from(C.select(rows,topic('electric'),state,'unseen'),q=>q.id),['e03']);
  assert.equal(C.select(rows,topic('receiver'),state,'weak').length,0);
});

test('a recent identical item is suppressed and fresh weaknesses outrank unseen peers',()=>{
  const state=C.load(storage()),now=10000000;
  state.attempts.e01=1;state.wrong.e01=1;
  const first=C.select(rows,topic('electric'),state,'smart',now)[0];
  assert.equal(first.id,'e01');
  state.history.push({id:'e01',concept:first.concept,at:now-1000});
  assert.notEqual(C.select(rows,topic('electric'),state,'smart',now)[0].id,'e01');
});

test('correct-but-uncertain becomes an adaptive weakness without overwriting comments or original sessions',()=>{
  const s=storage(),state=C.load(s),q=rows.find(q=>q.id==='e01');
  state.feedbackDrafts.c01='keep this';state.notes.c02='existing note';state.extra='keep';
  s.setItem(C.STATE_KEY,JSON.stringify(state));s.setItem('otsu4-study-session-v1','original session');
  C.record(s,q,true,'unsure','ask in training',123);
  const after=C.load(s);
  assert.equal(after.attempts.e01,1);assert.equal(after.correct.e01,1);
  assert.equal(after.ratings.e01,'repeat');assert.ok(C.weak(q,after));
  assert.equal(after.feedbackDrafts.c01,'keep this');assert.equal(after.notes.c02,'existing note');
  assert.equal(after.notes.e01,'ask in training');assert.equal(after.extra,'keep');
  assert.equal(s.getItem('otsu4-study-session-v1'),'original session');
});

test('grading accepts canonical written aliases, rejects blanks and stores errors for shared weak practice',()=>{
  const q=rows.find(q=>q.id==='p04'),s=storage();
  assert.equal(C.grade(q,'Ｇ 型受信機'),true);assert.equal(C.grade(q,''),false);
  C.record(s,q,false,'ok','',123);
  const state=C.load(s);assert.equal(state.ratings.p04,'weak');assert.equal(state.history[0].subject,'practical');
});
