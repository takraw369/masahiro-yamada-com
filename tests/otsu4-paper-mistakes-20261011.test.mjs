import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
const context={window:{}};
vm.runInNewContext(read('public/otsu4/questions.js')+';window.rows=OTSU4_QUESTIONS;',context);
vm.runInNewContext(read('public/otsu4/tests/core.js'),context);
const rows=context.window.rows, engine=context.window.OTSU4_TOPIC_TESTS;
const fresh=[...Array(11)].map((_,i)=>'l'+(49+i));
const expectedAnswers={l49:2,l50:0,l51:3,l52:2,l53:1,l54:0,l55:1,l56:3,l57:1,l58:2,l59:1};
test('new paper weak-point questions are legally sourced and explain every option',()=>{
 assert.equal(new Set(rows.map(q=>q.id)).size,rows.length);
 for(const id of fresh){
  const q=rows.find(row=>row.id===id);
  assert.ok(q,id);assert.equal(q.category,'law-common');
  assert.equal(q.answer,expectedAnswers[id],id);
  assert.equal(q.choices.length,4,id);
  assert.equal(q.choiceNotes.length,4,id);
  assert.ok(q.choiceNotes.every(note=>note.length>=15),id);
  assert.equal(q.paperMarked,true,id);
  assert.ok(q.paperQuestions.length>0,id);
  assert.match(q.source.url,/^https:\/\//,id);
  assert.equal(engine.grade(q,q.answer),true,id);
  for(let a=0;a<4;a++)if(a!==q.answer)assert.equal(engine.grade(q,a),false,id);
 }
});
test('marked papers map 15 original question numbers to a dedicated adaptive test',()=>{
 const topic=engine.topics.find(t=>t.id==='paper-mistakes-20261011');
 assert.ok(topic);
 const paperNumbers=new Set(topic.ids.flatMap(id=>rows.find(q=>q.id===id).paperQuestions));
 assert.deepEqual(Array.from(paperNumbers).sort(),['2','10','11','15','17','22','24','25','26','27','30','32','33','35','39'].sort());
 assert.equal(topic.ids.length,27);
 const s=engine.load({getItem:()=>null});
 const selected=engine.select(rows,topic,s);
 assert.equal(selected.length,10);
 assert.ok(selected.every(q=>q.paperMarked));
 assert.equal(new Set(selected.map(q=>q.concept)).size,10);
 assert.ok(topic.ids.every(id=>rows.some(q=>q.id===id)));
});
test('paper marks start as weak without fabricating app score; two correct answers clear the weakness',()=>{
 const stateMap=new Map();const store={getItem:k=>stateMap.get(k)||null,setItem:(k,v)=>stateMap.set(k,v)};
 const q=rows.find(q=>q.id==='l49');
 let state=engine.load(store);
 assert.equal(engine.weak(q,state),true);
 assert.equal(state.wrong[q.id],undefined);
 state=engine.record(store,q,true,'ok','',100);
 assert.equal(engine.weak(q,state),true);
 state=engine.record(store,q,true,'ok','',200);
 assert.equal(engine.weak(q,state),false);
 assert.equal(state.correct[q.id],2);
});
test('historical law topics and marks are retained',()=>{
 const original=engine.topics.find(t=>t.id==='photo-law-reviewed-20261011');
 assert.deepEqual(Array.from(original.ids),['l46','l47','l48']);
 assert.equal(engine.topics.find(t=>t.id==='photo-law-20261010').ids.length,8);
 const old=rows.find(q=>q.id==='c01');
 assert.ok(old&&!old.paperMarked);
 const law=engine.topics.find(t=>t.id==='law-all');
 const all=engine.select(rows,law,engine.load({getItem:()=>null}),'smart',Date.now(),'all');
 assert.ok(fresh.every(id=>all.some(q=>q.id===id)));
});
