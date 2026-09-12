# Calendar #44: post-release integration

## Baseline and saved work

PR #55 is done. Original integration master reviewed: `940e8215301d4efdd8c5e92fe78b270bdd55b6ea` (includes the newer Intelligence archive filter after `381d48e`). Calendar was integrated from the current clean PR head `1bc989e`, preserving its history with forward commits and merges. Old worktrees, uncommitted files and saved Calendar `401c72f` remain untouched.

Original dependencies included for integration testing: password JSON-bootstrap #73 at `d9403d9`, then saved-work follow-up #74 at `593eee4`. Human merge order is #73 → retarget/accept #74 → #44 → #66. Calendar-only review: compare #74's branch `fix/post-release-contracts-20260909` to `feat/calendar-dashboard-sync`. Do not merge dependencies implicitly through #44 without reviewing them.

## Accepted baseline update — 2026-09-11

Master `96c0becf336a363abd4db2e85c69c713773d8fcc` now contains accepted #73 and #74, plus the current People Radar and LINE observability features. It was merged normally into #44, preserving branch history. Preview conflict resolution keeps both Calendar/auth recovery checks and authenticated LINE observability checks, sharing only synthetic local bindings. No production operation, secret change or Calendar activation was performed.

Validation on this baseline: 72 tests pass; release-delta typecheck has zero changed files with errors (368 existing repository errors remain); production build and Worker artifact configuration pass; production dependency audit reports zero vulnerabilities. Isolated preview exercises Calendar and LINE together.

## VERIFIED

- Calendar routes retain v2 registered owner-key RPCs, the existing owner derivation, signed rolling session, and browser CSRF enforcement.
- Only **POST** `/api/dashboard/calendar/sync` bypasses browser session/Origin checks. It still validates its independent Bearer secret and receives private/no-store/no-referrer headers. GET, trailing slash and sibling paths remain protected.
- Request body is bounded while streaming, including when Content-Length is absent. Shape, duplicate, event/window limits, boolean types and source timestamp freshness are checked before RPC. Stale replacement maps to 409; private DB details are sanitized.
- Calendar reads use both v2 RPCs with the same owner key and explicit source/freshness metadata. Read failures return sanitized 503, not a successful empty snapshot.
- Google Calendar remains canonical FACT. PersonalSchedule is read-only. X/LINE ContentScheduler remains at `/dashboard/content-schedule`; navigation includes both. Newer Dashboard index, LINE control plane and Intelligence filter are unchanged from master.
- Live Supabase `qydbtholbwbuwiswmqsr` was queried read-only: `calendar_owner_gate_v2` version `20260908053521` is applied; both tables have RLS and deny anon/authenticated table SELECT; every v1 function denies their EXECUTE; every v2 function checks registered owner keys. Live function-body review found only formatting/comments and equivalent default ASC ordering differences from the repository SQL.
- No production migration was applied. The historical v1 and v2 SQL files are regression fixtures, not an instruction to reapply them.

## Verification commands and scope

`npm test`: 72 passing tests, including real handler/middleware contracts and disposable embedded PostgreSQL (PGlite 0.5.8) executing the existing SQL. Database tests verify both table ACLs, all v1 revocations, foreign-owner denial, valid registered-owner access, payload atomicity, stale/equal timestamp rejection, recurring occurrences, and cancellation via a newer empty snapshot. This is not a multiple-connection contention test.

`npm run typecheck:release`: edited source files clean against master; 368 existing repository errors remain visible and are not claimed fixed.

`npm run build`: production build and generated Worker config checks. `npm run test:preview`: actual isolated Worker against a loopback-only Supabase stub; Google-admin/non-admin, JSON password login, recovery, private Calendar read, authorized/unauthorized Bearer sync, owner-key payload, session/CSRF and existing Dashboard route checks. No real OAuth credentials or live writes are used. Preview uses the production compatibility date/flags. Build production again after preview before any authorized deployment.

## Human gates and rollback

1. #73 and #74 are accepted on master. Review/approve #44 and separately authorize its production merge/deploy. Reuse existing production login/callback acceptance unless new evidence requires reopening it.
2. After approved site deployment, an authorized operator sets `CALENDAR_SYNC_SECRET` in the Worker and the matching Apps Script property, without placing either in Git, docs or chat. Until configured, sync deliberately returns 503.
3. Review/accept companion `takraw369/ace-schedule-gas#2`, authorize its Calendar scope, and run one manual sync. Confirm event count, `source_synced_at`, timed/all-day/recurring events and freshness on MASA's desktop/mobile. Then enable the existing trigger.
4. Production rollback: disable the Apps Script trigger first; use the recorded pre-Calendar Worker version if needed. Keep v2 authorization/RLS and v1 revocations in place. Do not roll back the DB hardening or delete Google Calendar facts.

Calendar is ready for code acceptance when current CI and preview are green and its dependencies are accepted; real Calendar activation is intentionally pending. Distribution #66 may be prepared on this resulting baseline now, but its merge follows Calendar acceptance. No content publication is authorized.
