# MASA OS convergence — 2026-09-28

## Goal / acceptance

Converge existing assets across `takraw369/masahiro-yamada-com` and `takraw369/masa-automation` without introducing another OS, scheduler, or canonical task store. Audit requested domains and open PRs; selectively rebuild against the current default branch; validate tests/build/typecheck/security; leave reviewable PRs and a resumable execution packet.

## CURRENT STATE

- Fresh site baseline: `master` at `e987aa4`; automation baseline: `main` at `53d55d9`. Automation has no canonical `master`; do not invent one.
- Site: 15 open PRs. Automation: 28 open PRs at audit start. Inventory and dispositions are being verified against code, not branch names or GitHub's CLEAN/BEHIND labels alone.
- Otsu6 single implementation is already on master; merged #199 and subsequent #201 (independent Otsu4) outrank older #196/#198.
- This checkpoint is implementation-in-progress, not a completion or deployment receipt.

## Completed / verification

- Fresh clones, default branch SHAs, open/recent merged PR inventory and remote branches read.
- Repository instructions and deployment workflows read.
- Site dependency install succeeded. Baseline checks running; all implementation acceptance remains UNVERIFIED.

## REMAINING BOTTLENECK

- Navigation is maintained separately from existing tools; the Knowledge page duplicates the FLOW MIND shell and loads a different script set.
- Existing PRs contain conflicting replacements, local prototypes, independent tools, or backend prerequisites. They must not be merged as a batch.
- Site master pushes trigger production deployment. Automation main pushes touching Flow Runner also deploy; the production environment currently has no reviewer protection. A merge can cross the user's Production deploy Human Gate.

## NEXT EXECUTION

1. Complete per-PR disposition from current defaults; retain useful unmerged work and identify exact supersession.
2. Integrate bounded browser-local / read-only Revenue, ACE Cue Lab, and Investment assets; converge navigation and Knowledge entrypoints; preserve existing state/storage/auth.
3. Rebuild safe automation fixes and document cross-repo dependencies separately.
4. Run tests, build, full/release typecheck, dependency security and preview; record failures honestly and fix introduced regressions.
5. Push feature branches, create reviewable PRs, inspect exact-head CI, and update this checkpoint with evidence and next execution.

## Source of Truth / Human Gate

GitHub stores executable source and this engineering receipt, never canonical business/task status. Drive / MASA_OS owns business and knowledge assets; `MASA_TASK_BOARD / TASKS` owns task status and revision. Supabase task data is a synchronized read model, while site-native entities use explicitly scoped RPCs. Browser-local drafts are device state, not canonical assets or confirmed revenue. Never dual-write tasks.

No production deployment, external publication, billing, credential change, destructive DB migration, or major irreversible action is authorized. Preparing code and PRs is authorized. Production runtime and migrations remain UNVERIFIED unless separately observed; passing CI does not establish deployment.
