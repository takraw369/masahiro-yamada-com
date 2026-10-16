import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";

const read = path => readFileSync(new URL("../"+path, import.meta.url), "utf8");
const page = read("src/pages/otsu4/flashcards/index.astro");
const home = read("src/pages/otsu4/index.astro");
const data = page.match(/const cards = (\[[\s\S]*?\]);\s*const \$ =/);
assert.ok(data, "card data exists in the page");
const cards = vm.runInNewContext(data[1]);
const script = page.match(/<script is:inline>([\s\S]*?)<\/script>/);
assert.ok(script, "interactive logic exists");

test("flashcard screen links from the existing study home and retains six main shortcuts", () => {
 assert.ok(home.includes('href="/otsu4/flashcards/"'));
 assert.ok(page.includes('href="/otsu4/symbols/"'));
 assert.ok(page.includes('href="/otsu4/tests/?topic=receiver"'));
 assert.equal((home.match(/class="study-launch-link"/g) || []).length, 6);
});
test("all textbook chapters have unique compact cards", () => {
 assert.equal(cards.length,130);
 assert.equal(new Set(cards.map(x=>x.id)).size,cards.length);
 for(const category of ["system","receiver","detector","detail","testtools","testmeaning","structureparts","pipeaccessories","transmitter","calibration"]) {
  assert.ok(cards.filter(x=>x.group===category).length>=4, category);
 }
 for(const c of cards) {
  assert.ok(c.q.length > 4 && c.q.length < 100, c.id+" front");
  assert.ok(c.a.length > 1 && c.a.length < 100, c.id+" back");
 }
});
test("photo-based calibration periods are not mixed up", () => {
 const byId=Object.fromEntries(cards.map(x=>[x.id,x.a]));
 for(const id of ["cal01","cal02","cal03"]) assert.equal(byId[id],"10年");
 for(const id of ["cal04","cal05"]) assert.equal(byId[id],"3年");
 for(const id of ["cal06","cal07","cal08"]) assert.equal(byId[id],"5年");
 assert.match(byId.cal09,/5年/);
});
test("existing quiz records and symbol card records are not modified by flashcards", () => {
 new vm.Script(script[1]);
 assert.match(page,/otsu4-knowledge-cards-v1/);
 assert.doesNotMatch(page,/localStorage\.setItem\(["']otsu4-study-state-v1/);
 assert.doesNotMatch(page,/localStorage\.setItem\(["']otsu4-symbol-cards-v1/);
 assert.match(page,/\[data-grade\]/);
 assert.match(page,/id="mask"/);
 assert.match(page,/id="scope"/);
 assert.match(page,/aria-pressed/);
});

test("photo p168/p187: fixed-temperature increments and air-tube size are exact",()=>{
 const byId=Object.fromEntries(cards.map(c=>[c.id,c.a]));
 assert.equal(cards.filter(c=>c.group==="detail").length,21);
 assert.equal(byId.temp01,"60℃以上150℃以下");
 assert.equal(byId.temp02,"5℃刻み");
 assert.equal(byId.temp03,"10℃刻み");
 assert.match(byId.temp04,/90℃/);
 assert.match(byId.temp06,/バイメタル.*サーミスタ.*膨張係数/);
 assert.match(byId.tube01,/20m以上/);
 assert.equal(byId.tube02,"0.3mm以上");
 assert.match(byId.tube03,/1\.94mm以上。内径ではない/);
 assert.match(byId.tube06,/リーク抵抗と接点水高/);
 assert.match(byId.tube10,/短くなり.*誤報/);
 assert.ok(page.includes('option value="detail"'));
 assert.ok(page.includes('new URLSearchParams(window.location.search)'));
});

test("photo: inspection test instrument matching and exact purposes",()=>{
 const byId=Object.fromEntries(cards.map(c=>[c.id,c.a]));
 assert.equal(cards.filter(c=>c.group==="testtools").length,16);
 assert.equal(cards.filter(c=>c.group==="testmeaning").length,15);
 assert.equal(byId.exam01,"加熱試験器");
 assert.match(byId.exam02,/テストポンプ/);
 assert.match(byId.exam03,/テストポンプ/);
 assert.match(byId.exam04,/マノメーター/);
 assert.match(byId.exam05,/マノメーター/);
 assert.equal(byId.exam07,"メーターリレー試験器");
 assert.equal(byId.exam09,"回路試験器");
 assert.equal(byId.exam10,"加煙試験器");
 assert.equal(byId.exam11,"煙感知器感度試験器");
 assert.equal(byId.exam12,"減光フィルター");
 assert.match(byId.purpose03,/接点が開くまでの時間/);
 assert.match(byId.purpose04,/水位が一定量下がる時間/);
 assert.match(byId.purpose06,/接点閉鎖時のマノメーター水位/);
 assert.match(byId.purpose10,/断線/);
 assert.match(byId.purpose11,/複数回線/);
 assert.match(byId.purpose12,/7警戒区域以下/);
 assert.match(byId.purpose14,/6か月.*1年/);
 for(const c of cards)assert.equal(typeof c.a,"string");
 assert.ok(page.includes('option value="testtools"'));
 assert.ok(page.includes('option value="testmeaning"'));
});

test("photo p296 detector schematics and air-tube accessory identification",()=>{
 const byId=Object.fromEntries(cards.map(c=>[c.id,c.a]));
 assert.equal(cards.filter(c=>c.group==="structureparts").length,20);
 assert.equal(cards.filter(c=>c.group==="pipeaccessories").length,10);
 assert.deepEqual(
   ["str01","str02","str03","str04"].map(id=>byId[id]),
   ["空気室","リーク孔","ダイヤフラム","接点"]
 );
 assert.deepEqual(
   ["str07","str08","str09","str10"].map(id=>byId[id]),
   ["温度検知素子（サーミスタ）","温度上昇率検知回路","比較回路","スイッチング回路"]
 );
 assert.deepEqual(
   ["str12","str13","str14","str15","str16","str17","str18"].map(id=>byId[id]),
   ["空気管","接点","ダイヤフラム","リーク孔","コックスタンド","試験コック","試験孔"]
 );
 assert.equal(byId.acc02,"スリーブ");
 assert.equal(byId.acc03,"銅管端子");
 assert.equal(byId.acc04,"止め金具（ステップル）");
 assert.equal(byId.acc05,"クリップ");
 assert.equal(byId.acc06,"貫通キャップ");
 assert.match(byId.acc09,/管同士.*検出部と管/);
 assert.ok(page.includes('option value="structureparts"'));
 assert.ok(page.includes('option value="pipeaccessories"'));
});
