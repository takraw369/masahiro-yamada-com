import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const source=readFileSync(new URL('../src/pages/otsu4/hourei/betsu1/index.astro',import.meta.url),'utf8');
test('Appendix 1 drill requires row and kana choices before grading',()=>{
  assert.match(source,/id="numberPicks"/);assert.match(source,/id="kanaPicks"/);assert.match(source,/id="submitQA"/);
  assert.match(source,/selectedRow===item\[0\]&&selectedKana===item\[1\]/);
});
test('Appendix 1 confidence drives adaptive repeat scheduling',()=>{
  assert.match(source,/data-rate="weak"/);assert.match(source,/data-rate="repeat"/);assert.match(source,/data-rate="mastered"/);
  assert.match(source,/function weight\(item\)/);assert.match(source,/function scheduleAgain\(/);assert.match(source,/buildQueue\(\)/);
});
test('grid keeps all Irohani cells visually neutral and grades unsectioned rows from row header',()=>{
  assert.match(source,/data-rowonly/);assert.doesNotMatch(source,/class="cell invalid"/);assert.match(source,/gridItem\[1\]\?document\.querySelector/);
});
