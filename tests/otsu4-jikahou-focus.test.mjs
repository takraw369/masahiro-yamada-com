import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const at=file=>readFileSync(new URL('../'+file,import.meta.url),'utf8');
const ctx={window:{}};
vm.runInNewContext(at('public/otsu4/questions.js')+';window.rows=OTSU4_QUESTIONS;',ctx);
vm.runInNewContext(at('public/otsu4/tests/core.js'),ctx);
const {rows,OTSU4_TOPIC_TESTS:C}=ctx.window;
const topic=C.topics.find(t=>t.id==='jikahou-focus');
const install=C.topics.find(t=>t.id==='jikahou-install');
function store(){const map=new Map();return {getItem:key=>map.get(key)||null,setItem:(key,v)=>map.set(key,v)};}

test('self-fire-alarm course uses canonical questions, 4 installation laws + 5 structures + 1 written identification',()=>{
  assert.ok(topic);
  assert.equal(topic.ids.length,46);
  assert.equal(topic.quota['law-class'],4);
  assert.equal(topic.quota.structure,5);
  assert.equal(topic.quota.practical,1);
  for(const id of topic.ids)assert.ok(rows.find(row=>row.id===id),'canonical item '+id);
  const selected=C.select(rows,topic,C.load(store()));
  assert.equal(selected.length,10);
  for(const [category,count] of Object.entries(topic.quota))assert.equal(selected.filter(q=>q.category===category).length,count);
  assert.equal(selected.filter(q=>q.category==='practical').length,1);
  assert.ok(selected.every(q=>C.matches(q,topic)));
});
test('weak/unseen modes honor preexisting history, and never rewrite it on read',()=>{
  const storage=store(),state=C.load(storage);
  for(const q of rows){state.attempts[q.id]=1;}
  state.ratings.s18='repeat';state.wrong.l01=1;state.attempts.s12=0;
  storage.setItem(C.STATE_KEY,JSON.stringify(state));
  const weak=C.select(rows,topic,C.load(storage),'weak');
  assert.deepEqual([...weak].map(q=>q.id).sort(),['l01','s18']);
  const unseen=C.select(rows,topic,C.load(storage),'unseen');
  assert.deepEqual([...unseen].map(q=>q.id),['s12']);
  assert.equal(storage.getItem(C.STATE_KEY),JSON.stringify(state));
});
test('five day sprint has a live home entry and one image trainer, not a duplicate photo bank',()=>{
  const page=at('src/pages/otsu4/jikahou/index.astro');
  const home=at('src/pages/otsu4/index.astro');
  assert.match(page,/10\/9（金）〜10\/13（火）/);
  for(const date of ['10/9','10/10','10/11','10/12','10/13'])assert.ok(page.includes(date),date);
  assert.match(page,/topic=jikahou-focus/);
  assert.match(page,/topic=jikahou-install/);
  assert.match(page,/設置基準の応用・例外/);
  assert.match(page,/\/otsu4\/kambetsu\//);
  assert.match(page,/\/otsu4\/hourei\/betsu1\//);
  assert.match(home,/href="\/otsu4\/jikahou\/"/);
  assert.match(home,/topic=jikahou-focus/);
  assert.match(home,/topic=jikahou-install/);
  assert.doesNotMatch(page,/vettedPhotoFiles|loadPhoto\(/);
});

test('separate installation drill picks ten from canonical law questions only, respecting weaknesses and never duplicating new DB',()=>{
  assert.ok(install);
  assert.equal(install.ids.length,17);
  for(const id of install.ids){
    const q=rows.find(row=>row.id===id);
    assert.ok(q,'canonical install item '+id);
    assert.equal(q.category,'law-class');
  }
  const session=C.select(rows,install,C.load(store()));
  assert.equal(session.length,10);
  assert.ok(session.every(q=>C.matches(q,install)));
  assert.equal(new Set(session.map(q=>q.id)).size,session.length);

  const data=store(), state=C.load(data);
  for(const q of rows) state.attempts[q.id]=1;
  state.ratings.l12='repeat';
  state.wrong.l01=1;
  data.setItem(C.STATE_KEY,JSON.stringify(state));
  const weak=C.select(rows,install,C.load(data),'weak');
  assert.deepEqual([...weak].map(q=>q.id).sort(),['l01','l12']);
  assert.equal(data.getItem(C.STATE_KEY),JSON.stringify(state));
});

test('today lecture banner and daily plan both include installation standards without making new image copies',()=>{
  const home=at('src/pages/otsu4/index.astro');
  const page=at('src/pages/otsu4/jikahou/index.astro');
  assert.match(home,/構成と設置基準/);
  assert.match(page,/title:'自火報の構成＋設置基準'/);
  assert.match(page,/設置対象の用途と面積・警戒区域/);
  assert.match(page,/設置基準だけの10問/);
  assert.match(page,/同じ面積でも用途・階・例外で要件は変わる/);
  assert.doesNotMatch(page,/vettedPhotoFiles|loadPhoto\(/);
});
