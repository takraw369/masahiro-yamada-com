import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const read = path => readFileSync(new URL('../'+path,import.meta.url),'utf8');
const home=read('src/pages/otsu4/index.astro');
const css=read('public/otsu4/styles.css');
const core=read('public/otsu4/tests/core.js');
const symbols=read('src/pages/otsu4/symbols/index.astro');

test('homepage has accessible tap-ready subject launcher immediately below the hero',()=>{
 const hero=home.indexOf('<div class="hero">');
 const quick=home.indexOf('<section class="study-launch"');
 const previous=home.indexOf('<section id="resume-card"');
 const banner=home.indexOf('id="jikahou-focus-banner"');
 assert.ok(hero>=0 && hero<quick && quick<previous && quick<banner,'launch must be near top, before the dated banners');
 assert.match(home,/<nav class="study-launch-grid" aria-label="消防設備士乙4の主要科目">/);
 assert.match(home,/<h2 id="study-launch-title">勉強する項目を選ぶ<\/h2>/);
 assert.equal((home.match(/class="study-launch-link"/g)||[]).length,6);
 assert.match(css,/study-launch-grid\{display:grid;grid-template-columns:repeat\(2,minmax\(0,1fr\)\)/);
 assert.match(css,/\.study-launch-more a\{[^}]*min-height:44px/);
 assert.match(css,/\.study-launch a:focus-visible\{/);
});

test('each quick launcher points at an existing canonical subject or live original trainer',()=>{
 const required=[
  '/otsu4/kambetsu/',
  '/otsu4/tests/?topic=law-all',
  '/otsu4/tests/?topic=electric',
  '/otsu4/tests/?topic=structure',
  '/otsu4/tests/?topic=paper-mistakes-20261011',
  '/otsu4/symbols/',
  '/otsu4/tests/?topic=law-common',
  '/otsu4/tests/?topic=law-class',
  '/otsu4/hourei/betsu1/',
  '/otsu4/learn/',
  '/otsu4/tests/?topic=practical',
  '/otsu4/tests/'
 ];
 for (const href of required)assert.ok(home.includes('href="'+href+'"'),href);
 const topics=[...home.matchAll(/href="\/otsu4\/tests\/\?topic=([^"]+)"/g)].map(m=>m[1]);
 for(const id of topics)assert.ok(core.includes("id:'"+id+"'")||core.includes('id: "'+id+'"'),id);
 assert.equal(new Set(required).size,required.length);
 assert.match(home,/data-start="adaptive"/);
 assert.match(home,/data-start="mock"/);
 assert.match(home,/id="resume-card"/);
});

test('symbol questions and reverse options show the identical original image used in answers, not blacked-out vectors',()=>{
 const refs=[...symbols.matchAll(/"ref": "(\d\d-[a-z]?\d\d)"/g)].map(m=>m[1]);
 assert.equal(refs.length,33,'all 33 symbol references remain intact');
 assert.equal(new Set(refs).size,33);
 assert.match(symbols,/function originalUrl\(mark\)/);
 assert.match(symbols,/function originalImage\(mark,which\)/);
 assert.match(symbols,/root\('symbol'\)\.innerHTML=originalImage\(card,'question'\)/);
 assert.match(symbols,/originalImage\(c,'choice'\)/);
 assert.match(symbols,/const url=originalUrl\(card\)/);
 assert.match(symbols,/root\('reference-symbol'\)\.src=url/);
 assert.doesNotMatch(symbols,/root\('symbol'\)\.innerHTML=svg\(card\)/);
 assert.doesNotMatch(symbols,/\+svg\(c\)\+/);
 assert.match(symbols,/\.symbol-area \.original-symbol\{/);
 assert.match(symbols,/\.choice-grid \.original-choice\{/);
 assert.match(symbols,/function attachImageFallback\(node\)/);
 assert.match(symbols,/const KEY='otsu4-symbol-cards-v1'/,'existing progress key must be unchanged');
});
