import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
import { stripTypeScriptTypes } from 'node:module';
import vm from 'node:vm';
import { readPublishingHandoff, isPublishingHandoffFresh } from '../src/lib/publishingHandoff.ts';

const read = path => readFile(new URL('../' + path, import.meta.url), 'utf8');
const studio = await read('src/pages/dashboard/content-studio.astro');
const script = stripTypeScriptTypes(studio.match(/<script>([\s\S]*?)<\/script>/)[1].replace(/^\s*import .*;$/gm, ''));
const asset = { id: 'C370', title: '合成素材：最初の一歩', target: '合成読者', genre: 'EDUCATION', source_url: 'https://docs.google.com/document/d/synthetic-example/edit', rights: '合成データ・検証専用', status: 'READY' };

function renderStudio({ pending = null, storageFails = false, confirm = true } = {}) {
  const elements = new Map(), storage = new Map(pending ? [['masa-publishing-handoff-v1', JSON.stringify(pending)]] : []);
  let confirmations = 0;
  class Element {
    value = ''; hidden = false; disabled = false; textContent = ''; children = []; events = {}; open = true;
    addEventListener(type, fn) { this.events[type] = fn; }
    append(...children) { this.children.push(...children); }
    replaceChildren(...children) { this.children = children; }
    setAttribute() {}
    focus() { this.focused = true; }
    scrollIntoView() { this.scrolled = true; }
    reset() {}
    querySelector() { return new Element(); }
    click() { const event = { prevented: false, preventDefault() { this.prevented = true; } }; this.events.click?.(event); return event; }
  }
  const element = id => { if (!elements.has(id)) elements.set(id, new Element()); return elements.get(id); };
  element('product-form').elements = { namedItem: name => element('field-' + name) };
  const context = {
    document: { getElementById: element, createElement: () => new Element() },
    HTMLInputElement: Element, HTMLTextAreaElement: Element,
    FormData: class { get(name) { return element('field-' + name).value; } },
    window: { addEventListener() {}, confirm() { confirmations++; return confirm; } },
    localStorage: { getItem: key => storage.get(key) || null, setItem: (key, value) => { if (storageFails) throw new Error('blocked'); storage.set(key, value); } },
    fetch: async () => ({ ok: true, json: async () => ({ ok: true, data: { assets: [asset, { ...asset, id: 'C371' }], knowledge: [], products: [] } }) }),
    renderProtectedMarkdown: value => value, readPublishingHandoff, isPublishingHandoffFresh,
    URL, Date, Blob,
  };
  vm.runInNewContext(script + '\nglobalThis.chooseSource = choose;', context);
  return { element, storage, context, confirmations: () => confirmations };
}

test('creation starts before operations and all four intent links use existing editors', async () => {
  const home = await read('src/pages/dashboard/index.astro');
  assert.ok(home.indexOf('class="home-create"') < home.indexOf('class="home-layout-grid"'));
  for (const href of ['/dashboard/post', '/dashboard/content-studio?intent=article-video', '/dashboard/content-studio?intent=lesson-product', '/dashboard/content-flow']) assert.ok(home.includes(`href="${href}"`));
  assert.match(home, /grid-template-columns:repeat\(2,minmax\(0,1fr\)\)/);
  assert.match(home, /min-height:44px/);
});

test('source selection moves keyboard focus to editing and retains provenance in the existing handoff', async () => {
  const view = renderStudio();
  await new Promise(resolve => setImmediate(resolve));
  view.context.chooseSource(asset);
  assert.equal(view.element('source-picker').open, false);
  assert.equal(view.element('create-title').focused, true);
  assert.equal(view.element('source-to-post').hidden, false);
  assert.equal(view.element('source-to-post').click().prevented, false);
  const handoff = readPublishingHandoff(view.storage.get('masa-publishing-handoff-v1'));
  assert.equal(handoff.coreId, asset.id);
  assert.equal(handoff.coreTitle, asset.title);
  assert.equal(handoff.sourceUrl, asset.source_url);
  assert.equal(handoff.sourceRights, asset.rights);
  assert.ok(isPublishingHandoffFresh(handoff));
  assert.equal(view.storage.has('masa-publishing-flow-v2'), false);
});

test('pending handoff cancellation and blocked storage prevent navigation without losing work', async () => {
  const pending = { coreTitle: '既存の素材', createdAt: Date.now() };
  for (const options of [{ pending, confirm: false }, { pending, storageFails: true }]) {
    const view = renderStudio(options);
    await new Promise(resolve => setImmediate(resolve));
    view.context.chooseSource(asset);
    view.element('product-body').value = '編集中の教材';
    assert.equal(view.element('source-to-post').click().prevented, true);
    assert.deepEqual(JSON.parse(view.storage.get('masa-publishing-handoff-v1')), pending);
    assert.equal(view.element('product-body').value, '編集中の教材');
    assert.equal(view.confirmations(), 1);
    if (options.storageFails) assert.match(view.element('studio-status').textContent, /制作指示をコピー/);
  }
});

test('a source change cannot silently detach an existing manuscript from its source', async () => {
  const view = renderStudio();
  await new Promise(resolve => setImmediate(resolve));
  view.context.chooseSource(asset);
  view.element('product-body').value = '残す原稿';
  view.element('source-picker').open = true;
  view.context.chooseSource({ ...asset, id: 'C371' });
  assert.equal(view.element('source-picker').open, true);
  assert.match(view.element('studio-status').textContent, /原稿と出典を保持/);
  view.element('source-to-post').click();
  assert.equal(JSON.parse(view.storage.get('masa-publishing-handoff-v1')).coreId, 'C370');
});

test('save conflict is shown beside the editor controls while preserving manuscript', async () => {
  const view = renderStudio();
  await new Promise(resolve => setImmediate(resolve));
  view.element('product-body').value = '競合時も残す原稿';
  view.context.document.activeElement = { closest: selector => selector === '#product-form' };
  view.context.fetch = async () => ({ ok: false, json: async () => ({ ok: false, error: 'version_conflict' }) });
  await view.element('product-form').events.submit({ preventDefault() {} });
  assert.equal(view.element('studio-save-status').hidden, false);
  assert.match(view.element('studio-save-status').textContent, /別の更新があります/);
  assert.equal(view.element('product-body').value, '競合時も残す原稿');
});
