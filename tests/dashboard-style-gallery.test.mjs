import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';

const root = new URL('../', import.meta.url);
const read = path => readFile(new URL(path, root), 'utf8');
const ids = ['dawn','night','ocean','glass','editorial','quest'];

test('each dashboard preset has a real unique local sample image and CSS theme', async () => {
  const [data, css] = await Promise.all([
    read('src/data/homeDesignPresets.ts'),
    read('src/styles/dashboard-home-presets.css'),
  ]);
  for (const id of ids) {
    assert.match(data, new RegExp("id: '"+id+"'"));
    assert.ok(css.includes('data-home-preset="'+id+'"'), id+' theme has CSS');
    const image = await read('public/assets/dashboard-style-presets/'+id+'.svg');
    assert.match(image, /<svg[^>]*viewBox="0 0 720 440"/);
    assert.ok(image.includes('</svg>'), id+' image is complete');
  }
});

test('gallery is isolated, user-initiated and has reset flow', async () => {
  const [gallery, home, layout, middleware] = await Promise.all([
    read('src/pages/dashboard/design-templates.astro'),
    read('src/pages/dashboard/index.astro'),
    read('src/layouts/DashboardLayout.astro'),
    read('src/middleware.ts'),
  ]);
  assert.match(gallery, /data-preset-select/);
  assert.match(gallery, /preview-stage/);
  assert.match(gallery, /localStorage\.setItem\(HOME_PRESET_STORAGE_KEY, chosen\)/);
  assert.match(gallery, /localStorage\.removeItem\(HOME_PRESET_STORAGE_KEY\)/);
  assert.match(gallery, /ホームに適用/);
  assert.doesNotMatch(gallery, /fetch\(['"]\/api\//);
  assert.match(home, /isHomeDesignPreset\(raw\)/);
  assert.match(home, /setAttribute\('data-home-preset', raw\)/);
  assert.match(layout, /\/dashboard\/design-templates/);
  assert.match(middleware, /pathname\.startsWith\('\/dashboard'\)/);
});

test('theme presets remain limited to home and protect narrow phones', async () => {
  const [css, gallery] = await Promise.all([
    read('src/styles/dashboard-home-presets.css'),
    read('src/pages/dashboard/design-templates.astro'),
  ]);
  assert.match(css, /\.dash-shell\[data-home-preset/);
  assert.match(css, /home-design-indicator\[hidden\]/);
  assert.match(gallery, /@media\(max-width:359px\)/);
  assert.match(gallery, /@media\(prefers-reduced-motion:reduce\)/);
});
