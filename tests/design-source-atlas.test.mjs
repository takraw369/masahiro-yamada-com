import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';

const source = await readFile(new URL('../src/components/dashboard/DesignSourceAtlas.astro', import.meta.url), 'utf8');
const css = await readFile(new URL('../src/styles/design-source-atlas.css', import.meta.url), 'utf8');
const newNames = ['BoardUI','Beautiful UI','Bencho','23rd','audiocn','termcn'];

test('Design Studio Atlas registers six new sources and retains existing Arc once', () => {
  for (const name of [...newNames, 'Arc UI']) {
    const matches = [...source.matchAll(new RegExp("name: '"+name.replace(/[.*+?^$\{\}()|\[\]\\]/g,'\\$&')+"'",'g'))];
    assert.equal(matches.length, 1, name+' must have one canonical source card');
  }
  assert.match(source, /totalSources = groups\.reduce/);
  assert.match(source, /data-source-card/);
  assert.match(source, /data-copy-prompt/);
  assert.match(source, /ds-atlas-search/);
  assert.match(source, /navigator\.clipboard\.writeText/);
});

test('external research stays a license-gated review, not copied source or automatic install', () => {
  assert.match(source, /Proコード・画像の無断取得禁止/);
  assert.match(source, /320\/375\/390\/430px/);
  assert.match(source, /Astroのブラウザ画面へ直接導入しない/);
  assert.doesNotMatch(source, /https:\/\/[^'"]+\/r\/.*\.json.*\bimport\b/);
});

test('search hides unmatched elements even when card author styles set display:flex', () => {
  assert.match(css, /\.ds-atlas \[hidden\]\{display:none!important\}/);
  assert.match(source, /card\.hidden = !match/);
  assert.match(source, /section\.hidden = !hasMatch/);
  assert.match(css, /min-height:44px/);
  assert.match(css, /font-size:16px/);
});
