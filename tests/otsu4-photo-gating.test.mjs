import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';

const html=readFileSync(new URL('../src/pages/otsu4/kambetsu/index.astro',import.meta.url),'utf8');
const script=html.match(/<script is:inline>([\s\S]*?)<\/script>/)?.[1];
assert.ok(script);
function fixture(){
  const elems=new Map(), storage={};
  const element=id=>{
    if(!elems.has(id))elems.set(id,{id,hidden:false,dataset:{},src:'',href:'',style:{},innerHTML:'',
      textContent:'',value:id==='flash-scope'?'photos':id==='quiz-scope'?'priority':'',
      selectedOptions:[{textContent:'写真鑑別'}],addEventListener(){},appendChild(){}});
    return elems.get(id);
  };
  class SearchParams{get(){return null}}
  const context={
    document:{getElementById:element,querySelectorAll:()=>[],createElement:()=>({style:{}})},
    URLSearchParams:SearchParams,
    localStorage:{getItem:key=>storage[key]||null,setItem:(key,value)=>storage[key]=value},
    window:{scrollTo(){}},location:{search:''}
  };
  const api=vm.runInNewContext(script+'\n({tools,examTools,photoFlashCards,hasPhotoSource,buildQueue,beginFlash,openTest,revealFlash,getFlashDeck:()=>flashDeck,getFlashIndex:()=>flashIndex})',context);
  return {api,element,storage};
}
test('78 historical entries stay, only referenced photographs are allowed in quizzes',()=>{
  const {api,element}=fixture();
  assert.equal(api.tools.length,78);
  assert.equal(api.photoFlashCards().length,78);
  const eligible=api.examTools.filter(api.hasPhotoSource);
  assert.ok(eligible.length>0&&eligible.length<74);
  assert.equal(api.buildQueue().length,Math.min(20,eligible.length));
  element('quiz-scope').value='all';
  assert.equal(api.buildQueue().length,eligible.length);
  assert.ok(api.getFlashDeck().every(item=>item.photoTool&&api.hasPhotoSource(item.photoTool)));
  for(const bad of ['赤外線式スポット型感知器','紫外線式スポット型感知器']){
    assert.ok(!api.getFlashDeck().some(item=>item.title===bad));
  }
});
test('photo question stays hidden until onload, then flip reveals name and purpose',()=>{
  const {api,element}=fixture();
  const photo=element('flash-photo');
  assert.equal(photo.hidden,true);
  assert.equal(element('flash-flip').hidden,true);
  assert.match(element('flash-question').textContent,/写真を読み込み中/);
  api.revealFlash();
  assert.equal(element('flash-back').hidden,true);
  assert.equal(typeof photo.onload,'function');
  photo.onload();
  assert.equal(photo.hidden,false);
  assert.equal(element('flash-flip').hidden,false);
  assert.match(element('flash-question').textContent,/正式名称と用途/);
  api.revealFlash();
  assert.equal(element('flash-back').hidden,false);
  assert.ok(element('flash-answer-title').textContent);
  assert.ok(element('flash-answer').textContent);
});
test('failed photo automatically advances without asking a text-only question',()=>{
  const {api,element}=fixture();
  const first=api.getFlashDeck()[0];
  const photo=element('flash-photo'),old=photo.dataset.requestId;
  let attempts=0;
  while(photo.dataset.requestId===old&&typeof photo.onerror==='function'&&attempts++<8)photo.onerror();
  assert.notEqual(photo.dataset.requestId,old);
  assert.notEqual(api.getFlashDeck()[0].id,first.id);
  assert.equal(element('flash-flip').hidden,true);
  assert.match(element('flash-question').textContent,/写真を読み込み中/);
});
test('quiz fields remain hidden until image loads',()=>{
  const {api,element}=fixture();
  api.openTest();
  const photo=element('photo');
  assert.equal(photo.hidden,true);
  assert.equal(element('quiz-question').hidden,true);
  assert.equal(element('quiz-fields').hidden,true);
  photo.onload();
  assert.equal(photo.hidden,false);
  assert.equal(element('quiz-question').hidden,false);
  assert.equal(element('quiz-fields').hidden,false);
});
test('storage, adaptive weights and excluded-topic definitions remain stable',()=>{
  assert.match(html,/otsu4-kambetsu-state-v2/);
  assert.match(html,/otsu4-kambetsu-flashcards-v1/);
  assert.match(html,/function lectureLateBonus/);
  assert.match(html,/function quizImageWeight/);
  assert.match(html,/const excludedExamNames = new Set/);
  assert.match(html,/const textbook308Tools = \[/);
  assert.doesNotMatch(html,/const vettedPhotoFiles/);
});
