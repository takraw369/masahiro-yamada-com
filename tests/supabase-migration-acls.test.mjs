import assert from 'node:assert/strict';
import test from 'node:test';

import { scanMigration } from '../scripts/check-supabase-migration-acls.mjs';

test('new public table without an ACL decision is rejected', () => {
  const findings = scanMigration('create table if not exists public.demo_table (id bigint);');
  assert.equal(findings.length, 1);
  assert.match(findings[0], /table creation lacks explicit GRANT\/REVOKE/);
});

test('new public table with explicit revoke is allowed', () => {
  const findings = scanMigration(
    'CREATE TABLE public.demo_table(id bigint);\n' +
    'REVOKE ALL ON TABLE public.demo_table FROM anon, authenticated;',
  );
  assert.deepEqual(findings, []);
});

test('new public function must explicitly revoke PUBLIC execute', () => {
  const findings = scanMigration(
    'CREATE OR REPLACE FUNCTION public.demo_func() RETURNS integer LANGUAGE sql AS $$ SELECT 1 $$;\n' +
    'GRANT EXECUTE ON FUNCTION public.demo_func() TO authenticated;',
  );
  assert.equal(findings.length, 1);
  assert.match(findings[0], /function creation lacks REVOKE/);
});

test('explicit function PUBLIC revoke and role grant pass', () => {
  const findings = scanMigration(
    'CREATE FUNCTION public.demo_func() RETURNS integer LANGUAGE sql AS $$ SELECT 1 $$;\n' +
    'REVOKE ALL ON FUNCTION public.demo_func() FROM PUBLIC, anon, authenticated;\n' +
    'GRANT EXECUTE ON FUNCTION public.demo_func() TO authenticated;',
  );
  assert.deepEqual(findings, []);
});

test('commented-out ACL commands do not count', () => {
  const findings = scanMigration(
    'CREATE TABLE public.demo_table(id bigint);\n' +
    '-- REVOKE ALL ON TABLE public.demo_table FROM anon;\n' +
    '/* GRANT SELECT ON TABLE public.demo_table TO authenticated; */',
  );
  assert.equal(findings.length, 1);
});

test('only migrations creating public tables or functions are in scope', () => {
  assert.deepEqual(scanMigration(
    'alter table public.old_table enable row level security;\n' +
    'create table private.safe_table (id bigint);',
  ), []);
});
