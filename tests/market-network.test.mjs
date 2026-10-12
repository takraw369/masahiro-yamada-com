import test from 'node:test';
import assert from 'node:assert/strict';
import {
  parseMarketDataset, buildRelationIndex, companyRelations, networkNeighbors,
  evidenceShardPath, searchMarketCompanies,
} from '../src/lib/marketNetwork.ts';

const m4 = { dataset_id: 'a'.repeat(24), companies: {
  '7203': { name: 'トヨタ自動車', name_kana: 'トヨタジドウシャ' },
  '3116': { name: 'トヨタ紡織' },
  '9984': { name: 'ソフトバンクグループ' },
} };
const listed = key => ({ type: 'listed', key });
const entity = key => ({ type: 'entity', key });
const rel = (id, a, b, category, status = 'confirmed') => ({
  relation_id: 'R' + id, source: a, target: b, category, relation_type: 'ownership',
  status, evidence: [], verification: { status: 'unverified' },
});
const m5 = {
  dataset_id: m4.dataset_id, generated_at: '2026-09-20T00:00:00Z',
  entities: { 'ENT1': { name: '非上場取引先' } },
  relations: [
    rel(1, listed('7203'), listed('3116'), 'capital'),
    rel(2, listed('7203'), entity('ENT1'), 'transaction'),
    rel(3, listed('9984'), listed('7203'), 'alliance', 'needs_review'),
    rel(4, listed('7203'), listed('9984'), 'personnel', 'historical'),
  ],
  evidence_shards: { size: 1000, path: 'data/' + m4.dataset_id + '/evidence/{shard}.json' },
};

test('reject mismatched or incomplete published snapshots before displaying relations', () => {
  assert.throws(() => parseMarketDataset(m4, { ...m5, dataset_id: 'different' }), /一致しません/);
  assert.throws(() => parseMarketDataset({}, m5), /一致しません/);
  assert.equal(parseMarketDataset(m4, m5).datasetId, m4.dataset_id);
});
test('normalize full-width codes, kana and name searches', () => {
  const data = parseMarketDataset(m4, m5), index = buildRelationIndex(data);
  assert.equal(searchMarketCompanies(data, index, '７２０３')[0].code, '7203');
  assert.equal(searchMarketCompanies(data, index, 'とよた')[0].code, '7203');
  assert.equal(searchMarketCompanies(data, index, 'ソフトバンク')[0].code, '9984');
  assert.equal(searchMarketCompanies(data, index, '').length, 0);
});
test('exclude uncertain and past relations by default but retain source-facing opt-in', () => {
  const data = parseMarketDataset(m4, m5), index = buildRelationIndex(data);
  const current = companyRelations(index, '7203', new Set());
  assert.deepEqual(current.map(x => x.relation.relation_id), ['R1', 'R2']);
  assert.equal(companyRelations(index, '7203', new Set(), true).length, 4);
  assert.equal(companyRelations(index, '7203', new Set(['capital'])).length, 1);
});
test('show bounded company-centered graph including unlisted counterparties', () => {
  const data = parseMarketDataset(m4, m5), index = buildRelationIndex(data);
  const related = networkNeighbors(companyRelations(index, '7203', new Set()), 1);
  assert.equal(related.length, 1);
  assert.equal(related[0].count, 1);
});
test('only construct immutable evidence path on the trusted source host', () => {
  const data = parseMarketDataset(m4, m5);
  assert.match(evidenceShardPath(data, 'R1001') || '', /evidence\/0001\.json$/);
  assert.equal(evidenceShardPath(data, 'invalid'), null);
  data.evidenceShards = { size: 100, path: 'https://evil.example/{shard}.json' };
  assert.equal(evidenceShardPath(data, 'R1'), null);
});
