import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const read = (path) => readFileSync(new URL('../'+path, import.meta.url), 'utf8');
const context={window:{}};
vm.runInNewContext(read('public/otsu4/questions.js')+';window.rows=OTSU4_QUESTIONS;',context);
vm.runInNewContext(read('public/otsu4/tests/core.js'),context);
const questions=context.window.rows;
const core=context.window.OTSU4_TOPIC_TESTS;
const ids=['l32','l33','l34','l35','l36','l37'];
const storage=()=>{const m=new Map();return {getItem:key=>m.get(key)||null,setItem:(key,v)=>m.set(key,v)};};

test('2026-10-10 photo intake adds six independently explained fire equipment engineer law questions',()=>{
  assert.equal(new Set(questions.map(q=>q.id)).size,questions.length);
  const answerMap={l32:2,l33:3,l34:1,l35:2,l36:1,l37:3};
  for(const id of ids){
    const q=questions.find(q=>q.id===id);
    assert.ok(q,id);
    assert.equal(q.category,'law-class',id);
    assert.equal(q.answer,answerMap[id],id);
    assert.equal(q.choices.length,4,id);
    assert.equal(q.choiceNotes.length,4,id);
    assert.ok(q.choices.every((choice,i)=>typeof choice==='string' && q.choiceNotes[i]?.length>=12),id);
    assert.match(q.source?.url||'', /^https:\/\/laws\.e-gov\.go\.jp\/law\//,id);
    assert.equal(q.lectureMarked,false,id);
  }
  assert.match(questions.find(q=>q.id==='l33').explanation,/規則23条2項/);
  assert.match(questions.find(q=>q.id==='l36').explanation,/10倍/);
  assert.doesNotMatch(questions.find(q=>q.id==='l36').question,/危険物取扱者/);
});

test('photo questions are available through the existing topic tests and full law quiz',()=>{
  const photo=core.topics.find(t=>t.id==='photo-install-20261010');
  assert.ok(photo);
  assert.deepEqual(Array.from(photo.ids),ids);
  const photoRows=core.select(questions,photo,core.load(storage()));
  assert.deepEqual(Array.from(photoRows,q=>q.id).sort(),[...ids].sort());
  const law=core.topics.find(t=>t.id==='law-all');
  const allLaw=core.select(questions,law,core.load(storage()),'smart',Date.now(),'all');
  assert.equal(allLaw.length,questions.filter(q=>q.category.startsWith('law-')).length);
  assert.ok(ids.every(id=>allLaw.some(q=>q.id===id)));
  assert.ok(allLaw.length>=76);
});

test('old IDs and stored study records stay intact; old fixed total label is removed',()=>{
  for(const id of ['l01','l19','l31','c34','c39']){
    assert.ok(questions.some(q=>q.id===id),id);
  }
  const store=storage();
  const s=core.load(store);
  s.attempts.l01=3;s.notes.l19='以前のコメント';s.ratings.c34='repeat';
  store.setItem(core.STATE_KEY,JSON.stringify(s));
  core.select(questions,core.topics.find(t=>t.id==='photo-install-20261010'),core.load(store));
  assert.equal(store.getItem(core.STATE_KEY),JSON.stringify(s));
  for(const path of ['src/pages/otsu4/tests/index.astro','src/pages/otsu4/hourei/index.astro','public/otsu4/tests/app.js']){
    assert.doesNotMatch(read(path),/全70問/,path);
  }
  assert.match(read('src/pages/otsu4/hourei/index.astro'),/photo-install-20261010/);
});
