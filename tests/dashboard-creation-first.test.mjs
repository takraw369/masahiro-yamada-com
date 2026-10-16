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

function renderStudio({ pending = null, storageFails = false, confirm = true, products = [], knowledge = [], readFails = false } = {}) {
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
    document: { getElementById: element, createElement: () => new Element(), querySelector: () => element('lesson-editor') },
    HTMLInputElement: Element, HTMLTextAreaElement: Element,
    FormData: class { get(name) { return element('field-' + name).value; } },
    window: { events: {}, addEventListener(type, fn) { this.events[type] = fn; }, confirm() { confirmations++; return confirm; } },
    localStorage: { getItem: key => storage.get(key) || null, setItem: (key, value) => { if (storageFails) throw new Error('blocked'); storage.set(key, value); } },
    fetch: async () => ({ ok: !readFails, json: async () => ({ ok: !readFails, data: { assets: [asset, { ...asset, id: 'C371' }], knowledge, products } }) }),
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
  view.context.fetch = async () => ({ ok: false, json: async () => ({ ok: false, error: 'version_conflict' }) });
  await view.element('product-form').events.submit({ preventDefault() {} });
  assert.equal(view.element('studio-save-status').hidden, false);
  assert.match(view.element('studio-save-status').textContent, /別の更新があります/);
  assert.equal(view.element('product-body').value, '競合時も残す原稿');
});

const tick = () => new Promise(resolve => setImmediate(resolve));
const product = { slug: 'existing-lesson', title: '保存済みの教材', summary: '保存した変化', body: '', source_asset_id: 'missing-source', version: 3, price_jpy: 0, status: 'draft' };
const openFirstProduct = view => view.element('product-list').children[0].children[2].click();
const hasUnsavedWork = view => {
  let prevented = false;
  view.context.window.events.beforeunload({ preventDefault() { prevented = true; } });
  return prevented;
};

test('resume uses real saved work and places its list before source discovery', async () => {
  const home = await read('src/pages/dashboard/index.astro');
  assert.match(home, /つづきから/);
  assert.ok(home.includes('/dashboard/content-studio?view=drafts#saved-drafts'));
  assert.ok(studio.indexOf('id="saved-drafts"') < studio.indexOf('id="source-picker"'));
  const view = renderStudio({ products: [product] });
  await tick();
  view.element('saved-drafts').open = false;
  view.element('open-saved-drafts').click();
  assert.equal(view.element('saved-drafts').open, true);
  openFirstProduct(view);
  assert.equal(view.element('field-title').value, product.title);
  assert.equal(view.element('field-slug').value, product.slug);
  assert.equal(view.element('create-title').focused, true);
  assert.equal(view.element('lesson-editor').open, true);
  assert.match(view.element('selected-source').textContent, /missing-source/);
  assert.equal(hasUnsavedWork(view), false, 'opening a saved draft is read-only');
});

test('edited planning fields and loaded empty drafts keep their original source and identity', async () => {
  const view = renderStudio();
  await tick();
  view.context.chooseSource(asset);
  view.element('field-summary').value = '編集中の計画';
  view.element('product-form').events.input();
  view.context.chooseSource({ ...asset, id: 'C371' });
  view.element('source-to-post').click();
  assert.equal(JSON.parse(view.storage.get('masa-publishing-handoff-v1')).coreId, asset.id);
  assert.equal(view.element('field-summary').value, '編集中の計画');

  const resumed = renderStudio({ products: [{ ...product, source_asset_id: asset.id }] });
  await tick();
  openFirstProduct(resumed);
  resumed.context.chooseSource(asset);
  assert.equal(resumed.element('field-slug').value, product.slug, 'reselecting same source cannot turn saved draft into a new draft');
  resumed.context.chooseSource({ ...asset, id: 'C371' });
  assert.equal(resumed.element('field-slug').value, product.slug);
  resumed.element('source-to-post').click();
  assert.equal(JSON.parse(resumed.storage.get('masa-publishing-handoff-v1')).coreId, asset.id);
});

test('saving a draft retains a source that is absent from the current asset list', async () => {
  const view = renderStudio({ products: [product] });
  await tick();openFirstProduct(view);
  let payload;
  view.context.fetch = async (url, options) => {
    if (options?.method === 'POST') { payload = JSON.parse(options.body);return { ok: true, json: async () => ({ ok: true, data: { version: 4 } }) }; }
    return { ok: true, json: async () => ({ ok: true, data: { assets: [], knowledge: [], products: [product] } }) };
  };
  await view.element('product-form').events.submit({ preventDefault() {} });
  assert.equal(payload.sourceAssetId, product.source_asset_id);
  assert.equal(payload.expectedVersion, 3);
  assert.equal(payload.slug, product.slug);
});

test('typing during a slow save remains unsaved and duplicate submits cannot race', async () => {
  const view = renderStudio({ products: [product] });
  await tick();openFirstProduct(view);
  view.element('product-body').value = '送信する原稿';
  view.element('product-form').events.input();
  let complete, writes = 0;
  const initialFetch = view.context.fetch;
  view.context.fetch = async (url, options) => {
    if (options?.method !== 'POST') return initialFetch();
    writes++;
    await new Promise(resolve => { complete = resolve; });
    return { ok: true, json: async () => ({ ok: true, data: { version: 4 } }) };
  };
  const save = view.element('product-form').events.submit({ preventDefault() {} });
  await view.element('product-form').events.submit({ preventDefault() {} });
  view.element('new-product').click();
  assert.match(view.element('studio-status').textContent, /保存中/);
  openFirstProduct(view);
  assert.match(view.element('studio-resume-status').textContent, /保存中/);
  view.context.chooseSource({ ...asset, id: 'C371' });
  assert.match(view.element('studio-status').textContent, /保存中/);
  view.element('product-body').value = '保存中に追記した原稿';
  view.element('product-form').events.input();
  complete();await save;
  assert.equal(writes, 1);
  assert.equal(view.element('product-body').value, '保存中に追記した原稿');
  assert.match(view.element('studio-save-status').textContent, /その後の編集は未保存/);
  assert.equal(hasUnsavedWork(view), true);
  openFirstProduct(view);
  assert.match(view.element('studio-resume-status').textContent, /原稿を上書きしていません/);
});

test('successful unchanged save clears unsaved state; edits during the refresh remain dirty', async () => {
  for (const editDuringRefresh of [false, true]) {
    const view = renderStudio();await tick();
    const initialFetch = view.context.fetch;
    view.element('product-form').events.input();
    view.context.fetch = async (url, options) => {
      if (options?.method === 'POST') return { ok: true, json: async () => ({ ok: true, data: { version: 1 } }) };
      if (editDuringRefresh) view.element('product-form').events.input();
      return initialFetch();
    };
    await view.element('product-form').events.submit({ preventDefault() {} });
    assert.equal(hasUnsavedWork(view), editDuringRefresh);
    assert.match(view.element('studio-save-status').textContent, editDuringRefresh ? /未保存/ : /下書きを保存しました/);
  }
});

test('existing core needs explicit replacement consent and failure offers a real retry', async () => {
  const view = renderStudio({ confirm: false, knowledge: [{ title: '概念', domain: '', summary: '別の核', status: '', visibility: '', sources: [] }] });
  await tick();view.element('field-core').value = '残したい核';
  view.element('concept-list').children[0].children.at(-1).click();
  assert.equal(view.confirmations(), 1);
  assert.equal(view.element('field-core').value, '残したい核');

  const failed = renderStudio({ readFails: true });await tick();
  assert.match(failed.element('product-list').textContent, /取得できません/);
  assert.match(failed.element('studio-resume-status').children[1].textContent, /再読み込み/);
  failed.context.fetch = view.context.fetch;
  await failed.element('studio-resume-status').children[1].events.click();
  assert.match(failed.element('product-list').children[0].textContent, /まだ教材の下書きはありません/);
});
