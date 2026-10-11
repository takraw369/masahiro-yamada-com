import assert from 'node:assert/strict';
import test from 'node:test';
import {readFile} from 'node:fs/promises';
import {stripTypeScriptTypes} from 'node:module';
import vm from 'node:vm';
const read=p=>readFile(new URL('../'+p,import.meta.url),'utf8');
const presets=stripTypeScriptTypes(await read('src/data/homeDesignPresets.ts'));
const combinations=stripTypeScriptTypes((await read('src/data/homeDesignCombinations.ts')).replace(/^import.*;\n/,''));
const api=await import('data:text/javascript;base64,'+Buffer.from(presets+'\n'+combinations.replaceAll('export const','const').replaceAll('export function','function')+'\nexport {DEFAULT_HOME_DESIGN,parseHomeDesignPreview,parseHomeDesign,homeRegionOrder};').toString('base64'));
const home=await read('src/pages/dashboard/index.astro');
const script=stripTypeScriptTypes(home.split('<script>')[1].split('</script>')[0].replace(/\s*import .*;\n/,''));

test('preview accepts only bounded v2 allowlisted values and strips extra fields',()=>{
  const valid={...api.DEFAULT_HOME_DESIGN,secret:'not a preference'};
  assert.deepEqual(api.parseHomeDesignPreview(JSON.stringify(valid)),api.DEFAULT_HOME_DESIGN);
  for(const bad of [null,'','[]','null','{}','broken','a'.repeat(1001),JSON.stringify({...valid,version:1}),JSON.stringify({...valid,layout:'unknown'}),JSON.stringify({...valid,style:'url(javascript:evil)'})])assert.equal(api.parseHomeDesignPreview(bad),null);
  assert.equal(api.parseHomeDesign(JSON.stringify({...valid,layout:'unknown'}),'dawn'),null);
});

test('all layouts preserve each real region once on both narrow and wide screens',()=>{
  for(const id of ['focus','split','journey','tiles','editorial','studio'])for(const phone of [true,false])assert.deepEqual([...api.homeRegionOrder(id,phone)].sort(),['cockpit','flow','output','revenue']);
  assert.deepEqual(api.homeRegionOrder('tiles',true),['output','cockpit','revenue','flow']);
  assert.deepEqual(api.homeRegionOrder('journey',true),['flow','cockpit','revenue','output']);
});

function runHome({preview=null,saved=null,width=390}={}){
  const order=['cockpit','revenue','flow','output'];const attrs={};let reads=0,resize;
  const units=Object.fromEntries(order.map(id=>[id,{id}]));
  const grid={querySelector:selector=>units[selector.replace('.home-unit--','')],appendChild:unit=>{order.splice(order.indexOf(unit.id),1);order.push(unit.id)}};
  const shell={setAttribute:(key,value)=>attrs[key]=value,querySelector:()=>grid,getBoundingClientRect:()=>({width})};
  const indicator={hidden:true},nav={hidden:true},label={textContent:''};
  vm.runInNewContext(script,{localStorage:{},location:{search:preview?'?design-preview='+encodeURIComponent(preview):''},URLSearchParams,
    document:{getElementById:id=>({'dashboard-home-shell':shell,'home-design-indicator':indicator,'home-quick-nav':nav,'home-design-label':label})[id]},
    ResizeObserver:class{constructor(fn){resize=fn}observe(){}},
    loadHomeDesign:()=>{reads++;return saved},describeHomeDesign:()=> 'test',parseHomeDesignPreview:api.parseHomeDesignPreview,homeRegionOrder:api.homeRegionOrder});
  return {order,attrs,indicator,nav,reads,resize:newWidth=>{width=newWidth;resize?.()}};
}

test('URL preview does not load or overwrite saved preference and reading order follows resizing',()=>{
  const result=runHome({preview:JSON.stringify({...api.DEFAULT_HOME_DESIGN,layout:'split'}),saved:{...api.DEFAULT_HOME_DESIGN,layout:'tiles'}});
  assert.equal(result.reads,0);assert.equal(result.indicator.hidden,true);assert.deepEqual(result.order,['revenue','cockpit','flow','output']);
  result.resize(1200);assert.deepEqual(result.order,['cockpit','revenue','flow','output']);
});

test('unconfigured Home is untouched; invalid preview falls back to validated saved settings',()=>{
  const baseline=runHome();assert.deepEqual(baseline.attrs,{});assert.deepEqual(baseline.order,['cockpit','revenue','flow','output']);assert.equal(baseline.nav.hidden,true);
  const result=runHome({preview:'[]',saved:{...api.DEFAULT_HOME_DESIGN,layout:'journey'}});assert.equal(result.reads,1);assert.deepEqual(result.order,['flow','cockpit','revenue','output']);
});

test('read-only preview protects real mutation handlers and retains frame protection',async()=>{
  const [cockpit,revenue,layout,headers]=await Promise.all([read('src/components/dashboard/DashboardCockpit.tsx'),read('src/components/dashboard/RevenueMission.tsx'),read('src/layouts/DashboardLayout.astro'),read('src/lib/security/request.mjs')]);
  assert.match(cockpit,/if \(!hydrated \|\| readOnly\) return/);assert.match(cockpit,/if \(readOnly \|\| !text \|\| sending\) return/);
  assert.match(revenue,/const disabled = readOnly \|\|/);assert.match(layout,/inert=\{previewMode\}/);assert.match(headers,/'X-Frame-Options': 'DENY'/);
});
