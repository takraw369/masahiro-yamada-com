import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';

const root = process.cwd();
const head = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim();
const profilePath = path.join(root, 'security/app-security-profile.json');

function baseState() {
  const evidence = {
    profiles_match_features: true,
    no_open_p0: true,
    no_unwaived_p1: true,
    secrets_checked: true,
    client_bundle_checked: true,
    dependency_scan_completed: true,
    regression_tests_for_fixed_p0_p1: true,
    evidence_attached: true,
  };
  return {
    version: 1,
    status: 'reviewed',
    reviewed_at: '2026-09-30T10:00:00Z',
    scope: { branch: 'test', commit: head },
    profiles_reviewed: ['public-only', 'auth-account', 'admin', 'webhook'],
    stack_overlays_reviewed: ['astro', 'cloudflare'],
    evidence,
    evidence_refs: Object.fromEntries(Object.keys(evidence).map((key) => [key, [`tests/security-gate.test.mjs#${key}`]])),
    findings: [],
  };
}

function run(state) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'masa-security-gate-'));
  const statePath = path.join(dir, 'audit-state.json');
  fs.writeFileSync(statePath, JSON.stringify(state));
  try {
    return spawnSync(process.execPath, ['scripts/security-gate.mjs'], {
      cwd: root,
      env: {
        ...process.env,
        SECURITY_PROFILE: profilePath,
        SECURITY_AUDIT_STATE: statePath,
      },
      encoding: 'utf8',
    });
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

test('complete evidence bound to current commit passes', () => {
  const result = run(baseState());
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /^PASS\s*$/m);
});

test('stale reviewed commit blocks', () => {
  const state = baseState();
  state.scope.commit = 'deadbeef';
  const result = run(state);
  assert.equal(result.status, 1);
  assert.match(result.stderr, /audit commit mismatch/);
});

test('boolean evidence without references blocks', () => {
  const state = baseState();
  state.evidence_refs = {};
  const result = run(state);
  assert.equal(result.status, 1);
  assert.match(result.stderr, /required evidence has no reference/);
});

test('open or accepted P1 without live waiver blocks', () => {
  for (const status of ['open', 'accepted']) {
    const state = baseState();
    state.status = 'reviewed_with_findings';
    state.findings = [{ id: `SEC-${status}`, severity: 'P1', status }];
    const result = run(state);
    assert.equal(result.status, 1, status);
    assert.match(result.stderr, /open\/unwaived P1/, status);
  }
});

test('fixed P1 without regression test blocks', () => {
  const state = baseState();
  state.status = 'reviewed_with_findings';
  state.findings = [{ id: 'SEC-fixed', severity: 'P1', status: 'fixed' }];
  const result = run(state);
  assert.equal(result.status, 1);
  assert.match(result.stderr, /lacks regression_test/);
});

test('tracked P2 returns non-blocking warning state', () => {
  const state = baseState();
  state.status = 'reviewed_with_findings';
  state.findings = [{ id: 'SEC-p2', severity: 'P2', status: 'open', tracking: 'issue-123' }];
  const result = run(state);
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /PASS_WITH_TRACKED_P2_P3/);
});
