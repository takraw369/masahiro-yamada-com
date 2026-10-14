# Design Studio cross-device handoff

- Goal: transfer reference favorites, notes, saved combinations and current preview between authenticated dashboard devices. Never apply a home design automatically.
- Source: master `a53c2015617db826be1380a7843df51ea8fd1c79`, prior shipped PR #337. Working branch `codex/dashboard-design-sync-20261014`.
- Confirmed: preferences currently live in localStorage only. Choice Lab and Flow Canvas have separate canonical records; do not reuse their state containers.
- Plan: dedicated private Supabase snapshot, server-derived owner guard, revision-checked save, explicit import with recoverable local backup. Local use continues when network fails.
- Verification pending: parser bounds, authorization, concurrent save conflict, import recovery, mobile widths 320/375/390/430, build, changed-file typecheck and CI.
- Next: implement narrow snapshot contract and additive guarded migration.
- Human gate: production workflow requires reviewer approval for API/DB releases. Prior approval covered the already deployed PR #337 release only. Complete and verify this release before presenting a new concrete gate.
- Current production: https://masahiroyamada.com/dashboard/design-templates . Existing applied Night/tiles must be preserved during testing.

## Storage milestone

- Additive migration `migrations/20261014013012_dashboard_design_handoff.sql` applied to canonical Supabase `qydbtholbwbuwiswmqsr` using MCP; no real owner preferences written yet. CLI v2.120.0 generated the timestamped file, then moved into repository migration directory.
- Observed database test transaction passed: unknown owners denied, anon direct table access denied, initial empty/read/save/read round trip, rejected initial/stale CAS, invalid snapshot rejected. Synthetic owner and writes rolled back. Reusable SQL: `tests/dashboard-design-database.sql`.
- Advisor review: only intentional additions were the private RLS deny-by-default table (INFO) and the two guarded published dashboard RPCs (WARN for anon/authenticated SECURITY DEFINER). They follow the established server-derived owner contract; search_path empty, explicit ACL, private trusted-owner check; unknown-owner calls verified rejected. The Worker publishable RPC architecture needs these execution grants. No grant to the private table. See https://supabase.com/docs/guides/database/database-linter?lint=0028_anon_security_definer_function_executable and https://supabase.com/docs/guides/database/database-linter?lint=0029_authenticated_security_definer_function_executable . Existing unrelated notices unchanged.
- Tests: 447 suite tests passed before the extra middleware regression; the seven new focused tests all pass including session and same-origin guards. Build passed. Full typecheck retains 207 existing errors; no new edited-source errors observed.
- Open: final UI read/import/backup/CAS checks, final release checks, push/PR/merge. Production Worker is still the prior release.

## UI milestone

- Isolated browser proof: independent origins 127.0.0.1 and localhost with synthetic session and in-memory CAS backend; no production credentials. Shared favorite, note, orange Shadcn preview and named combination imported on the other origin; applied home remained standard. Import restore worked. Stale-device save returned 409 and disabled saving until latest read; local note survived.
- Corrected saved-status comparison to use canonical sanitized snapshots after observing object-key order differences.
- Actual responsive DOM checks at 320/375/390/430: scrollWidth equals clientWidth; new controls 44.8px high. First reference CTA at y748 in 390x844 with handoff collapsed. Desktop 1280 layout observed. Screenshot in task outputs `design-sharing-preview.jpg` is an isolated preview, not deployed UI.
- Final suite: 448/448 passed. Production build and dependency security gate passed (pre-existing http-cache-semantics exception expires Oct31).
- Supabase history reports migration version 20261014013012; source filename reconciled to this observed applied version after CLI generation.
- Next smallest action: isolated Worker smoke, commit/push, required PR CI, merge, protected deploy gate.
