import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const source=readFileSync(new URL('../src/pages/otsu4/kambetsu/index.astro',import.meta.url),'utf8');
const script=source.match(/<script is:inline>([\s\S]*?)<\/script>/)?.[1];
assert.ok(script);

function mount(){
  const storage={}, nodes=new Map();
  function element(id){
    if(!nodes.has(id))nodes.set(id,{
      id, hidden:false, src:'', href:'', value:id==='flash-scope'?'photos':id==='quiz-scope'?'priority':'',
      dataset:{}, textContent:'', innerHTML:'', style:{}, selectedOptions:[{textContent:'photo test'}],
      addEventListener(){}, appendChild(){}
    });
    return nodes.get(id);
  }
  class Params{get(){return null}}
  const context={
    URLSearchParams:Params,
    document:{getElementById:element,querySelectorAll:()=>[],createElement:()=>({style:{}})},
    window:{scrollTo(){}},location:{search:''},
    localStorage:{getItem(k){return storage[k]||null},setItem(k,v){storage[k]=v;}},
  };
  const api=vm.runInNewContext(script+'\n({tools,examTools,photoFlashCards,hasVettedPhoto,beginFlash,showFlash,buildQueue,openTest,revealFlash,getDeck:()=>flashDeck,getIndex:()=>flashIndex})',context);
  return {api,element,storage};
}

test('image-first lessons use independently checked real Commons filenames, not live guessed searches',()=>{
  assert.match(source, /const vettedPhotoFiles = Object\.freeze/);
  assert.match(source, /'ウォーターポンププライヤー':\['440Tongue\+and\+GroovePliers\.JPG'/);
  assert.match(source, /'パイプレンチ':\['Pipe wrench\.JPG'\]/);
  assert.match(source, /'地区音響装置':\['Fire Alarm Bell red\.jpg'\]/);
  assert.match(source, /const imageUrls=\(vettedPhotoFiles\[t\.name\]\|\|\[\]\)/);
  assert.match(source, /実物写真で鑑別（写真確認済みだけ）/);
});

test('first photo question stays hidden until real image onload, then reveals title and use on flip',()=>{
  const {api,element}=mount();
  assert.equal(api.tools.length,78);
  assert.equal(api.photoFlashCards().length,78,'catalog must retain all lesson records');
  assert.equal(api.tools.filter(api.hasVettedPhoto).length,20,'20 verified images in the first release');
  const photo=element('flash-photo');
  assert.ok(photo.hidden,'image starts concealed');
  assert.ok(element('flash-flip').hidden,'no reveal button before an image');
  assert.match(element('flash-question').textContent,/読み込み中/);
  photo.onload();
  assert.equal(photo.hidden,false);
  assert.equal(element('flash-flip').hidden,false);
  assert.match(element('flash-question').textContent,/正式名称と用途/);
  api.revealFlash();
  assert.equal(element('flash-back').hidden,false);
  assert.ok(element('flash-answer-title').textContent.length>0);
  assert.ok(element('flash-answer').textContent.length>0);
  assert.match(element('flash-reference').href,/commons\.wikimedia\.org/);
});

test('a failed image is automatically removed, with no photo-less question or grade',()=>{
  const {api,element}=mount();
  const first=api.getDeck()[0].id;
  const photo=element('flash-photo'), flip=element('flash-flip');
  let tries=0, requestId=photo.dataset.requestId;
  while(photo.dataset.requestId===requestId && typeof photo.onerror==='function' && tries++<5)photo.onerror();
  assert.notEqual(photo.dataset.requestId,requestId,'failed card replaced by next card');
  assert.notEqual(api.getDeck()[0].id,first,'failed photo does not ask for text-only identification');
  assert.equal(flip.hidden,true,'next item remains concealed until its photo loads');
  assert.match(element('flash-question').textContent,/読み込み中/);
});

test('photo quizzes draw from actual picture inventory and conceal inputs until onload',()=>{
  const {api,element}=mount();
  const all=api.examTools.filter(api.hasVettedPhoto);
  assert.equal(api.buildQueue().length,Math.min(20,all.length));
  element('quiz-scope').value='all';
  assert.equal(api.buildQueue().length,all.length,'all means all photo-ready examinable items');
  api.openTest();
  const image=element('photo');
  assert.equal(image.hidden,true);
  assert.equal(element('quiz-fields').hidden,true);
  assert.equal(element('quiz-question').hidden,true);
  image.onload();
  assert.equal(image.hidden,false);
  assert.equal(element('quiz-fields').hidden,false);
  assert.equal(element('quiz-question').hidden,false);
});

test('old grading storage, p308 mode and previously excluded examination items are preserved',()=>{
  const {api,element}=mount();
  const skipped=['紫外線式スポット型感知器','赤外線式スポット型感知器','差動式分布型感知器（熱電対式）の検出器','差動式分布型感知器（熱電対式）の熱電対部'];
  for(const name of skipped) assert.ok(!api.examTools.some(t=>t.name===name));
  element('flash-scope').value='tools308';
  api.beginFlash();
  assert.ok(api.getDeck().length>0);
  assert.ok(api.getDeck().every(item=>api.hasVettedPhoto(item.photoTool)));
  assert.match(source, /otsu4-kambetsu-state-v2/);
  assert.match(source, /otsu4-kambetsu-flashcards-v1/);
});
