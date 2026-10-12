import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const read = path => readFileSync(new URL('../' + path, import.meta.url), 'utf8');
const context = {window:{}};
vm.runInNewContext(read('public/otsu4/questions.js') + ';window.rows=OTSU4_QUESTIONS;', context);
vm.runInNewContext(read('public/otsu4/tests/core.js'), context);
const rows=context.window.rows;
const engine=context.window.OTSU4_TOPIC_TESTS;
const ids=['l69','l70','l71','l72'];
const correct={l69:1,l70:2,l71:1,l72:1};

test('10/12 No.1 photo markers are four original case-law problems with correct legal references',()=>{
  assert.equal(new Set(rows.map(q=>q.id)).size,rows.length);
  for(const id of ids) {
    const q=rows.find(row=>row.id===id);
    assert.ok(q,id);
    assert.equal(q.category,'law-common');
    assert.equal(q.answer,correct[id]);
    assert.equal(q.choices.length,4);
    assert.equal(q.choiceNotes.length,4);
    assert.ok(q.choiceNotes.every(v=>v.length>15));
    assert.equal(q.paperMarked,true);
    assert.ok(q.paperMarkLabels[0].includes('No.1'));
    assert.match(q.source.url,/^https:\/\/laws\.e-gov\.go\.jp\/law\//);
    for(let i=0;i<4;i++)assert.equal(engine.grade(q,i),i===q.answer);
  }
  assert.deepEqual(ids.map(id=>rows.find(q=>q.id===id).paperQuestions[0]),[
    '20261012-No1-Q11','20261012-No1-Q11','20261012-No1-Q12','20261012-No1-Q12'
  ]);
});

test('new focused topic uses the existing score and weak-first engine without duplicate questions',()=>{
  const t=engine.topics.find(t=>t.id==='paper-marks-20261012-no1');
  assert.ok(t);
  assert.deepEqual(Array.from(t.ids),ids);
  const memory=new Map(), storage={getItem:k=>memory.get(k)||null,setItem:(k,v)=>memory.set(k,v)};
  const chosen=engine.select(rows,t,engine.load(storage));
  assert.equal(chosen.length,4);
  assert.deepEqual(new Set(chosen.map(q=>q.id)),new Set(ids));
  let s=engine.load(storage),q=rows.find(q=>q.id==='l69');
  assert.equal(s.attempts[q.id],undefined);
  assert.equal(engine.weak(q,s),true);
  s=engine.record(storage,q,true,'ok','',100);
  assert.equal(engine.weak(q,s),true);
  s=engine.record(storage,q,true,'ok','',200);
  assert.equal(engine.weak(q,s),false);
  assert.equal(s.correct[q.id],2);
});

test('older paper No.11 metadata and original law topics remain untouched',()=>{
  const previous=rows.find(q=>q.id==='c26');
  assert.ok(previous.paperQuestions.includes('11'));
  assert.ok(!previous.paperQuestions.includes('20261012-No1-Q11'));
  assert.ok(engine.topics.some(t=>t.id==='paper-mistakes-20261011'));
  const law=engine.topics.find(t=>t.id==='law-all');
  const all=engine.select(rows,law,engine.load({getItem:()=>null}),'smart',Date.now(),'all');
  assert.ok(ids.every(id=>all.some(q=>q.id===id)));
});
