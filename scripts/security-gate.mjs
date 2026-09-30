import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

const root = process.cwd();
const profilePath = path.resolve(root, process.env.SECURITY_PROFILE ?? 'security/app-security-profile.json');
const statePath = path.resolve(root, process.env.SECURITY_AUDIT_STATE ?? 'security/audit-state.json');

function readJson(file) {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch (error) {
    console.error(`BLOCKED: cannot read ${path.relative(root, file)}: ${error.message}`);
    process.exit(1);
  }
}

function isNonEmpty(value) {
  return typeof value === 'string' && value.trim().length > 0;
}

function currentCommit() {
  const override = process.env.SECURITY_EXPECTED_COMMIT?.trim();
  if (override) return override;
  try {
    return execFileSync('git', ['rev-parse', 'HEAD'], {
      cwd: root,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    }).trim();
  } catch {
    return '';
  }
}

function hasEvidenceRefs(state, key) {
  const refs = state?.evidence_refs?.[key];
  return Array.isArray(refs) && refs.some(isNonEmpty);
}

function validWaiver(finding, now) {
  const waiver = finding?.waiver;
  if (!waiver) return false;
  if (!isNonEmpty(waiver.owner) || !isNonEmpty(waiver.rationale) || !isNonEmpty(waiver.compensating_controls) || !isNonEmpty(waiver.expiry)) return false;
  const expiry = Date.parse(waiver.expiry);
  return Number.isFinite(expiry) && expiry > now;
}

const profile = readJson(profilePath);
const state = readJson(statePath);
const blockers = [];
const warnings = [];
const now = Date.now();
const head = currentCommit();
const reviewStatuses = new Set(['reviewed', 'reviewed_with_findings']);

if (state.version !== 1 || profile.version !== 1) blockers.push('unsupported security profile/audit-state version');
if (!isNonEmpty(profile.app)) blockers.push('profile.app is missing');
if (!reviewStatuses.has(state.status)) blockers.push(`audit status is not reviewed: ${state.status ?? 'missing'}`);
if (!state.scope || !isNonEmpty(state.scope.commit)) blockers.push('audit scope.commit is missing');
if (!isNonEmpty(state.reviewed_at)) blockers.push('reviewed_at is missing');
if (!head) blockers.push('cannot resolve current commit; run inside a git checkout or set SECURITY_EXPECTED_COMMIT');
if (head && isNonEmpty(state.scope?.commit) && state.scope.commit !== head) blockers.push(`audit commit mismatch: reviewed ${state.scope.commit}, current ${head}`);

const expectedProfiles = new Set(profile.profiles ?? []);
const reviewedProfiles = new Set(state.profiles_reviewed ?? []);
for (const p of expectedProfiles) if (!reviewedProfiles.has(p)) blockers.push(`profile not reviewed: ${p}`);

const expectedOverlays = new Set(profile.stack_overlays ?? []);
const reviewedOverlays = new Set(state.stack_overlays_reviewed ?? []);
for (const o of expectedOverlays) if (!reviewedOverlays.has(o)) blockers.push(`stack overlay not reviewed: ${o}`);

for (const key of profile.required_predeploy_evidence ?? []) {
  if (state.evidence?.[key] !== true) blockers.push(`required evidence is not true: ${key}`);
  if (!hasEvidenceRefs(state, key)) blockers.push(`required evidence has no reference: ${key}`);
}

for (const finding of state.findings ?? []) {
  const severity = finding?.severity;
  const status = finding?.status ?? 'open';
  const resolved = status === 'fixed' || status === 'closed';

  if (severity === 'P0' && !resolved) blockers.push(`open P0: ${finding.id ?? 'unnamed'}`);
  if (severity === 'P1' && !resolved && !validWaiver(finding, now)) blockers.push(`open/unwaived P1: ${finding.id ?? 'unnamed'}`);

  if ((severity === 'P0' || severity === 'P1') && status === 'fixed' && !isNonEmpty(finding.regression_test)) {
    blockers.push(`fixed ${severity} lacks regression_test: ${finding.id ?? 'unnamed'}`);
  }

  if ((severity === 'P2' || severity === 'P3') && !resolved) {
    if (!isNonEmpty(finding.tracking)) blockers.push(`untracked ${severity}: ${finding.id ?? 'unnamed'}`);
    else warnings.push(`${severity} tracked: ${finding.id ?? 'unnamed'} -> ${finding.tracking}`);
  }
}

if (blockers.length) {
  console.error('BLOCKED');
  for (const item of blockers) console.error(`- ${item}`);
  if (warnings.length) {
    console.error('Tracked non-blocking findings:');
    for (const item of warnings) console.error(`- ${item}`);
  }
  process.exit(1);
}

if (warnings.length) {
  console.log('PASS_WITH_TRACKED_P2_P3');
  for (const item of warnings) console.log(`- ${item}`);
  process.exit(0);
}

console.log('PASS');
