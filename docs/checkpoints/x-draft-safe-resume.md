# X draft save/resume checkpoint

## Goal / acceptance
User requested a report to Chat and the next build after #372. Implement explicit saving and safe resumption of X text inside the existing Post editor. Preserve current text, connected account selection and the existing review/publication gate. Draft PR only; no merge, deployment, publication, payment, paid API or new database.

## Current source of truth
- Base master `9fc4a23a252eef8365b6c3c8b0b34e2be33973b7`; branch `codex/x-draft-safe-resume`.
- Previous independent Draft PR #372 remains open at `6b75fea`; CI `38972034997` passed all gates (533 tests). Do not incorporate or duplicate its lesson/Home changes here.
- Active PR list inspected: no X text persistence feature found. Existing X editor is `XCommandCenter.tsx` inside `XOperationsCenter`; publishing handoff remains in `post.astro`. Existing Composer text has no persistence. ContentScheduler uses a browser-local content library; inspect before introducing a new persistence contract.
- CLAUDE.md / CHECKLIST.md read; existing MASA design tokens and user choices retained. Better Design hierarchy and forms guidance loaded before changes.

## Reporting dependency
Chat destination is ambiguous. User was asked asynchronously to choose the exact conversation; no external report sent yet. Candidates include 「Codex指示書作成」 and 「Issue215実装差分整理」. Their titles/contents do not conclusively identify this Dashboard request. Continue implementation independently; never claim delivery without a send receipt.

## Implemented decision
Reuse ContentScheduler's existing `ace-content-lib` array and PostItem schema; no second store, API or database. Added shared `src/lib/contentLibrary.ts` adapter. Composer explicitly saves/restores exact text, keeps current destination/timing and invalidates publication review. Newer changes and malformed/unavailable storage fail closed. Beforeunload protects unsaved text. Scheduler writes now apply only their per-ID delta so stale snapshots cannot erase newly saved Composer/LINE records; same-record conflicts fail instead of overwriting. This is browser-local best-effort concurrency, not a database transaction or device sync.

After a human-confirmed publication/remote scheduling success, only the matching unchanged saved draft is marked sent locally; never run publication as part of save/restore. No real publication is allowed in QA.

## Verification / open work
Related 31 tests passed: storage integrity, stale/no-op/deleted records, LINE and concurrent additions, corrupt/blocked storage, review gate, account identity and old publishing handoff. Need real Worker mobile 320/375/390/430 + desktop evidence, full tests/typecheck/build/security and final Draft PR. Physical Safari and public HTTPS Better Design final receipt remain UNVERIFIED; deployment is forbidden.

## Next smallest action
Run full CI/build and real isolated Worker fixtures; fix findings, create independent Draft PR, then send the Chat report only after the recipient is identified.
