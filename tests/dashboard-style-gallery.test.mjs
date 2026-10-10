import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';

const root = new URL('../', import.meta.url);
const read = path => readFile(new URL(path, root), 'utf8');
const styleIds = ['dawn','night','ocean','glass','editorial','quest'];
const layoutIds = ['focus','split','journey','tiles','editorial','studio'];

test('six original style thumbnails and six genuinely different layout diagrams exist', async () => {
  const [styles, layouts, css] = await Promise.all([
    read('src/data/homeDesignPresets.ts'),
    read('src/data/homeDesignCombinations.ts'),
    read('src/styles/dashboard-home-presets.css'),
  ]);
  const diagrams = [];
  for (const id of styleIds) {
    assert.match(styles,new RegExp("id: '"+id+"'"));
    assert.ok(css.includes('data-home-preset="'+id+'"'),id);
    const svg = await read('public/assets/dashboard-style-presets/'+id+'.svg');
    assert.match(svg,/<svg[^>]*viewBox="0 0 720 440"/);
  }
  for (const id of layoutIds) {
    assert.match(layouts,new RegExp("id:'"+id+"'"));
    const svg=await read('public/assets/dashboard-layout-presets/'+id+'.svg');
    assert.match(svg,/<svg[^>]*viewBox="0 0 720 440"/);
    assert.ok(svg.includes('FOCUS') && svg.includes('FLOW') && svg.includes('OUTPUT'),id);
    diagrams.push(svg);
  }
  assert.equal(new Set(diagrams).size,6,'layout SVGs must be unique, not recolored copies');
});

test('gallery provides independent style, structure, 4 component groups and live composite preview',async()=>{
  const [page,ui,css] = await Promise.all([
    read('src/pages/dashboard/design-templates.astro'),
    read('src/components/dashboard/HomeDesignConfigurator.tsx'),
    read('src/styles/dashboard-design-studio.css'),
  ]);
  assert.match(page,/HomeDesignConfigurator client:only="react"/);
  assert.match(ui,/studio-style/);
  assert.match(ui,/studio-layout/);
  assert.match(ui,/studio-parts/);
  assert.match(ui,/studio-preview/);
  assert.match(ui,/data-style=\{choice.style\}/);
  assert.match(ui,/data-layout=\{choice.layout\}/);
  for (const group of ['buttons','cards','navigation','cta']) {
    assert.ok(css.includes('data-'+group+'='),'preview CSS for '+group);
    assert.match(ui,new RegExp("key:'"+group+"'"));
  }
  for(const id of layoutIds) assert.ok(css.includes('data-layout="'+id+'"'));
  assert.match(ui,/aria-pressed=/);
  assert.match(ui,/scrollIntoView/);
  assert.match(css,/@media\(max-width:359px\)/);
  assert.match(css,/@media\(max-width:430px\)/);
  assert.match(css,/@media\(prefers-reduced-motion:reduce\)/);
});

test('explicit, validated device-only application, favorites and standard reset',async()=>{
  const [logic,ui,home,middleware] = await Promise.all([
    read('src/data/homeDesignCombinations.ts'),
    read('src/components/dashboard/HomeDesignConfigurator.tsx'),
    read('src/pages/dashboard/index.astro'),
    read('src/middleware.ts'),
  ]);
  assert.match(logic,/isHomeDesignConfig/);
  assert.match(logic,/parseHomeDesign/);
  assert.match(logic,/HOME_DESIGN_STORAGE_KEY/);
  assert.match(logic,/HOME_PRESET_STORAGE_KEY/);
  assert.match(logic,/Corrupt v2 never falls back/);
  assert.match(ui,/writeHomeDesign\(localStorage,choice\)/);
  assert.match(ui,/resetHomeDesign\(localStorage\)/);
  assert.match(ui,/HOME_DESIGN_FAVORITES_KEY/);
  assert.match(ui,/readFavorites/);
  assert.match(ui,/setFavorites\(next\)/);
  assert.doesNotMatch(ui,/fetch\(['"]\/api\//);
  assert.match(home,/loadHomeDesign\(localStorage\)/);
  for (const key of ['preset','layout','buttons','cards','navigation','cta']) {
    assert.ok(home.includes("'data-home-"+key+"'"),key);
  }
  assert.match(home,/home-design-indicator/);
  assert.match(middleware,/pathname\.startsWith\('\/dashboard'\)/);
});

test('structural choices really rearrange production home regions while the baseline is untouched',async()=>{
  const [home,styles] = await Promise.all([
    read('src/pages/dashboard/index.astro'),
    read('src/styles/dashboard-home-presets.css'),
  ]);
  for (const region of ['cockpit','revenue','flow','output']) {
    assert.match(home,new RegExp('home-unit--'+region));
  }
  assert.match(styles,/\.home-layout-grid\{display:contents\}/);
  assert.match(styles,/home-layout-grid\{display:grid/);
  assert.match(styles,/grid-template-columns:repeat\(12,minmax\(0,1fr\)\)/);
  for (const layout of layoutIds) assert.ok(styles.includes('data-home-layout="'+layout+'"'));
  for (const group of ['buttons','cards','navigation','cta']) assert.ok(styles.includes('data-home-'+group+'='));
  assert.match(styles,/@media\(max-width:1159px\)/);
  assert.match(styles,/@media\(max-width:620px\)/);
  assert.match(styles,/\.home-quick-nav\[hidden\]\{display:none!important\}/);
  assert.match(home,/home-style-preview-rail/);
  assert.match(home,/design-templates\?style=/);
});
