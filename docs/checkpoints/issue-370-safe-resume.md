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

Next: implement focused Home resume links, move existing saved lesson list into an early disclosure (no second store), add request-aware save and source/core protection. Add meaningful regressions; render actual isolated Worker with synthetic fixtures and compare same-content baseline. Keep current APIs, auth, gates and dependency versions.

## Verification / open work
All new behavior UNVERIFIED at this checkpoint. Prior #371 receipts are historical, not evidence for this branch. Need focused/full tests, release-delta typecheck, build, Worker smoke, security and rendered mobile measurements. Physical iPhone Safari remains UNVERIFIED.

## Human Gate
Draft PR review. Public HTTPS Better Design final receipt cannot be obtained without deployment; user prohibits deployment, so do not deploy and report that review incomplete. Superdesign paid design generation is not authorized; CLI preflight only, existing-code design proceeds locally.
