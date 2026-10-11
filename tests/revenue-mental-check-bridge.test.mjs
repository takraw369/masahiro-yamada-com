import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const homepage = readFileSync(new URL('../src/pages/index.astro', import.meta.url), 'utf8');
const mentalCheck = readFileSync(new URL('../src/pages/mental-check.astro', import.meta.url), 'utf8');
const libraryCatalog = readFileSync(new URL('../src/lib/libraryCatalog.ts', import.meta.url), 'utf8');

test('homepage links to the existing mental-check before secondary experiences', () => {
  const heroStart = homepage.indexOf('<div class="hero-cta reveal reveal-4">');
  const heroEnd = homepage.indexOf('</div>', heroStart);
  const hero = homepage.slice(heroStart, heroEnd);
  assert.ok(heroStart >= 0);
  assert.ok(hero.indexOf('href="/mental-check"') >= 0);
  assert.ok(hero.indexOf('href="/trinity"') > hero.indexOf('href="/mental-check"'));
  assert.match(hero, /https:\/\/lin\.ee\/pcAHpTBy/);
});

test('successful mental-check offers a usable existing LINE path and honest preview', () => {
  const successStart = mentalCheck.indexOf('<div id="success-card"');
  const successEnd = mentalCheck.indexOf('</div>\n  </section>', successStart);
  assert.ok(successStart >= 0 && successEnd > successStart);
  const success = mentalCheck.slice(successStart, successEnd);
  assert.match(success, /今日の一歩/);
  assert.match(success, /href="https:\/\/lin\.ee\/pcAHpTBy"/);
  assert.match(success, /rel="noopener noreferrer"/);
  assert.match(success, /「勝ち筋」/);
  assert.match(success, /href="\/library\/entry-toolkit"/);
  assert.match(success, /先行プレビュー/);
  assert.match(success, /医療・心理の診断結果ではありません/);
  assert.match(libraryCatalog, /slug: 'entry-toolkit'/);
  assert.match(libraryCatalog, /status: 'preview'/);
});

test('post-submit bridge does not bypass questionnaire submission and consent', () => {
  assert.match(mentalCheck, /const answers = collectAnswers\(\)/);
  assert.match(mentalCheck, /if \(!res\.ok \|\| !body\.ok\) throw new Error/);
  assert.match(mentalCheck, /followupConsent/);
  assert.match(mentalCheck, /sessionStorage\.removeItem\('mental-check-session'\)/);
  assert.match(mentalCheck, /document\.getElementById\('success-card'\)\.hidden = false/);
});
