import test from 'node:test';
import assert from 'node:assert/strict';
import {
  investmentResearchPacks,
  investmentResearchSources,
} from '../src/data/investmentResearchSources.ts';

test('research source registry preserves the original 50-source list', () => {
  const original = investmentResearchSources.filter(source => source.original50);
  assert.equal(original.length, 50);
});

test('research source registry has unique ids and valid URLs', () => {
  const ids = investmentResearchSources.map(source => source.id);
  assert.equal(new Set(ids).size, ids.length);
  for (const source of investmentResearchSources) {
    assert.match(source.url, /^https?:\/\//);
  }
});

test('every research pack points to registered sources', () => {
  const ids = new Set(investmentResearchSources.map(source => source.id));
  for (const pack of investmentResearchPacks) {
    assert.ok(pack.sourceIds.length > 0, `${pack.id} must not be empty`);
    for (const sourceId of pack.sourceIds) assert.ok(ids.has(sourceId), `${pack.id}: missing ${sourceId}`);
  }
});

test('core sources include primary evidence for US and Japan', () => {
  const corePrimary = investmentResearchSources.filter(source => source.priority === 'core' && source.kind === 'primary');
  assert.ok(corePrimary.some(source => source.region === 'us'));
  assert.ok(corePrimary.some(source => source.region === 'jp'));
});
