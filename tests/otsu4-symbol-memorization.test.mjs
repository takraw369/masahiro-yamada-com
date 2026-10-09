import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';

const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
const page=read('src/pages/otsu4/symbols/index.astro');
const script=page.match(/<script is:inline>([\s\S]*?)<\/script>/)?.[1];
assert.ok(script,'inline memorization script present');

function setup(seed={}){
  const dom=new Map(), storage=new Map(Object.entries(seed));
  function element(id){
    if(!dom.has(id))dom.set(id,{
      hidden:false, textContent:'', innerHTML:'', value:'', dataset:{},
      style:{}, href:'', classList:{add(){}},
      addEventListener(){},querySelectorAll:()=>[]
    });
    return dom.get(id);
  }
  element('category').value='all';
  element('direction').value='symbol';
  element('study-mode').value='priority';
  const ctx={
    document:{getElementById:element,querySelectorAll:()=>[]},
    localStorage:{
      getItem:key=>storage.get(key)||null,
      setItem:(key,value)=>storage.set(key,value)
    }
  };
  const api=vm.runInNewContext(script+'\n({markDefs,lines,svg,buildDeck,history,rank,showCard,grade,start,reveal,choose,getDeck:()=>deck,getIndex:()=>index,getOptions:()=>options,getMemory:()=>memory})',ctx);
  return {api,element,storage};
}

test('symbols have 20 unique, non-placeholder diagrams linked to an existing professional legend',()=>{
  const {api}=setup();
  assert.equal(api.markDefs.length,20);
  assert.equal(new Set(api.markDefs.map(m=>m.id)).size,20);
  const ids=api.markDefs.map(m=>m.id);
  for(const expected of ['h-diff','h-fixed1','h-waterproof','s-surface','s-flush','r-main','r-relay','a-manual','a-bell','t-end','t-beam']){
    assert.ok(ids.includes(expected),expected);
  }
  for(const item of api.markDefs){
    assert.ok(item.title&&item.use&&item.hint&&item.ref);
    assert.ok(Object.hasOwn(api.lines,item.kind),'vector exists: '+item.id);
    assert.match(api.svg(item),/viewBox="0 0 160 130"/);
  }
  assert.match(page,/Panasonic/);
  assert.match(page,/傍記・凡例/);
  assert.doesNotMatch(page,/fallbackSvg|searchNamedPhoto|commons\.wikimedia/);
});

test('symbol-to-name questions hide answer until flip and persist the same symbol history',()=>{
  const {api,element,storage}=setup();
  assert.equal(api.getDeck().length,10);
  const item=api.getDeck()[0];
  assert.equal(element('answer').hidden,true);
  assert.equal(element('reveal').hidden,false);
  assert.match(element('symbol').innerHTML,/<svg/);
  api.reveal();
  assert.equal(element('answer').hidden,false);
  assert.equal(element('answer-title').textContent,item.title);
  assert.equal(element('answer-use').textContent,item.use);
  assert.match(element('source').href,new RegExp(item.ref+'\\.png'));
  api.grade('miss');
  const saved=JSON.parse(storage.get('otsu4-symbol-cards-v1'));
  assert.equal(saved[item.id].last,'miss');
  assert.equal(saved[item.id].attempts,1);
  assert.equal(saved[item.id].streak,0);
});

test('reverse direction provides four different symbol choices and a wrong guess cannot be recorded as mastered',()=>{
  const {api,element,storage}=setup();
  element('direction').value='reverse';
  element('study-mode').value='all';
  const buttons=Array.from({length:4},()=>({disabled:false,classList:{add(){}}}));
  element('choices').querySelectorAll=()=>buttons;
  api.start();
  assert.equal(api.getDeck().length,20);
  assert.equal(element('symbol').hidden,true);
  assert.equal(element('choices').hidden,false);
  assert.match(element('choices').innerHTML,/data-index="3"/);
  const current=api.getDeck()[0];
  const wrong=api.getOptions().findIndex(o=>o.id!==current.id);
  assert.ok(wrong>=0);
  api.choose(wrong);
  assert.equal(element('answer').hidden,false);
  assert.match(element('verdict').textContent,/不正解/);
  api.grade('ok');
  const saved=JSON.parse(storage.get('otsu4-symbol-cards-v1'));
  assert.equal(saved[current.id].last,'miss','no false mastery');
});

test('weak-mode includes only saved △・×, never erases history or weak IDs',()=>{
  const seed={
    'otsu4-symbol-cards-v1':JSON.stringify({
      'h-diff':{attempts:3,streak:0,last:'miss',lastSeen:Date.now()-86400000},
      'h-fixed1':{attempts:4,streak:0,last:'unsure',lastSeen:Date.now()-86400000},
      'a-manual':{attempts:6,streak:3,last:'ok',lastSeen:Date.now()-86400000}
    })
  };
  const {api,element,storage}=setup(seed);
  element('study-mode').value='weak';
  const deck=api.buildDeck().map(x=>x.id);
  assert.deepEqual(deck.sort(),['h-diff','h-fixed1']);
  assert.equal(storage.get('otsu4-symbol-cards-v1'),seed['otsu4-symbol-cards-v1'],'load should not mutate storage');
});

test('the existing Otsu4 home and focused self-fire-alarm syllabus link to the symbol trainer',()=>{
  assert.match(read('src/pages/otsu4/index.astro'),/href="\/otsu4\/symbols\/"/);
  assert.match(read('src/pages/otsu4/jikahou/index.astro'),/href="\/otsu4\/symbols\/"/);
  assert.match(page,/名称 → 図記号を4択/);
  assert.match(page,/○ 覚えた/);
  assert.match(page,/△ あやしい/);
  assert.match(page,/× もう一度/);
});
