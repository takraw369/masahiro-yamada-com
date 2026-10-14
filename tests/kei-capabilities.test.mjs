import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const groups = JSON.parse(readFileSync(new URL('../src/data/keiCapabilities.json', import.meta.url), 'utf8'));
const states = new Set(['ready', 'gated', 'building', 'pro']);
const entries = groups.flatMap((group) => group.items.map((item) => ({ ...item, group: group.id })));

test('KEI capabilities registry preserves all approved baseline cards', () => {
  assert.ok(Array.isArray(groups));
  assert.ok(groups.length >= 10, 'Do not accidentally drop existing capability groups');
  assert.ok(entries.length >= 41, 'Do not accidentally drop existing capability cards');
  assert.ok(entries.find((x) => x.id === 'assetize'));
  assert.ok(entries.find((x) => x.id === 'rsvp'));
  assert.ok(entries.find((x) => x.id === 'anatomy-interactive'), 'Anatomy interactive diagram card is required');
  assert.ok(entries.find((x) => x.id === 'dots-tracking'));
});

test('KEI registry has stable, unique IDs and user-readable fields', () => {
  const groupIds = new Set();
  const cardIds = new Set();
  for (const group of groups) {
    assert.match(group.id, /^[a-z][a-z0-9-]*$/);
    assert.ok(!groupIds.has(group.id), `duplicate group: ${group.id}`);
    groupIds.add(group.id);
    for (const key of ['label', 'english', 'intro']) {
      assert.ok(typeof group[key] === 'string' && group[key].trim(), `missing group ${key}`);
    }
    assert.ok(Array.isArray(group.items) && group.items.length > 0, `empty group: ${group.id}`);
    for (const item of group.items) {
      assert.match(item.id, /^[a-z][a-z0-9-]*$/);
      assert.ok(!cardIds.has(item.id), `duplicate card: ${item.id}`);
      cardIds.add(item.id);
      assert.ok(states.has(item.status), `unknown status: ${item.id}`);
      for (const field of ['title', 'description', 'command']) {
        assert.ok(typeof item[field] === 'string' && item[field].trim(), `missing ${field}: ${item.id}`);
      }
      if (item.resourceUrl) assert.match(item.resourceUrl, /^https:\/\//);
      if (item.sourceCanonicalUrl) assert.match(item.sourceCanonicalUrl, /^https:\/\//);
    }
  }
});

test('Unenabled Pro features cannot be mislabelled as available', () => {
  for (const item of entries) {
    if (item.group === 'dots') assert.equal(item.status, 'pro', `dots must remain Pro-only: ${item.id}`);
    if (item.status === 'pro') assert.equal(item.group, 'dots', `Pro card outside dots group: ${item.id}`);
  }
});

test('Automatically detected cards require a canonical source and verified status for ready', () => {
  for (const item of entries.filter((x) => x.autoDetected === true)) {
    assert.ok(item.sourceCanonicalUrl?.startsWith('https://'), `missing canonical evidence: ${item.id}`);
    assert.ok(item.verificationStatus, `missing verification status: ${item.id}`);
    if (item.status === 'ready') {
      assert.equal(item.verificationStatus, 'verified', `unverified capability promoted: ${item.id}`);
    }
  }
});
