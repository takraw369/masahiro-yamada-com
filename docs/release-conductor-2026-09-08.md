# Release verification and follow-up — 2026-09-08

**Verdict: CONDITIONAL GO for the released baseline; production acceptance still requires the owner-operated auth/recovery checks below.** This is derived engineering evidence. Drive PJT-037 / WEB_SYSTEM_CANONICAL remain project canon. GitHub and live technical evidence govern implementation claims.

## Fresh source reconciliation

The audit began at PR #55 `715c5b2`, eight commits behind master `b88419c`. Existing dirty local checkouts were preserved; work used a separate worktree. Later fresh reads found the Calendar/D1 hardening commits, master `ad1ac65`, and additional Worker auth smoke commits. These were merged and preserved, not overwritten.

During this work another authorized release action merged [#55](https://github.com/takraw369/masahiro-yamada-com/pull/55) at `381d48ef4a80252a23df36e4e1164cc3a8e631f0`. The current PJT-037 receipt records Human approval. This audit did **not** merge or deploy production, apply a live migration, publish content, change DNS, or alter secrets. Remaining fixes are a separately reviewed follow-up; a branch push is not production deployment.

The old [release report](release-conductor-2026-09-07.md) is historical. Its Astro 5 candidate, missing remote schema/CI, unresolved dependency audit, and blanket Cloudflare HUMAN-ONLY assumptions are superseded here.

## Gate matrix

| Gate | Status | Evidence / limit |
| --- | --- | --- |
| Current master and #55 reconciliation | VERIFIED / PASS | #55 is MERGED; master `381d48e`; source history preserved. |
| Active Cloudflare provenance | VERIFIED / PASS | Direct deployments/version read matches the exact ID in Deploy run [34236887403](https://github.com/takraw369/masahiro-yamada-com/actions/runs/34236887403). |
| Runtime vars and bindings | VERIFIED / PASS with documented drift | Five plaintext vars match repo in memory; compatibility and DB/ASSETS match. The released adapter provisioned an unused SESSION binding. Follow-up disables unused Astro sessions and guards generated artifact config; no KV namespace deletion. |
| Legacy import authorization | VERIFIED / PASS | Live `trinity_funnel_import_owner_gate`, version `20260908052426`; v1 public/anon/auth EXECUTE revoked; v2 registered-owner gate. |
| Calendar database authorization | VERIFIED / PASS | Live `calendar_owner_gate_v2`, version `20260908053521`; both tables RLS enabled, anon direct SELECT denied; v1 anon/auth revoked; all three v2 RPCs validate registration. Calendar tables currently empty. No reapplication needed. |
| Automated authentication/recovery | VERIFIED / PASS locally | Actual route/middleware tests, inline callback tests and built Worker + local Supabase stub cover login, admin rejection, password reset, cookies, renewal and failures. No real credentials or live password mutation. |
| T0057 incident | VERIFIED / CLOSED | Reuse MASA's earlier Google-return/re-access/no-flash PASS, recorded as DONE in Drive. No new production evidence reopens that incident. |
| New production owner auth/recovery | HUMAN-ONLY / pending | Available browser reaches the correct Google sign-in through Supabase, but has no signed-in Google account. Password change must be performed by MASA. Earlier T0057 evidence does not prove the new released artifact. |
| D1 divergence | C / removed in follow-up | Live ace_checked: 0 rows; feedback/funnel tables absent. Supabase marker exists; no imported funnel backlog. Released code prevents new D1 writes. Follow-up also removes request-triggered imports/reads, returns sanitized 503 for primary failure, and preserves nonblocking analytics stored:false. |
| Public/anonymous route smoke | VERIFIED / PASS | Current production homepage/contact/FAQ/library/tips/gate/login return 200; private Dashboard redirects, state/X proxy deny anonymous access. `/vault` is absent; `/library` is the current public shelf. |
| Candidate rendering/config | VERIFIED / PASS locally | Built Worker authentication and protected page rendering pass. Generated config preserves routes/date/flags/ASSETS/DB and rejects test secrets, extra KV or Images. |
| Full repository typecheck | KNOWN DEBT | Release delta passes; 422 existing repository diagnostics remain visible. This is not a claim of a clean full typecheck. |
| X Harness availability | NOT-CHECKED / unavailable config | X key absent in live version; candidate fails closed with 503. LINE key exists; no publishing or upstream mutation exercised. Unused harness flag helpers do not disable the proxy. |

## Production baseline and rollback

Latest direct Cloudflare read on 2026-09-08:

- Worker: `masahiro-yamada-com`, PRIMARY `https://masahiroyamada.com/dashboard`.
- Active version: `a7a63fa7-c0c1-4a65-90c3-dd31c7f33c9e`, **100%** traffic.
- Deployment: `0a3bf3db-a3c0-4ba4-bc89-c55a24c0e406`, created `2026-09-08T14:14:37.614104Z`.
- Exact source: master `381d48e`; Deploy run `34236887403` printed the same version ID.
- Compatibility: `2024-12-01`, `nodejs_compat_v2`; DB `sunlovesflow-db` / `b3f9ad9b-3e6a-4a11-8059-b7997466db85`; ASSETS present.
- Five root custom domains match the repo. Earlier direct domain reads plus unchanged routes and current deploy logs support continuity.
- Secret existence only: DASHBOARD_PASSWORD, DASHBOARD_SESSION_SECRET, LINE_HARNESS_API_KEY. No values captured in committed evidence; no X_HARNESS_API_KEY.
- Current released version includes SESSION KV, although no app uses Astro.session. Proposed `session:false` prevents dependence/provisioning and does not delete that resource.
- Prior pre-release rollback pair: `e7076c72-84bb-41a9-9a33-c37e8c78c9e` / master `ad1ac65`, Deploy run `34195863639`. For a future follow-up deploy, preserve the current `a7a63fa7...` / `381d48e` pair as the immediate rollback point.

Rollback is a separately authorized production action. It restores code/config behavior, not business data or password changes. Do not rotate DASHBOARD_PASSWORD: it is also the stable storage-owner derivation secret. Old fixed cookies require a new login; existing v2 sessions expire server-side. Password reset/logout do not globally revoke all issued cookies immediately; this remains documented debt.

## Follow-up implementation and verification

- Strict boolean authorization results for password verification, Google admin checks and reset success. Malformed truthy results cannot issue sessions.
- Recovery rejects malformed bodies and validates the signing prerequisite before changing credentials. Callback/network failures restore visible controls and clear recovery tokens; the successful T0057 path stays intact.
- Supabase-only normal request path: no GET-triggered migration, D1 table creation, fallback read or write. `migrateLegacyD1` remains an explicit recovery helper with its registered-owner import contract, not an active route side effect. DB binding/data are preserved.
- Funnel is explicitly labeled as a historical view, not current analytics; its Astro 7 binding access is fixed. The newer master LINE Control Plane implementation supersedes the old lian binding patch and is preserved unchanged.
- Retired ace-vault instructions removed from CLAUDE.md; framework documentation matches the locked Astro 7 stack.
- Generated Worker config checked during every production build; preview matches production compatibility flags/date, uses only explicit test vars, and production rebuild follows preview.
- 56 Node tests pass. Built Worker smoke includes password/Google-admin/recovery HTTP contracts and authenticated Dashboard, LINE, funnel, schedule and Voice rendering. Dependency audit: 0 findings. Release delta: PASS, known full-project debt retained.
- Preview startup on this host initially exceeded its old bound; the runner now allows a bounded 120 probes and reports signal termination. Expanded local smoke subsequently passed. CI remains required on the final branch head.

## Downstream order and overlap

1. **Released #55:** complete owner production auth/recovery smoke. Review this follow-up independently; it contains no new Dashboard features.
2. **Calendar #44:** prepared against the release branch and current remote #44. Preserve only exact POST `/api/dashboard/calendar/sync` as the separate Bearer boundary, plus current session/CSRF behavior everywhere else. Registered-owner v2 migration is already live. Added executable disposable PostgreSQL ACL/RLS/atomicity/freshness tests and actual request tests; stream bytes are bounded before buffering. No live sync activated.
3. **Distribution #66:** review its six-file delta against the prepared Calendar baseline. Shared `DashboardLayout.astro` navigation and identical `/dashboard/content-schedule` are the overlap; preserve Calendar, Distribution, Evidence, Intelligence and Investment entries. Its note handoff remains a local draft action, never publication.
4. **Trigger Surface / GPTQuickTriggers:** only after actual PRIMARY production acceptance and relevant device review. Preserve current component as known stale until generated data is reviewed. Input remains `07_AI_COMMANDS → 07_TRIGGER_ROUTER → 07_TRIGGER_SURFACE`; these are operational/derived projections, not a replacement for owner canonical meaning. No 51-alias dump or new trigger UI during the gate.

Calendar companion `ace-schedule-gas#2` fresh head `147c92d` already sends source_synced_at, uses Script Lock, and keys recurring occurrences by series ID plus start. No companion rewrite or trigger activation is needed in this audit. PGlite tests execute real PostgreSQL functions and ACLs but are single-backend; they do not reproduce multi-connection contention. PostgreSQL's advisory transaction lock plus the source timestamp check establishes the intended serialization contract.

## Exact remaining human gates

1. MASA opens PRIMARY in their normal browser, completes Google login on the new released version, returns to Dashboard, reloads and navigates to Voice/LINE/schedule without a login flash. Record version `a7a63fa7...` with the result. This is post-release acceptance, not reopening T0057.
2. Through the existing password-recovery button, MASA performs Google verification and personally enters/submits a new Dashboard login password. Then verify password login and Dashboard access. Never paste the password into chat or change the Worker signing/owner secret.
3. A human reviews/authorizes any subsequent merge or deploy; master automatically deploys. No production action is implied by a green follow-up CI.
4. Calendar activation remains separate: review site #44, preserve the already-applied v2 migration, configure matching CALENDAR_SYNC_SECRET through existing secure settings, accept the GAS companion, run one authorized sync and inspect freshness/events before enabling its trigger. Publication remains outside this release.

Canonical updates: PJT-037 release receipt; WEB_SYSTEM_CANONICAL latest Worker/rollback and verification state; MASA_TASK_BOARD T0071 and Calendar T0054. Preserve T0057 DONE and the PRIMARY/LAB boundary. GitHub follow-up and #44/#66 descriptions must distinguish reviewed code, CI, deployed version and owner acceptance.
