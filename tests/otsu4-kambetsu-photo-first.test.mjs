import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const source=readFileSync(new URL('../src/pages/otsu4/kambetsu/index.astro',import.meta.url),'utf8');

test('photo identification is the initial study mode, with the answer concealed',()=>{
  assert.match(source, /<option value="photos" selected>/);
  assert.match(source, /<img class="flash-photo" id="flash-photo"/);
  assert.match(source, /\$\('flash-back'\)\.hidden=true/);
  assert.match(source, /\$\('flash-answer-title'\)\.textContent=current\.title/);
  assert.match(source, /\$\('flash-answer'\)\.textContent=current\.answer/);
});

test('photo cards never treat generic SVG silhouettes as verified object photos',()=>{
  assert.match(source, /const hasPhotoSource = t => Boolean/);
  assert.match(source, /\.filter\(item=>isExamTool\(item\.photoTool\) && hasPhotoSource\(item\.photoTool\)\)/);
  assert.match(source, /loadPhoto\(current\.photoTool,'flash-photo',true\)/);
  assert.match(source, /if\(photoOnly\)\{\s*photo\.hidden=true;/);
  assert.match(source, /模式図では代用しません/);
  assert.match(source, /flash-photo-status/);
});

test('water-pump pliers have a real Commons photograph and are initially prioritized',()=>{
  assert.match(source, /name:'ウォーターポンププライヤー'[^\n]+files:\['440Tongue\+and\+GroovePliers\.JPG'/);
  assert.match(source, /scope==='photos'/);
  assert.match(source, /item\.title==='ウォーターポンププライヤー'/);
  assert.match(source, /const photoSource=photoFile/);
});

test('original study history and excluded exam topics remain untouched',()=>{
  assert.match(source, /const FLASH_KEY = 'otsu4-kambetsu-flashcards-v1'/);
  assert.match(source, /const excludedExamNames = new Set/);
  assert.match(source, /const excludedFoundationIds = new Set/);
  assert.match(source, /id: 'photo-'\+index/);
});
