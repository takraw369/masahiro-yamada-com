import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,existsSync} from 'node:fs';
import {resolve} from 'node:path';

const root=resolve(import.meta.dirname,'..');
const entry=readFileSync(resolve(root,'src/pages/dashboard/design-templates.astro'),'utf8');
const route='src/pages/dashboard/design-templates/screenshot.astro';
const editor=readFileSync(resolve(root,route),'utf8');

test('Screenshot Studio is reachable from the canonical Design Studio',()=>{
  assert.ok(existsSync(resolve(root,route)));
  assert.match(entry,/href="\/dashboard\/design-templates\/screenshot"/);
  assert.match(editor,/DashboardLayout/);
  assert.match(editor,/href="\/dashboard\/design-templates"/);
});

test('Screenshot Studio uses local canvas export without paid API or image uploads',()=>{
  assert.match(editor,/<canvas id="shot-canvas"/);
  assert.match(editor,/canvas\.toBlob\(/);
  assert.match(editor,/URL\.createObjectURL\(blob\)/);
  assert.match(editor,/image\/png/);
  assert.doesNotMatch(editor,/\bfetch\s*\(|XMLHttpRequest|navigator\.sendBeacon|api\.openai|stripe/i);
});

test('Screenshot Studio offers composition, preview, aspect ratios, and safe file handling',()=>{
  for(const id of ['shot-file','shot-title','shot-subtitle','shot-format','shot-theme','shot-frame','shot-density','shot-download','shot-status']){
    assert.match(editor,new RegExp('id="'+id+'"'));
  }
  assert.match(editor,/file\.size>20\*1024\*1024/);
  assert.match(editor,/MAXLINE|textLines/);
  assert.match(editor,/window\.setTimeout\(\(\)=>URL\.revokeObjectURL/);
  assert.match(editor,/@media\(max-width:900px\)/);
});
