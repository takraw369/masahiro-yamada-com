import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
import { PROFILE_STORAGE_KEY, parseProfileForContact } from '../src/lib/profileReuse.mjs';

const contact = await readFile(new URL('../src/pages/contact.astro', import.meta.url), 'utf8');

test('reuses only the two contact-compatible fields from JEV profile v1', () => {
  const record = JSON.stringify({
    version: 1, updatedAt: '2026-10-11T01:00:00Z',
    fields: { fullName: ' 山田太郎 ', email: ' taro@example.com ', phone: '09011112222', address: '非公開' }
  });
  assert.equal(PROFILE_STORAGE_KEY, 'masa.profile.v1');
  assert.deepEqual(parseProfileForContact(record), { name: '山田太郎', email: 'taro@example.com' });
  assert.doesNotMatch(JSON.stringify(parseProfileForContact(record)), /0901111|非公開/);
});

test('does not admit invalid, oversized, empty or wrong-version records', () => {
  assert.equal(parseProfileForContact(null), null);
  assert.equal(parseProfileForContact('{not-json'), null);
  assert.equal(parseProfileForContact('x'.repeat(8193)), null);
  assert.equal(parseProfileForContact(JSON.stringify({ version: 2, fields: { fullName: '山田太郎' } })), null);
  assert.equal(parseProfileForContact(JSON.stringify({ version: 1, fields: [] })), null);
  assert.equal(parseProfileForContact(JSON.stringify({ version: 1, fields: { fullName: '', email: null } })), null);
});

test('filters invalid or overlong contact values', () => {
  assert.deepEqual(parseProfileForContact(JSON.stringify({
    version: 1, fields: { fullName: 'a'.repeat(101), email: 'good@example.com' }
  })), { name: '', email: 'good@example.com' });
  assert.deepEqual(parseProfileForContact(JSON.stringify({
    version: 1, fields: { fullName: '<script>alert(1)</script>', email: 'not-email' }
  })), null);
});

test('profile data is accessed only after a user click, with opt-in preview and confirmation', () => {
  assert.match(contact, /reuseOpen\?\.addEventListener\('click'/);
  assert.match(contact, /parseProfileForContact\(window\.localStorage\.getItem\(PROFILE_STORAGE_KEY\)\)/);
  assert.match(contact, /id="profile-reuse-preview"[^>]+hidden/);
  assert.match(contact, /id="profile-reuse-name" type="checkbox"/);
  assert.match(contact, /id="profile-reuse-email" type="checkbox"/);
  assert.match(contact, /id="profile-reuse-apply" type="button"/);
  assert.match(contact, /if \(reuseName\.checked && !reuseName\.disabled && !formName\.value\.trim\(\)/);
  assert.match(contact, /if \(reuseEmail\.checked && !reuseEmail\.disabled && !formEmail\.value\.trim\(\)/);
  assert.match(contact, /送信はまだしていません/);
});

test('existing contact submission and privacy gates are unchanged', () => {
  assert.match(contact, /id="consent" name="consent" type="checkbox" required/);
  assert.match(contact, /form\.addEventListener\('submit', async \(event\) =>/);
  assert.match(contact, /if \(!form\.reportValidity\(\)\) return/);
  assert.match(contact, /fetch\('\/api\/contact'/);
  assert.match(contact, /form\.reset\(\)/);
  assert.doesNotMatch(contact, /window\.localStorage\.setItem\(/);
});
