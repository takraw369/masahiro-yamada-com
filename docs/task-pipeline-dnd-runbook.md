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
