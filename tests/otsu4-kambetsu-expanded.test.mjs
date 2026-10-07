import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const source=readFileSync(new URL('../src/pages/otsu4/kambetsu/index.astro',import.meta.url),'utf8');

const added=[
'回路計','絶縁抵抗計','騒音計','接地抵抗計','検電器','加熱試験器用の火口',
'ねじなし電線管','ノーマルベンド','ボックスコネクタ','サドル','絶縁ブッシング','アウトレットボックス'
];

test('Kambetsu keeps the original additions and moves to lecture-order staging',()=>{
  assert.match(source,/乙4 鑑別｜講習順/);
  assert.match(source,/lectureOrderNames=\[/);
  assert.match(source,/function unlockedCount\(\)/);
  assert.match(source,/6\+Math\.floor\(mastered\/4\)\*3/);
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
  assert.match(source,/if\(base\.length>=active\.length\+8\)break/);
});


test('lecture handoff items are included without dumping them all at session start',()=>{
  const names=[
    'マノメーター','テストポンプ','メーターリレー試験器','減光フィルター',
    '密閉型蓄電池','終端器（終端抵抗）','P型1級受信機','P型2級受信機（多回線用）',
    'P型1級発信機','P型2級発信機','光電式分離型感知器','紫外線式スポット型感知器',
    '補償式スポット型感知器','光電式スポット型感知器','イオン化式スポット型感知器',
    '定温式感知線型感知器','差動式分布型感知器（空気管式）','差動式分布型感知器（熱電対式）'
  ];
  for(const name of names) assert.ok(source.includes("name:'"+name+"'"),name);
  assert.match(source,/const active=orderedTools\.slice\(0,unlocked\)/);
  assert.match(source,/if\(after>before\)/);
});

test('teacher order begins with the first photographed wiring-material page',()=>{
  assert.match(source,/lectureOrderNames=\[\s*\n'ねじなし電線管','ノーマルベンド','ボックスコネクタ','サドル','絶縁ブッシング','アウトレットボックス'/);
  assert.ok(source.indexOf("'マノメーター'")>source.indexOf("'加熱試験器用の火口'"));
  assert.ok(source.indexOf("'P型1級受信機'")>source.indexOf("'紫外線式スポット型感知器'"));
});
