import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const source=readFileSync(new URL('../src/pages/otsu4/kambetsu/index.astro',import.meta.url),'utf8');

test('photo identification is the initial mode and answers start concealed',()=>{
  assert.match(source, /<option value="photos" selected>/);
  assert.match(source, /p293〜309｜写真で名称・用途を覚える/);
  assert.match(source, /<img class="flash-photo" id="flash-photo"/);
  assert.match(source, /\$\('flash-back'\)\.hidden=true/);
  assert.match(source, /\$\('flash-answer-title'\)\.textContent=current\.title/);
  assert.match(source, /\$\('flash-answer'\)\.textContent=current\.answer/);
});

test('items without an existing image are retained for name-based photo searching',()=>{
  assert.match(source, /const photoFlashCards = \(\) => \[\.\.\.orderedTools,\.\.\.extraTools\]\.map/);
  assert.match(source, /async function searchNamedPhoto\(t\)/);
  assert.match(source, /https:\/\/commons\.wikimedia\.org\/w\/api\.php/);
  assert.match(source, /gsrnamespace:'6'/);
  assert.match(source, /searchNamedPhoto\(t\)/);
  assert.match(source, /photoOnly\)\{\s*photo\.hidden=true;/);
  assert.match(source, /この器具に一致する実物写真を取得できません/);
  assert.match(source, /flash-photo-search-wrap/);
});

test('sources and image matches are transparent; no generic diagrams in photo mode',()=>{
  assert.match(source, /loadPhoto\(current\.photoTool,'flash-photo',true\)/);
  assert.match(source, /loadPhoto\(t,'photo',true\)/);
  assert.match(source, /showSource\(entry\.source\)/);
  assert.match(source, /参考写真の出典・利用条件を確認/);
  assert.match(source, /if\(photoOnly\)\{/);
});

test('water-pump pliers and later tools receive explicit priority',()=>{
  assert.match(source, /name:'ウォーターポンププライヤー'[^\n]+files:\['440Tongue\+and\+GroovePliers\.JPG'/);
  assert.match(source, /item\.title==='ウォーターポンププライヤー'/);
  assert.match(source, /function lectureLateBonus\(t\)/);
  assert.match(source, /selectPhotoFlashSession\(ranked,10\)/);
  assert.match(source, /function quizImageWeight\(t\)/);
  assert.match(source, /Math\.min\(2,daysSince\(x\.lastSeen\)\/6\)/);
});

test('whole registered pool has a selectable ten/twenty/thirty-question quiz',()=>{
  assert.match(source, /id="quiz-count"/);
  for(const count of ['10','20','30','all'])assert.ok(source.includes('<option value="'+count+'"'));
  assert.match(source, /pickWeightedQuiz\(active,Math\.min\(n,active\.length\)\)/);
  assert.match(source, /\(requested==='all'\|\|requested==='priority'\)\?examTools/);
});

test('old history, textbook p308 course and exclusions from graded exam remain',()=>{
  assert.match(source, /const FLASH_KEY = 'otsu4-kambetsu-flashcards-v1'/);
  assert.match(source, /const excludedExamNames = new Set/);
  assert.match(source, /const excludedFoundationIds = new Set/);
  assert.match(source, /id: 'photo-'\+index/);
  assert.match(source, /const textbook308Tools = \[/);
});
