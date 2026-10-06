import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const source=readFileSync(new URL('../src/pages/otsu4/kambetsu/index.astro',import.meta.url),'utf8');

const added=[
'回路計','絶縁抵抗計','騒音計','接地抵抗計','検電器','加熱試験器用の火口',
'ねじなし電線管','ノーマルベンド','ボックスコネクタ','サドル','絶縁ブッシング','アウトレットボックス'
];

test('Kambetsu expands from 12 to 24 items',()=>{
  assert.match(source,/乙4 鑑別｜24種/);
  assert.match(source,/鑑別・24種/);
  for(const name of added) assert.ok(source.includes("name:'"+name+"'"),name);
});

test('new items carry name aliases, use grading and reference images',()=>{
  for(const name of added){
    const i=source.indexOf("name:'"+name+"'");
    assert.ok(i>=0,name);
    const slice=source.slice(i,i+520);
    assert.match(slice,/aliases:\[/,name);
    assert.match(slice,/use:/,name);
    assert.match(slice,/useGroups:\[/,name);
    assert.match(slice,/files:\[/,name);
  }
});

test('adaptive repeat limits scale with expanded tool count',()=>{
  assert.match(source,/if\(deck\.length>=tools\.length\+12\)return/);
  assert.match(source,/if\(base\.length>=tools\.length\+8\)break/);
});
