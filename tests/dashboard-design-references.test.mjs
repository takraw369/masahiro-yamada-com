import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
import { stripTypeScriptTypes } from 'node:module';
const read=p=>readFile(new URL('../'+p,import.meta.url),'utf8');
const sources=await Promise.all(['src/data/homeDesignPresets.ts','src/data/homeDesignCombinations.ts','src/data/dashboardDesignReferences.ts'].map(read));
const code=sources.map(source=>stripTypeScriptTypes(source.replace(/^import .*;\n/gm,''))).join('\n');
const api=await import('data:text/javascript;base64,'+Buffer.from(code).toString('base64'));

test('five durable references provide unique, valid orange arrangements and safe source URLs',()=>{
  assert.equal(api.dashboardDesignReferences.length,5);
  assert.equal(new Set(api.dashboardDesignReferences.map(item=>item.id)).size,5);
  assert.equal(new Set(api.dashboardDesignReferences.map(item=>JSON.stringify(item.config))).size,5);
  for(const item of api.dashboardDesignReferences){
    assert.ok(api.isHomeDesignConfig(item.config));
    assert.equal(item.config.style,'orange');assert.equal(new URL(item.url).protocol,'https:');
    for(const key of ['structure','spacing','navigation','mobile'])assert.ok(item[key].length>0);
    for(const phone of [true,false])assert.deepEqual([...api.homeRegionOrder(item.config.layout,phone)].sort(),['cockpit','flow','output','revenue']);
  }
});

test('reference favorite, note and preview survive reload without applying a home design',()=>{
  const writes=new Map(), storage={setItem:(key,value)=>writes.set(key,value)};
  const state={version:1,previewId:'shadcn',favorites:['shadcn','catalyst'],notes:{shadcn:'余白が好き。あとで選ぶ。'}};
  api.writeDashboardReferenceState(storage,state);
  assert.deepEqual(api.parseDashboardReferenceState(writes.get(api.DASHBOARD_REFERENCE_STORAGE_KEY)),state);
  assert.equal(writes.has(api.HOME_DESIGN_STORAGE_KEY),false);
  assert.equal(writes.has(api.HOME_DESIGN_FAVORITES_KEY),false);
  const config=api.dashboardDesignReferences[0].config;
  api.writeHomeDesign(storage,config);
  assert.deepEqual(api.parseHomeDesign(writes.get(api.HOME_DESIGN_STORAGE_KEY)),config);
  api.resetHomeDesign({removeItem:key=>writes.delete(key)});
  assert.deepEqual(api.parseDashboardReferenceState(writes.get(api.DASHBOARD_REFERENCE_STORAGE_KEY)),state);
});

test('corrupt or unknown reference state is bounded and never trusted',()=>{
  for(const raw of [null,'','broken','null','[]','{}','x'.repeat(20001),'{"version":2}'])assert.deepEqual(api.parseDashboardReferenceState(raw),api.emptyDashboardReferenceState());
  const value=api.parseDashboardReferenceState(JSON.stringify({version:1,previewId:'invalid',favorites:['shadcn','shadcn',{},'invalid','tabler'],notes:{shadcn:'a'.repeat(800),tabler:2,invalid:'discard'},extra:'discard'}));
  assert.equal(value.previewId,null);assert.deepEqual(value.favorites,['shadcn','tabler']);
  assert.equal(value.notes.shadcn.length,600);assert.deepEqual(Object.keys(value.notes),['shadcn']);assert.equal(value.extra,undefined);
  assert.throws(()=>api.writeDashboardReferenceState({setItem:()=>{throw new Error('quota')}},value),/quota/);
});

test('reference diagrams are original and distinct; small-screen controls remain usable',async()=>{
  const images=await Promise.all(api.dashboardDesignReferences.map(item=>read('public/assets/dashboard-reference-presets/'+item.id+'.svg')));
  assert.equal(new Set(images).size,5);
  for(const svg of images){assert.match(svg,/viewBox="0 0 720 440"/);assert.match(svg,/#ee7800/);assert.doesNotMatch(svg,/<script|href=["']https?:|<image/);}
  const [css,ui,gallery,home]=await Promise.all(['src/styles/dashboard-design-references.css','src/components/dashboard/HomeDesignConfigurator.tsx','src/components/dashboard/DashboardDesignReferenceGallery.tsx','src/styles/dashboard-home-presets.css'].map(read));
  assert.match(css,/min-height:44px/);assert.match(css,/font-size:16px/);assert.match(css,/minmax\(0,1fr\)/);assert.match(css,/data-panel="references"/);
  assert.match(ui,/panels\.length/);assert.match(ui,/clearReferencePreview/);assert.match(gallery,/noopener noreferrer/);
  assert.match(home,/--preset-brand:#ee7800/);assert.match(home,/--preset-cta-ink:#171717/);
  assert.doesNotMatch(ui,/fetch\(['"]\/api\//);
});
