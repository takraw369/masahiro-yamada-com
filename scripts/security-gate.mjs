import fs from 'node:fs';
import path from 'node:path';

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

if (state.version !== 1 || profile.version !== 1) blockers.push('unsupported security profile/audit-state version');
if (!isNonEmpty(profile.app)) blockers.push('profile.app is missing');
if (!state.scope || !isNonEmpty(state.scope.commit)) blockers.push('audit scope.commit is missing');
if (!isNonEmpty(state.reviewed_at)) blockers.push('reviewed_at is missing');

const expectedProfiles = new Set(profile.profiles ?? []);
const reviewedProfiles = new Set(state.profiles_reviewed ?? []);
for (const p of expectedProfiles) if (!reviewedProfiles.has(p)) blockers.push(`profile not reviewed: ${p}`);

const expectedOverlays = new Set(profile.stack_overlays ?? []);
const reviewedOverlays = new Set(state.stack_overlays_reviewed ?? []);
for (const o of expectedOverlays) if (!reviewedOverlays.has(o)) blockers.push(`stack overlay not reviewed: ${o}`);

for (const key of profile.required_predeploy_evidence ?? []) {
  if (state.evidence?.[key] !== true) blockers.push(`required evidence is not true: ${key}`);
}

for (const finding of state.findings ?? []) {
  const severity = finding?.severity;
  const status = finding?.status ?? 'open';
  const open = !['fixed', 'closed', 'accepted'].includes(status);

  if (severity === 'P0' && open) blockers.push(`open P0: ${finding.id ?? 'unnamed'}`);
  if (severity === 'P1' && open && !validWaiver(finding, now)) blockers.push(`open/unwaived P1: ${finding.id ?? 'unnamed'}`);

  if ((severity === 'P0' || severity === 'P1') && status === 'fixed' && !isNonEmpty(finding.regression_test)) {
    blockers.push(`fixed ${severity} lacks regression_test: ${finding.id ?? 'unnamed'}`);
  }

  if ((severity === 'P2' || severity === 'P3') && open) {
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
