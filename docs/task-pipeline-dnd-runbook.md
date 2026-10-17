# Task Pipeline｜existing Flow Runner → TASK_BOARD
Updated: 2026-10-14 · DRAFT / RELEASE BLOCKED until real-data validation

## Canonical flow
Browser → existing authenticated Dashboard `/api/dashboard/task-move` → existing `FLOW_RUNNER` service binding → private `masa-flow-runner` RPC → `MASA_TASK_BOARD｜GPT主導 / TASKS` → readback.

- Dashboard PR #352 depends on masa-automation PR #244; keep both Draft until acceptance.
- Reuse Runner's existing `GOOGLE_DRIVE_SERVICE_ACCOUNT_EMAIL` and `GOOGLE_DRIVE_PRIVATE_KEY`. Shared existing Drive authentication code handles tokens. No new service account, private key, Dashboard credential, Worker, D1 table, or migration.
- Credentials stay in Runner. Dashboard receives only sanitized statuses and verified move receipts. Existing Dashboard session, same-origin, no-store and payload-size gates remain.
- Supabase `os_tasks` is a one-way read mirror. Never write task statuses there or simulate saved state in localStorage.

## Mutation contract
1. Resolve immutable `Task ID` in I using current canonical rows, rejecting duplicates and missing IDs. Verify all A:N headers against the known schema.
2. Acquire the existing `FLOW_DB / flow_idempotency` lease for the canonical Sheet writer (120 seconds) to serialize RPC moves across isolates. No business state is stored in the lease.
3. Immediately before writing, fresh-read the physical target A:N and verify Task ID, expected Revision and source Status. A changed row/revision/status returns 409 with no write.
4. One Sheets batch changes only A(Status), J(Revision+1), K(Asia/Tokyo timestamp), L(`MASA Dashboard`, the user-operated UI's writer label). DONE also appends H(Notes) evidence, retaining all existing Notes. Reject cell-size overflow before writing.
5. Re-read target A:N; verify ID/status/revision/timestamp/editor and exact appended Notes. Only then return `verified:true` and readback metadata. A verification failure does not imply rollback: re-read canonical data before any retry.
6. UI changes only after the matching verified receipt. Missing canonical IDs are read-only. Disable reload and further moves during save. GET overlays canonical status/revision while normal Sheets→Supabase synchronization catches up.

Google Sheets has no atomic compare-and-swap. The existing lease serializes this RPC's writers only; direct human edits, sorts, other writers and Sheet structural changes can still race the fresh-read/write interval. Readback detects mismatches after a write and cannot undo a wrong-row write. Real validation must account for this residual limitation; do not claim atomic CAS.

## Required verification before production
- Both current-head CI workflows pass: Dashboard tests, release-delta typecheck, build, isolated preview, security; Runner static checks, types, TypeScript, tests and existing lease SQL test.
- Verify existing Runner runtime identity is the already approved editor `masa-flow-runner-drive-writer@masa-flow-runner-drive-writer.iam.gserviceaccount.com`, without printing its key.
- Use an authenticated, isolated preview of both PR heads with existing credentials. Public Runner HTTP remains 404. Do not deploy production to enable this test.
- Choose one explicitly identified Task ID and intended stage move; fresh-read its A:N, send the move through the preview Dashboard→Runner RPC, and independently re-read A:N to verify fields and preserve unrelated columns/rows. Confirm stale Revision returns 409 and writes nothing. Record sanitized evidence without copying private task text into Git.
- Check drag/drop on desktop, destination select on touch/keyboard, DONE evidence, error display, and persisted status after reload. Synthetic fixtures and connector reads alone are not runtime write evidence.
- Keep both PRs unmerged, do not trigger production deployment, and obtain the release go/no-go only after real-data evidence is complete. Rollback: revert the paired revisions; no new secret/schema cleanup is required.

## Current acceptance
Code and fixture verification are tracked in the two PRs. Actual deployed Runner identity, authenticated preview RPC and a real-task write/readback remain UNVERIFIED until observed. This document does not claim that production drag-saving is enabled.

## 2026-10-17 cross-sprint read-only audit
- Paired Runner head `66bd96f` retained: Task ID / Revision / Notes / fresh-read conflicts / permission / lease regressions 18/18 PASS. Dashboard scoped non-browser regressions 17/17 PASS, including the real Workboard API in isolated workerd with all outbound traffic intercepted. Dependencies were reused locally; clean-lock validation belongs to the new-head CI.
- Repaired the existing Workboard API's `redirect:error` construction failure in workerd; `manual` plus the non-2xx guard refuses redirects without forwarding the GitHub credential. A real-runtime regression demonstrates two configured repositories, six fixed GETs, per-repo CI matching, no token in responses and zero redirect/retry requests. The unpatched endpoint produced zero fixture egress.
- Automation CI is `Flow Runner CI`; Website CI is `CI`. Both still require an exact PR head SHA. A successful deployment must never substitute for a CI result.
- Production site Worker Secret **names only** were read: `GITHUB_ISSUES_READ_TOKEN` is absent. No token was copied from local GitHub/connector authentication, and no secret/permission was changed. Private-repository token scopes and private display remain UNVERIFIED until provisioned under a separate Human Gate. Required least privilege remains repository access to the two configured repos and Metadata/Issues/Pull requests/Actions read only.
- Current Workboard fetches open PRs and exact-head CI only. It does not have merged/deployed/E2E evidence fields; do not infer any of those from green CI or issue closure. Existing source shows only two repositories, so the wider sprint's ACE/SLF items are outside that feed's current coverage.
- Authenticated live UI, mobile Safari and measured 390/1440/1728 DOM spacing remain UNVERIFIED: no browser surface was enabled. The installed Chromium shim pointed at a missing binary; an isolated Google Chrome fixture attempt failed in the local display/teardown runtime. Historical browser CI is evidence for its own head only; current-head CI must be read afresh. Better Design principles/review rules and owner-audience comprehension review were loaded; no visual approval is claimed.
- Human Gate: select one real Task ID and intended move for the paired isolated-preview write/readback. Runtime writer Secret names exist, but their presence alone does not prove the approved identity or Sheet Editor permission. This test remains separate from merge/deploy approval; neither production mutation nor publication was performed.
