import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const script = readFileSync(new URL('../public/otsu4/training-sync.js', import.meta.url), 'utf8');

test('training-sync observer is idempotent and preserves changing weak-question counts', () => {
  const element = (initial) => {
    let value = initial;
    return {
      writes: 0,
      get textContent() { return value; },
      set textContent(next) { this.writes += 1; value = String(next); }
    };
  };
  const phase = element('読み込み中');
  const copy = element('弱点2問');
  let observerCallback;
  const document = {
    body: {},
    querySelector(selector) {
      if (selector === '#phase-label') return phase;
      if (selector === '#mission-copy') return copy;
      if (selector === '#view-home') return this.body;
      return null;
    }
  };
  const context = {
    window: { OTSU4_TRAINING_SCHEDULE: [
      { date: '2026-10-05', phase: '法令', topics: ['防火対象物'] },
      { date: '2026-10-13', phase: '受信機', topics: ['設置基準'] }
    ] },
    document,
    Date: class { toLocaleDateString() { return '2026-10-11'; } },
    MutationObserver: class {
      constructor(callback) { observerCallback = callback; }
      observe() {}
    }
  };
  vm.runInNewContext(script, context);
  assert.equal(phase.textContent, '法令');
  assert.match(copy.textContent, /弱点2問/);
  const firstWrites = phase.writes + copy.writes;
  observerCallback();
  assert.equal(phase.writes + copy.writes, firstWrites, 'observer must not trigger itself repeatedly');

  copy.textContent = '更新された弱点5問';
  observerCallback();
  assert.match(copy.textContent, /弱点5問/);
  const secondWrites = phase.writes + copy.writes;
  observerCallback();
  assert.equal(phase.writes + copy.writes, secondWrites, 'second observation must be a no-op');
});
