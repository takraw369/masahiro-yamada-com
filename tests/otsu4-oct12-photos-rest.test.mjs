import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
const context={window:{}};
vm.runInNewContext(read('public/otsu4/questions.js')+';window.rows=OTSU4_QUESTIONS;',context);
vm.runInNewContext(read('public/otsu4/tests/core.js'),context);
const rows=context.window.rows, engine=context.window.OTSU4_TOPIC_TESTS;
const byId=id=>rows.find(q=>q.id===id);
const fresh=['l73','l74','l75','l76','l77'];
const answers={l73:2,l74:1,l75:2,l76:3,l77:1};
const marks={
  'No.2':['Q13'],
  'No.3':['Q26','Q27','Q32'],
  'No.4':['Q37','Q40','Q41','Q42','Q43'],
  'No.5':['Q46','Q53','Q54','Q55','Q56'],
  '拡大':['Q17','Q18']
};

test('five original October 12 case problems explain all options and cite legal authorities',()=>{
  assert.equal(new Set(rows.map(q=>q.id)).size, rows.length);
  for(const id of fresh){
    const q=byId(id);
    assert.ok(q,id);
    assert.equal(q.category,'law-common',id);
    assert.equal(q.answer,answers[id],id);
    assert.equal(q.choices.length,4,id);
    assert.equal(q.choiceNotes.length,4,id);
    assert.ok(q.choiceNotes.every(x=>x.length>=15),id);
    assert.match(q.source.url,/^https:\/\//,id);
    assert.equal(q.paperMarked,true,id);
    assert.ok(q.paperQuestions.every(x=>x.startsWith('20261012-')),id);
    for(let i=0;i<4;i++)assert.equal(engine.grade(q,i),i===q.answer,id);
  }
});

test('all 16 marked photo questions are routed to focused quiz, with no option circles mistaken for review marks',()=>{
  const topic=engine.topics.find(t=>t.id==='paper-marks-20261012-no2to5');
  assert.ok(topic);
  assert.equal(new Set(topic.ids).size,topic.ids.length);
  assert.ok(fresh.every(id=>topic.ids.includes(id)));
  assert.ok(topic.ids.every(id=>byId(id)?.paperMarked));
  const actuallyMarked=new Set(topic.ids.flatMap(id=>byId(id).paperQuestions||[]));
  for(const [sheet,numbers] of Object.entries(marks))for(const number of numbers)
    assert.ok(actuallyMarked.has('20261012-'+sheet+'-'+number),sheet+'-'+number);
  assert.equal(actuallyMarked.has('20261012-No.4-Q8'),false);
  const s=engine.load({getItem:()=>null});
  const picked=engine.select(rows,topic,s);
  assert.equal(picked.length,10);
  assert.equal(new Set(picked.map(q=>q.id)).size,10);
});

test('paper marks are review hints, not fabricated wrong answers, and clear after two confident correct answers',()=>{
  const memory=new Map(), storage={getItem:k=>memory.get(k)||null,setItem:(k,v)=>memory.set(k,v)};
  const q=byId('l73');
  let s=engine.load(storage);
  assert.equal(s.wrong[q.id],undefined);
  assert.equal(engine.weak(q,s),true);
  s=engine.record(storage,q,true,'ok','',100);
  assert.equal(engine.weak(q,s),true);
  s=engine.record(storage,q,true,'ok','',200);
  assert.equal(engine.weak(q,s),false);
  assert.equal(s.wrong[q.id],undefined);
});

test('previous sheet identifiers and law question IDs are unchanged',()=>{
  const previous=byId('l55');
  assert.ok(previous.paperQuestions.includes('35'));
  assert.ok(previous.paperQuestions.includes('20261012-No.5-Q46'));
  assert.ok(byId('l54').paperQuestions.includes('20261012-No.4-Q37'));
  assert.ok(engine.topics.some(x=>x.id==='paper-mistakes-20261011'));
  assert.deepEqual(Array.from(engine.topics.find(x=>x.id==='paper-marks-20261012-no1').ids),['l69','l70','l71','l72']);
  const all=engine.select(rows,engine.topics.find(t=>t.id==='law-all'),engine.load({getItem:()=>null}),'smart',Date.now(),'all');
  assert.ok(fresh.every(id=>all.some(q=>q.id===id)));
});
