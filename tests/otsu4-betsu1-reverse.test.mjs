import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const source=readFileSync(new URL('../src/pages/otsu4/hourei/betsu1/index.astro',import.meta.url),'utf8');

test('Appendix 1 exposes reverse written mode',()=>{
  assert.match(source,/id="reverseTab"/);
  assert.match(source,/id="reverseMode"/);
  assert.match(source,/id="reverseInput"/);
  assert.match(source,/id="submitReverse"/);
});

test('reverse mode performs lenient keyword matching and shows canonical answer',()=>{
  assert.match(source,/function reverseMatch\(input,answer\)/);
  assert.match(source,/主要語一致/);
  assert.match(source,/部分一致/);
  assert.match(source,/正答：<b>/);
});

test('reverse mode feeds the same adaptive history and reschedule engine',()=>{
  assert.match(source,/data-reverse-rate="weak"/);
  assert.match(source,/data-reverse-rate="repeat"/);
  assert.match(source,/data-reverse-rate="mastered"/);
  assert.match(source,/saveResult\(reverseItem,reverseCorrect,rating\)/);
  assert.match(source,/scheduleAgain\(rqueue,ri,reverseItem,rating\)/);
});
