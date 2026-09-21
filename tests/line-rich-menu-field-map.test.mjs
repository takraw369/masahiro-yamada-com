import test from 'node:test';
import assert from 'node:assert/strict';
import {
  SLF_FIELD_MAP_AREAS,
  SLF_FIELD_MAP_RICH_MENU_CANDIDATE,
  SLF_FIELD_MAP_SIZE,
} from '../src/lib/line-rich-menu-field-map.ts';

test('SLF field map uses LINE full-size rich menu geometry', () => {
  assert.deepEqual(SLF_FIELD_MAP_SIZE, { width: 2500, height: 1686 });
  assert.equal(SLF_FIELD_MAP_AREAS.length, 4);

  const hero = SLF_FIELD_MAP_AREAS[0];
  assert.deepEqual(hero.bounds, { x: 0, y: 160, width: 2500, height: 630 });

  const lower = SLF_FIELD_MAP_AREAS.slice(1);
  assert.equal(lower.every((area) => area.bounds.y === 790), true);
  assert.equal(lower.every((area) => area.bounds.height === 896), true);
  assert.equal(lower.reduce((sum, area) => sum + area.bounds.width, 0), 2500);
  assert.equal(lower[0].bounds.x, 0);
  assert.equal(lower[1].bounds.x, lower[0].bounds.width);
  assert.equal(lower[2].bounds.x, lower[0].bounds.width + lower[1].bounds.width);
});

test('SLF field map routes to existing SLF assets and keeps consultation in LINE', () => {
  const [flowCheck, quest, tips, consult] = SLF_FIELD_MAP_AREAS;

  assert.deepEqual(flowCheck.action, {
    type: 'uri',
    label: 'FLOW CHECK',
    uri: 'https://sunlovesflow.com/flow-check.html',
  });
  assert.deepEqual(quest.action, {
    type: 'uri',
    label: 'QUEST',
    uri: 'https://sunlovesflow.com/quest/want-return/',
  });
  assert.deepEqual(tips.action, {
    type: 'uri',
    label: 'ACE TIPS',
    uri: 'https://sunlovesflow.com/library/',
  });
  assert.deepEqual(consult.action, {
    type: 'message',
    label: 'MASAに相談',
    text: 'MASAに相談したい',
  });
});

test('candidate payload remains a preview manifest, not an activation command', () => {
  assert.equal(SLF_FIELD_MAP_RICH_MENU_CANDIDATE.name, 'SLF FIELD MAP｜Stage 0 EXPLORE');
  assert.equal(SLF_FIELD_MAP_RICH_MENU_CANDIDATE.chatBarText, 'FIELD MAP');
  assert.equal(SLF_FIELD_MAP_RICH_MENU_CANDIDATE.selected, true);
  assert.equal(SLF_FIELD_MAP_RICH_MENU_CANDIDATE.areas.length, 4);
  assert.equal('richMenuId' in SLF_FIELD_MAP_RICH_MENU_CANDIDATE, false);
  assert.equal('activate' in SLF_FIELD_MAP_RICH_MENU_CANDIDATE, false);
});
