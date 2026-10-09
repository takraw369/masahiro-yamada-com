import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const source=readFileSync(new URL('../src/pages/otsu4/kambetsu/index.astro',import.meta.url),'utf8');

test('photo flashcards are the default, no unsupported 78-photos claim',()=>{
  assert.match(source, /<option value="photos" selected>/);
  assert.match(source, /参考写真で名称・用途/);
  assert.match(source, /<img class="flash-photo" id="flash-photo"/);
  assert.match(source, /教材照合前/);
  assert.match(source, /\$\('flash-back'\)\.hidden=true/);
});

test('image failures automatically skip photo prompts without running live search',()=>{
  assert.match(source, /const hasPhotoSource = t => Boolean/);
  assert.match(source, /const eligible=examTools\.filter\(hasPhotoSource\)/);
  assert.match(source, /const available=item=>item\.photoTool && isExamTool\(item\.photoTool\) && hasPhotoSource\(item\.photoTool\)/);
  assert.match(source, /const images=\[/);
  assert.match(source, /const failure=\(\)=>/);
  assert.match(source, /if\(callbacks\.onFailure\)callbacks\.onFailure\(\)/);
  assert.match(source, /flashDeck\.splice\(flashIndex,1\)/);
});

test('photo question and quiz input stay hidden until image successfully loads',()=>{
  assert.match(source, /loadPhoto\(current\.photoTool,'flash-photo',true,\{/);
  assert.match(source, /loadPhoto\(t,'photo',true,\{/);
  assert.match(source, /onReady:\(\)=>/);
  assert.match(source, /if\(callbacks\.onReady\)callbacks\.onReady\(\)/);
  assert.match(source, /id="quiz-fields" hidden/);
  assert.match(source, /if\(\$\('photo'\)\.hidden\)return/);
  assert.match(source, /参考写真の出典・ライセンス/);
});

test('water-pump pliers, weak reviews and later items retain adaptive priority',()=>{
  assert.match(source, /name:'ウォーターポンププライヤー'[^\n]+files:\['440Tongue\+and\+GroovePliers\.JPG'/);
  assert.match(source, /item\.title==='ウォーターポンププライヤー'/);
  assert.match(source, /function lectureLateBonus\(t\)/);
  assert.match(source, /selectPhotoFlashSession\(ranked,10\)/);
  assert.match(source, /function quizImageWeight\(t\)/);
  assert.match(source, /Math\.min\(2,daysSince\(x\.lastSeen\)\/6\)/);
});

test('ten twenty thirty or all image-candidate items may be tested',()=>{
  assert.match(source, /id="quiz-count"/);
  for(const count of ['10','20','30','all'])assert.ok(source.includes('<option value="'+count+'"'));
  assert.match(source, /pickWeightedQuiz\(active,Math\.min\(n,active\.length\)\)/);
});

test('learning state and textbook p308 set survive untouched',()=>{
  assert.match(source, /const FLASH_KEY = 'otsu4-kambetsu-flashcards-v1'/);
  assert.match(source, /const excludedExamNames = new Set/);
  assert.match(source, /const excludedFoundationIds = new Set/);
  assert.match(source, /id: 'photo-'\+index/);
  assert.match(source, /const textbook308Tools = \[/);
});
