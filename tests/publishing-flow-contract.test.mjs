import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { stripTypeScriptTypes } from 'node:module';
import test from 'node:test';
import vm from 'node:vm';
import { readPublishingHandoff, isPublishingHandoffFresh, publishingHandoffSeed, PUBLISHING_HANDOFF_MAX_AGE_MS } from '../src/lib/publishingHandoff.ts';

const flow = await readFile(new URL('../src/pages/dashboard/content-flow.astro', import.meta.url), 'utf8');
const post = await readFile(new URL('../src/pages/dashboard/post.astro', import.meta.url), 'utf8');
const dashboard = await readFile(new URL('../src/pages/dashboard/index.astro', import.meta.url), 'utf8');

test('Publishing Flow stays a local decision overlay over existing canonical surfaces', () => {
  assert.match(flow, /const oldKey = 'masa-content-flow-v1'/);
  assert.match(flow, /masa-publishing-flow-v2/);
  assert.match(flow, /正式な配信実績・KPIはDISTRIBUTION_OSへ戻す/);
  assert.match(flow, /href="\/dashboard\/content-schedule"/);
  assert.match(dashboard, /href="\/dashboard\/content-flow"/);
  assert.doesNotMatch(flow, /\bfetch\s*\(/);
  assert.doesNotMatch(flow, /\/api\//);
});

const now = Date.parse('2026-10-04T12:00:00Z');
const handoff = {
  coreId: 'C099', coreTitle: '本番の最初の一歩', question: '最初に戻す動作は？',
  phase: 'TOUCH', theme: 'body', audience: 'internal audience', channel: 'internal channel',
  cta: 'internal CTA plan', createdAt: now,
};

test('Composer seed includes source copy only, keeping strategy and IDs out', () => {
  const seed = publishingHandoffSeed(handoff);
  assert.equal(seed, '本番の最初の一歩\n\n最初に戻す動作は？');
  for (const value of ['Phase:', 'Theme:', 'Audience:', 'CTA:', handoff.coreId, handoff.phase, handoff.theme, handoff.audience, handoff.channel, handoff.cta]) {
    assert.ok(!seed.includes(value), value);
  }
  assert.equal(publishingHandoffSeed({ coreTitle: ' 同じ本文 ', question: '同じ本文' }), '同じ本文');
  assert.equal(publishingHandoffSeed({ question: '問いだけ' }), '問いだけ');
});

test('Handoff expires at 24h and rejects legacy, invalid or future timestamps', () => {
  assert.equal(isPublishingHandoffFresh(handoff, now), true);
  assert.equal(isPublishingHandoffFresh(handoff, now + PUBLISHING_HANDOFF_MAX_AGE_MS - 1), true);
  assert.equal(isPublishingHandoffFresh(handoff, now + PUBLISHING_HANDOFF_MAX_AGE_MS), false);
  for (const createdAt of [undefined, null, '', '2026-10-04', 0, NaN, Infinity, now + 1]) {
    assert.equal(isPublishingHandoffFresh({ ...handoff, createdAt }, now), false, String(createdAt));
  }
});

test('Malformed storage cannot become Composer source text or crash panel rendering', () => {
  for (const raw of [null, '{broken', 'null', 'false', '[]', '"text"']) assert.equal(readPublishingHandoff(raw), null);
  assert.deepEqual(readPublishingHandoff('{"coreTitle":42,"question":{"secret":"internal"},"createdAt":"yesterday"}'), {});
  assert.equal(publishingHandoffSeed(readPublishingHandoff('{"question":"  問い  ","audience":"internal"}')), '問い');
});

function renderPost(savedHandoff, clock = now) {
  const elements = new Map();
  const listeners = new Map();
  const events = [];
  const state = { now: clock };
  const element = (id) => {
    if (!elements.has(id)) elements.set(id, { hidden: true, disabled: true, textContent: '', addEventListener(type, fn) { this[type] = fn; } });
    return elements.get(id);
  };
  class Textarea {
    get value() { return this._value || ''; }
    set value(value) { this._value = value; }
    getAttribute() { return '今日の気づき'; }
    dispatchEvent(event) { events.push(event); }
    focus() {}
    scrollIntoView() {}
  }
  const textarea = new Textarea();
  const script = post.match(/<script>([\s\S]*?)<\/script>/)[1]
    .replace(/import\s*\{[^}]+\}\s*from\s*'\.\.\/\.\.\/lib\/publishingHandoff';/, '');
  vm.runInNewContext(stripTypeScriptTypes(script), {
    readPublishingHandoff, publishingHandoffSeed,
    isPublishingHandoffFresh: (value) => isPublishingHandoffFresh(value, state.now),
    localStorage: { getItem: () => JSON.stringify(savedHandoff) },
    document: { getElementById: element, querySelectorAll: (selector) => selector === 'textarea' ? [textarea] : [] },
    window: { addEventListener: (type, fn) => listeners.set(type, fn), dispatchEvent: (event) => { events.push(event); listeners.get(event.type)?.(event); } },
    HTMLTextAreaElement: Textarea,
    CustomEvent: class { constructor(type, options) { this.type = type; this.detail = options.detail; } },
    Event: class { constructor(type) { this.type = type; } },
  });
  return { element, textarea, events, state };
}

test('Actual post click populates Composer only after user action and keeps strategy in panel', () => {
  const view = renderPost(handoff);
  assert.equal(view.textarea.value, '');
  assert.equal(view.element('handoff-to-composer').disabled, false);
  for (const field of ['phase', 'theme', 'audience', 'channel', 'cta']) assert.equal(view.element(`handoff-${field}`).textContent, handoff[field]);
  view.element('handoff-to-composer').click();
  assert.equal(view.textarea.value, '本番の最初の一歩\n\n最初に戻す動作は？');
  assert.equal(view.events.filter((event) => event.type === 'masa:x-compose').length, 1);
  assert.equal(view.events.filter((event) => event.type === 'input').length, 1);
});

test('Stale or empty handoffs warn and cannot dispatch, including expiry while page stays open', () => {
  for (const value of [{ ...handoff, createdAt: now - PUBLISHING_HANDOFF_MAX_AGE_MS }, { ...handoff, createdAt: undefined }, { ...handoff, createdAt: now + 1 }]) {
    const view = renderPost(value);
    assert.equal(view.element('handoff-to-composer').disabled, true);
    assert.match(view.element('handoff-status').textContent, /Flowへ戻り/);
    view.element('handoff-to-composer').click();
    assert.equal(view.events.length, 0);
  }
  const empty = renderPost({ ...handoff, coreTitle: '', question: '' });
  assert.equal(empty.element('handoff-to-composer').disabled, true);
  assert.match(empty.element('handoff-status').textContent, /本文素材がありません/);
  const view = renderPost(handoff);
  view.state.now += PUBLISHING_HANDOFF_MAX_AGE_MS;
  view.element('handoff-to-composer').click();
  assert.equal(view.element('handoff-to-composer').disabled, true);
  assert.equal(view.events.length, 0);
});

test('Actual Flow handoff stamps the user selection time before navigation', () => {
  const elements = new Map();
  const links = [{ addEventListener(type, fn) { this[type] = fn; } }];
  const storage = new Map([['masa-publishing-flow-v2', JSON.stringify(handoff)]]);
  const script = flow.match(/<script is:inline>([\s\S]*?)<\/script>/)[1];
  vm.runInNewContext(script, {
    Date: class extends Date { static now() { return now; } },
    localStorage: { getItem: (key) => storage.get(key), setItem: (key, value) => storage.set(key, value) },
    document: {
      getElementById: (id) => { if (!elements.has(id)) elements.set(id, { addEventListener() {}, querySelectorAll: () => [] }); return elements.get(id); },
      querySelectorAll: (selector) => selector === '[data-handoff="post"]' ? links : [],
      querySelector: () => null,
    },
  });
  assert.equal(storage.has('masa-publishing-handoff-v1'), false);
  links[0].click();
  const stored = JSON.parse(storage.get('masa-publishing-handoff-v1'));
  assert.equal(stored.createdAt, now);
  assert.equal(stored.coreTitle, handoff.coreTitle);
});

test('Publishing Flow hands a draft scaffold to X only after explicit user actions', () => {
  assert.match(flow, /data-handoff="post"/);
  assert.match(flow, /addEventListener\('click'/);
  assert.match(flow, /localStorage\.setItem\('masa-publishing-handoff-v1'/);
  assert.match(post, /type="button" id="handoff-to-composer"/);
  assert.match(post, /button\?\.addEventListener\('click'/);
  assert.match(post, /new CustomEvent\('masa:x-compose'/);
  assert.doesNotMatch(post, /\bfetch\s*\(/);
  assert.doesNotMatch(post, /\/api\/x-harness\//);
});
