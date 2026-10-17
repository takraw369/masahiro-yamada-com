import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
const root = process.cwd();
const model = JSON.parse(readFileSync(join(root,'src/data/modelCanvas.json'),'utf8'));
test('model canvas objects, relations and views remain linked', () => {
  assert.equal(model.objects.length,12);
  assert.equal(model.relations.length,16);
  assert.equal(model.screens.length,8);
  const ids = new Set(model.objects.map(item=>item.id));
  assert.equal(ids.size,model.objects.length);
  for(const item of model.objects) assert.ok(model.groups.some(group=>group.id===item.group));
  for(const edge of model.relations) {
    assert.ok(ids.has(edge.from),edge.from);
    assert.ok(ids.has(edge.to),edge.to);
  }
  for(const screen of model.screens) {
    for(const id of screen.objects) assert.ok(ids.has(id),screen.id+':'+id);
    if(screen.implementation === 'verified') {
      assert.ok(screen.href,'Verified route missing: '+screen.id);
      const route = screen.href === '/dashboard'
        ? 'src/pages/dashboard/index.astro'
        : screen.href.startsWith('/dashboard/')
          ? 'src/pages/'+screen.href.substring(1)+'.astro'
          : 'public/'+screen.href.substring(1);
      assert.ok(existsSync(join(root,route)),'Unknown verified route: '+route);
    } else {
      assert.equal(screen.href,null,'Proposed screen must not have an unverified live link');
    }
  }
});
test('model canvas remains private read-only and discoverable',()=>{
  const page=readFileSync(join(root,'src/pages/dashboard/model-canvas.astro'),'utf8');
  const ui=readFileSync(join(root,'src/components/dashboard/ModelCanvas.tsx'),'utf8');
  const nav=readFileSync(join(root,'src/layouts/DashboardLayout.astro'),'utf8');
  const catalog=readFileSync(join(root,'src/data/dashboardAppCatalog.ts'),'utf8');
  assert.match(page,/DashboardLayout/);
  assert.match(ui,/実DBのスキーマではありません/);
  assert.doesNotMatch(ui,/fetch\s*\(/);
  assert.match(nav,/dashboard\/model-canvas/);
  assert.match(catalog,/dashboard\/model-canvas/);
});
