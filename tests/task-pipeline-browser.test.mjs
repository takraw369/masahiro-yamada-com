import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile, mkdtemp, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execFile, execFileSync } from 'node:child_process';
import { promisify } from 'node:util';
import { pathToFileURL } from 'node:url';

const run = promisify(execFile);
const sourcePath = new URL('../src/pages/dashboard/pipeline.astro', import.meta.url);
const fixture = [
  { taskId:'T-001', task:'期限切れの確認', project:'ACE', status:'NOW', executionLane:'AI_RUN', priority:'S', dueDate:'2020-01-01', nextAction:'確認する' },
  { taskId:'T-002', task:'特別な対象', project:'SLF', status:'NEXT', executionLane:'MASA_GATE', priority:'A', dueDate:'2099-12-30', nextAction:'意思決定する' },
  { taskId:'T-003', task:'検証作業', project:'WEB', status:'REVIEW', executionLane:'AI_RUN', nextAction:'結果を見る' },
  { taskId:'T-004', task:'外部待機', project:'ACE', status:'WAIT', executionLane:'MASA_GATE', nextAction:'待機' },
  { taskId:'T-005', task:'公開完了', project:'WEB', status:'DONE', executionLane:'AI_RUN', nextAction:'記録' },
  { taskId:'T-006', task:'新規タスク', project:'ACE', status:'UNKNOWN', executionLane:'AI_RUN', nextAction:'分類する' }
];

function chromiumPath() {
  for (const name of ['google-chrome', 'chromium', 'chromium-browser']) {
    try {
      const found = execFileSync('which', [name], {encoding:'utf8',stdio:['ignore','pipe','ignore']}).trim();
      if (found) return found;
    } catch {}
  }
  return '';
}

function assemblePage(astroSource) {
  const body = astroSource.match(/<DashboardLayout[^>]*>([\s\S]*?)<\/DashboardLayout>/)?.[1];
  const script = astroSource.match(/<script is:inline>([\s\S]*?)<\/script>/)?.[1];
  const css = astroSource.match(/<style is:global>([\s\S]*?)<\/style>/)?.[1];
  assert.ok(body && script && css, 'review fixture must use the real Pipeline HTML, JS and CSS');
  const data = JSON.stringify({ok:true,items:fixture,summary:{lastSourceSyncAt:'2026-10-14T08:00:00Z'}});
  return '<!doctype html><html lang="ja"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1">'+
    '<style>*{box-sizing:border-box}body{margin:0;padding:12px;font-family:Arial,sans-serif;background:#f3f1ed;color:#17191c}</style>'+
    '<style>'+css+'</style></head><body>'+
    body+
    '<script>window.fetch=async()=>({ok:true,json:async()=>('+JSON.stringify(JSON.parse(data))+')});</script>'+
    '<script>'+script+'</script>'+
    '<script>setTimeout(()=>{'+
    'const initialCount=document.querySelectorAll(".pipeline-task").length;'+
    'const first=document.querySelector(".pipeline-task");first?.click();'+
    'const detailOpens=document.getElementById("pipeline-detail")?.open===true;'+
    'document.getElementById("pipeline-detail")?.close();'+
    'const search=document.getElementById("pipeline-search");search.value="特別";search.dispatchEvent(new Event("input",{bubbles:true}));'+
    'const searchCount=document.querySelectorAll(".pipeline-task").length;'+
    'const gate=document.querySelector("[data-scope=gate]");gate?.click();'+
    'const gateCount=document.querySelectorAll(".pipeline-task").length;'+
    'const audit={viewport:innerWidth,scrollWidth:document.documentElement.scrollWidth,initialCount,detailOpens,searchCount,gateCount,lanes:document.querySelectorAll(".pipeline-lane").length,alert:document.getElementById("pipeline-alert-title")?.textContent};'+
    'const result=document.createElement("pre");result.id="layout-audit";result.textContent=JSON.stringify(audit);document.body.appendChild(result);'+
    '},400);</script></body></html>';
}

test('real Pipeline HTML / JS / CSS works in headless Chromium at desktop and mobile widths', {timeout:60000}, async t => {
  const browser = chromiumPath();
  if (!browser) return t.skip('Chromium not present: manual device and UI QA remain required');
  const source = await readFile(sourcePath, 'utf8');
  const dir = await mkdtemp(join(tmpdir(), 'masa-pipeline-review-'));
  try {
    // Chrome clamps top-level windows below 500 CSS px. srcdoc iframes have
    // genuine independent 320/375/390/430px CSS viewports and media queries.
    const widths = [320,375,390,430,1440];
    const childHtml = JSON.stringify(assemblePage(source)).replaceAll('</','<\\/');
    const frameScript = [
      'const widths='+JSON.stringify(widths)+';',
      'const markup='+childHtml+';',
      'const results=[];',
      'for(const width of widths){',
      '  const frame=document.createElement("iframe");',
      '  frame.setAttribute("title","Pipeline width "+width);',
      '  frame.style.cssText="width:"+width+"px;height:1200px;border:0;display:block";',
      '  frame.dataset.requestedWidth=String(width);',
      '  frame.srcdoc=markup;',
      '  document.body.appendChild(frame);',
      '}',
      'let attempts=0;',
      'const timer=setInterval(()=>{',
      '  attempts++;',
      '  const collected=Array.from(document.querySelectorAll("iframe")).map(frame=>({',
      '    width:Number(frame.dataset.requestedWidth),',
      '    audit:frame.contentDocument?.getElementById("layout-audit")?.textContent||null',
      '  }));',
      '  if(collected.every(row=>row.audit)||attempts>=60){',
      '    clearInterval(timer);',
      '    const marker=document.createElement("pre");marker.id="audit-results";',
      '    marker.textContent=JSON.stringify(collected.map(row=>({width:row.width,result:row.audit?JSON.parse(row.audit):null})));',
      '    document.body.appendChild(marker);',
      '  }',
      '},50);'
    ].join('\n');
    const frameHost='<!doctype html><html><head><meta charset="UTF-8"></head><body>'+
      '<script>'+frameScript+'</script></body></html>';
    const path = join(dir,'index.html');
    await writeFile(path,frameHost,'utf8');
    const args = ['--headless=new','--no-sandbox','--disable-gpu','--disable-dev-shm-usage',
      '--no-first-run','--hide-scrollbars','--window-size=1600,900','--force-device-scale-factor=1',
      '--virtual-time-budget=4500','--dump-dom',pathToFileURL(path).href];
    const {stdout} = await run(browser,args,{timeout:25000,maxBuffer:10*1024*1024,env:{...process.env,HOME:dir}});
    const raw = stdout.match(/<pre id="audit-results">([^<]+)<\/pre>/)?.[1];
    assert.ok(raw,'browser fixture did not reach interaction assertions');
    const checks=JSON.parse(raw.replace(/&quot;/g,'"').replace(/&amp;/g,'&'));
    assert.equal(checks.length,widths.length);
    for (const {width,result} of checks) {
      assert.ok(result,'no Pipeline audit at '+width);
      assert.ok(Math.abs(result.viewport-width)<=2,'viewport mismatch: requested '+width+' got '+result.viewport);
      assert.ok(result.scrollWidth<=result.viewport+1,'horizontal BODY overflow @'+width+': '+result.scrollWidth);
      assert.equal(result.initialCount,5,'active phases must contain exactly five mock tasks');
      assert.equal(result.detailOpens,true,'details must open');
      assert.equal(result.searchCount,1,'search must narrow results');
      assert.equal(result.gateCount,1,'MASA Gate filter must preserve search');
      assert.equal(result.lanes,5,'active view must display five lanes');
      assert.ok(result.alert.includes('期限超過') && result.alert.includes('MASA判断待ち'));
    }
  } finally {
    await rm(dir,{recursive:true,force:true});
  }
});
