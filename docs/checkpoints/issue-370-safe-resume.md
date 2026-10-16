# Issue #370 — safe resume follow-up checkpoint

## Goal and acceptance
Build on merged #371; make creation and safe resumption clear within two taps, preserve source/manuscript and concurrent edits. Test 320/375/390/430 and desktop. Deliver Draft PR only; never merge, deploy, publish, pay or invoke paid generation.

## Fresh source of truth
- Current master/base: `9fc4a23a252eef8365b6c3c8b0b34e2be33973b7` (#371 already merged).
- Branch: `codex/issue370-safe-resume`.
- Issue #370, merged #371, open #364/#325/#345/#366 inspected. Do not duplicate their features. No repository-local AGENTS.md found.
- Existing investigation and task comparisons: `docs/issue-370-creation-first-ux.md`.
- Drive Design Intelligence read; existing theme/personal preferences remain canonical. Better Design hierarchy/accessibility/navigation/errors loaded. Live extraction describes login, not authenticated Home preferences.

## Findings / implementation scope
1. Home has no explicit general resumption entry; saved lessons live after the long source picker.
2. Studio save clears dirty unconditionally after awaiting a request: newer input can be marked saved.
3. Changing source guards body only, not edited planning fields / loaded draft identity. Concept selection replaces the core without checking existing notes.

Implemented: direct Home resume link, existing saved lesson list in an early disclosure (no second store), request-aware save and source/core protection, explicit discard consent for a new draft. Temporary baseline worktree and both synthetic preview processes were removed after QA. No private credentials used. Recreate baseline from `9fc4a23` if needed; final QA helper scripts remain under ignored `work/qa/` locally.

## Verification / open work
- Draft PR: https://github.com/takraw369/masahiro-yamada-com/pull/372 (attached).
- `eddd3e2` CI `38971163573`: 533 tests, release-delta typecheck (214 legacy errors, changed files 0), build, Worker smoke, dependency security and gitleaks passed.
- Actual isolated Astro Worker browser: Home/resume 320/375/390/430/1440/1728 have no page overflow; actions >=44px; IBM Plex Sans JP loaded. A/B/C, safe resume, delayed save + second save/version, missing source retention, 503 retry/empty state, Night/favorites checked with synthetic data. Evidence in `docs/reviews/issue-370-resume/`.
- Final screen source `eaeea94`, CI `38971578888`: all gates passed after removing the competing Flow shortcut; its existing 「導線」 door stays. 533 tests passed; changed files type-clean, legacy errors 214.
- Final Home/resume/source/preview/save/error/Night images and measured receipts refreshed. Copy review passes; Better Design DOM spacing completed at 390/1440/1728, critical 0 / serious 0 / moderate 3 (existing Studio spacing). No whole-dashboard VALID approval claimed.
- Final task comparison: `docs/issue-370-safe-resume-review.md`. Source/evidence hashes: `docs/reviews/issue-370-resume/manifest.json`. Mobile editor inputs measured 16px, all tested editor buttons >=44px, all six widths have zero overflow.
- Next: commit evidence, read final artifact-head CI, update Draft PR body with verification URLs. Physical iPhone Safari and public HTTPS final receipt remain UNVERIFIED.

## Human Gate
Draft PR review. Public HTTPS Better Design final receipt cannot be obtained without deployment; user prohibits deployment, so do not deploy and report that review incomplete. Superdesign paid design generation is not authorized; CLI preflight only, existing-code design proceeds locally.
