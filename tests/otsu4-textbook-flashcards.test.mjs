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
 assert.equal(cards.length,69);
 assert.equal(new Set(cards.map(x=>x.id)).size,cards.length);
 for(const category of ["system","receiver","detector","detail","transmitter","calibration"]) {
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
