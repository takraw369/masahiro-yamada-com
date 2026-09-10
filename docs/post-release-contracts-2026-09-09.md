# Saved-work reconciliation after PR #55

PR #55 is complete and deployed. This follow-up does not reopen its release gate.

Baseline reviewed: requested master `381d48ef4a80252a23df36e4e1164cc3a8e631f0`, then current master `940e8215301d4efdd8c5e92fe78b270bdd55b6ea`. The latter adds the Intelligence archive filter, retained unchanged. This branch stacks on password JSON-bootstrap PR #73 (`d9403d9`) so the retired native form handler is not restored.

## Disposition of previous work

| Saved change | Current disposition |
| --- | --- |
| Astro 7 Workers bindings, middleware/session/CSRF baseline, D1 write prohibition | Already in master; not duplicated |
| Password native-form verifier | Superseded by #73; malformed-result checks moved to its JSON endpoint |
| Google admin/reset truthy RPC results; malformed recovery input; mutation before missing signing config check | Retained with executable handler tests |
| Callback/recovery network failure, duplicate reset submission | Retained with tests executing the existing inline script; T0057 success behavior preserved |
| Malformed state/feedback/funnel request bodies | Retained; no storage call on malformed input |
| Removing D1 GET fallback and automatic legacy import | Deferred; broader than needed after deployed write prohibition. Existing GET contract remains unchanged |
| Funnel's obsolete Astro.locals binding and misleading current-data label | Retained; legacy data display explicitly identified and migration prompt removed |
| Unused Astro SESSION KV binding | Disable unused Astro session API; app continues using signed cookies. No live KV deletion or secret change |
| Generated Worker config / release typecheck base SHA | Retained: build guards actual deploy artifact; CI-provided base SHA now honored |
| Old release receipt / historic architecture edits | Left in saved branch; not carried into this follow-up |

Original worktrees and commits remain intact: release `77ed4fb`, Calendar `401c72f`, and the uncommitted files in the 20260907 worktree, main checkout, and Calendar's `supabase/.temp/cli-latest`. No reset, clean, stash-drop or force-push was used.

## Validation and integration

Run `npm test`, `npm run typecheck:release`, `npm run build`, `npm run test:preview`, and `npm run security:check`. Unit tests use fake Workers bindings and mock Supabase HTTP, never production credentials. The generated configuration guard checks production routes, compatibility flags/date, ASSETS/DB identity and absence of unintended KV/Images/test secret bindings. Local preview configuration uses the same compatibility date/flags.

Merge dependency: #73 → this follow-up → Calendar #44 → Distribution #66. Retarget this PR to master after #73 acceptance. Human authorization remains required for every production merge/deploy. Calendar activation secrets and Apps Script setup remain outside this change.
