# P0 Release Gate — 2026-08-14

Scope: [`takraw369/masahiro-yamada-com` PR #6](https://github.com/takraw369/masahiro-yamada-com/pull/6), tracked by [Issue #7](https://github.com/takraw369/masahiro-yamada-com/issues/7).

Current decision: **NO-GO for production**. The code-side gate passes, but the active Cloudflare version, production secret names, D1 schema, hosted preview, PR merge, and production rollout still require the manual gates below. Production deploy, secret changes, and PR merge were not performed.

## DONE

### Code and configuration

- Replaced the invalid Pages preview command with the Worker-native path: `npm run build && wrangler dev`.
- Enabled Worker preview URLs and defined an explicit preview contract:
  - `APP_ENV=preview`
  - harness proxy and side effects disabled
  - invalid placeholder upstreams
  - no D1 binding
  - no rate-limit bindings
  - no production auth/integration secrets inherited into the preview configuration
- Verified generated `dist/server/wrangler.json` preserves production bindings at the top level while its `previews` block has no D1 or rate-limit binding.
- `/contact`, `/`, `/about`, `/ace`, and `/tips` are covered by a real local Worker smoke test and return HTML `200`.
- With production-only secrets intentionally absent:
  - `/dashboard` redirects to `/dashboard/login` with `Cache-Control: no-store, max-age=0`.
  - protected APIs return JSON `503 service_unavailable` with `no-store`.
- Dashboard-state handlers now have direct regression coverage proving an authorized request returns `503 database_unavailable` when `DB` is absent and never queries DB before authorization.
- Production workflow now rejects any checkout whose `GITHUB_REF` is not `refs/heads/master` or whose `GITHUB_SHA` differs from `git rev-parse HEAD`.
- `wrangler versions upload --dry-run` validates the Worker bundle without uploading or deploying it.

### GitHub controls observed on 2026-08-14

- `master` is protected, force-push and deletion are disabled, strict required checks are `test-and-build` and `secret-scan`.
- GitHub environment `production` requires reviewer `takraw369` and its deployment branch policy allows only `master`.
- Repository Actions secret names `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID` exist. Their values were not read.
- PR #6 pre-change head `28cf5e857040398ab4a814e7e9c4d807a78b1e21` was open, non-draft, mergeable, and its Security verification run `31714293799` passed.

### Verification results

| Gate | Result |
| --- | --- |
| `npm run test:security` | PASS — 22/22 |
| `npm run test:preview` | PASS |
| `npm run build` | PASS |
| `npx wrangler types --check` | PASS |
| `npm audit --omit=dev --audit-level=high` | PASS — 0 vulnerabilities |
| `npx wrangler versions upload --dry-run` | PASS |
| `git diff --check` | PASS |

Build warnings about a CSS `@import`, large client chunks, and intentionally absent local production secrets are non-blocking and do not alter these gate results.

### Read-only live baseline observed on 2026-08-14

- `https://masahiro-yamada.com/`, `/contact`, `/about`, `/ace`, and `/tips` returned `200`.
- The current production `/api/dashboard/state` returned `200` to an unauthenticated GET. This confirms that the P0 containment in PR #6 is **not active in production**; no response data was retained.
- GitHub records the most recent successful `deploy.yml` run as run `24483219306` for master SHA `d479dbb01e9e3088ce345ca259eabd382fcbe339` on 2026-04-15. GitHub's Deployments API returned no deployment records, so this alone does not prove the currently active Cloudflare version.

## MANUAL

Run these in order. Stop at the first mismatch.

### 1. Freeze and verify the PR release candidate

```bash
gh pr checks 6 --repo takraw369/masahiro-yamada-com
gh pr view 6 --repo takraw369/masahiro-yamada-com \
  --json state,isDraft,mergeable,headRefName,headRefOid,baseRefName
```

Expected:

- `test-and-build` and `secret-scan` are `pass` for the same `headRefOid`.
- `state=OPEN`, `isDraft=false`, `mergeable=MERGEABLE`.
- `headRefName=codex/p0-security-containment`, `baseRefName=master`.

Rollback/stop condition: any missing/stale check, changed base, conflict, or unexpected head SHA is **NO-GO**. Do not merge or deploy.

### 2. Create and test a non-production hosted preview

This creates a Worker version and preview alias, not a production deployment. Run only in an authorized Cloudflare shell.

```bash
npm ci --no-audit --no-fund
npm test
npx wrangler versions upload \
  --preview-alias p0-pr-6 \
  --message "PR #6 release candidate $(git rev-parse HEAD)" \
  --strict
```

Expected:

- Wrangler prints a `p0-pr-6-masahiro-yamada-com.<subdomain>.workers.dev` URL.
- At that URL: `/`, `/contact`, `/about`, `/ace`, and `/tips` return `200`.
- `/dashboard` redirects to `/dashboard/login` with `no-store`.
- `/api/dashboard/state` and `/api/x-harness/status` return `503` with `service_unavailable`.

Rollback/stop condition: a preview version has no production traffic. If any expected result differs, do not promote it; retain the URL and logs for diagnosis.

### 3. Record active Cloudflare production provenance

```bash
npx wrangler deployments status --json
npx wrangler versions list --json
```

Expected:

- Exactly one understood production deployment is serving traffic.
- Record its version ID, creation time, message/tag, and the Git SHA or CI run that produced it.
- Before release, treat any version that cannot be mapped to reviewed `master` as **NO-GO**.
- After an approved rollout, the active version must map to the exact merge SHA that passed the required checks.

Rollback/stop condition: ambiguous traffic split, unknown version, dashboard-only edit, or SHA mismatch is **NO-GO**.

### 4. Verify production secret names without reading values

```bash
npx wrangler secret list
```

Expected names:

- `DASHBOARD_PASSWORD`
- `DASHBOARD_OPERATOR_PASSWORD`
- `DASHBOARD_SESSION_SECRET`
- `X_HARNESS_API_KEY`
- `LINE_HARNESS_API_KEY`

Rollback/stop condition: any missing name is **NO-GO**. Do not add, rotate, revoke, or copy a secret as part of this gate without separate approval. Keep `HARNESS_PROXY_ENABLED=false` and `HARNESS_SIDE_EFFECTS_ENABLED=false`.

### 5. Verify the production D1 schema read-only

```bash
npx wrangler d1 execute sunlovesflow-db --remote \
  --command "SELECT name FROM sqlite_master WHERE type='table' AND name='ace_checked';"
```

Expected: exactly one row named `ace_checked`.

Rollback/stop condition: no row, multiple/unexpected databases, or any query error is **NO-GO**. Do not apply a production migration during verification.

### 6. Approved rollout and post-deploy checks

Only after PR review/merge and explicit production-deploy approval:

```bash
gh run list --repo takraw369/masahiro-yamada-com \
  --workflow deploy.yml --branch master --limit 1
```

Expected: one successful `push` run for the reviewed merge SHA, after the GitHub `production` reviewer gate.

Post-deploy expected results:

- public routes above remain `200`;
- unauthenticated `/dashboard` redirects with `no-store`;
- unauthenticated `/api/dashboard/state` returns `401`, never `200`;
- harness APIs reject unauthenticated requests and both harness enable switches remain false;
- `npx wrangler deployments status --json` reports 100% traffic on the reviewed merge SHA's version.

Rollback condition: any public regression, unauthenticated dashboard-state `200`, auth bypass, unexpected enabled integration, error spike, or provenance mismatch. Stop traffic promotion and, with explicit production approval, restore the recorded known-good version through Cloudflare rollback. Keep the failed version ID and CI logs.

## BLOCKED

- Cloudflare deployment/version status, Worker secret-name inventory, hosted preview URL, and remote D1 schema could not be verified from this session because Wrangler had no `CLOUDFLARE_API_TOKEN`. No credential was requested, read, or changed.
- PR #6 merge is blocked by the mission guardrail and was not performed.
- Production deployment is blocked by the mission guardrail and was not performed.
- Any credential rotation/revocation/change is blocked by the mission guardrail and was not performed.
- The currently active production Worker cannot yet be mapped to a reviewed Git SHA. The public route shape differs from the last GitHub-recorded master deployment while the unauthenticated dashboard-state API still exhibits pre-containment behavior.

## GO / NO-GO

**GO** only when all MANUAL checks pass for one immutable PR head SHA, PR #6 is reviewed and merged through protected `master`, production approval is granted, the deployed Cloudflare version maps to that exact merge SHA, and post-deploy checks pass.

**NO-GO** for any stale/failing required check, preview regression, absent secret name, missing D1 table, unknown Cloudflare version, non-master source, traffic split, enabled harness side effect, unauthenticated dashboard-state `200`, or public-page regression.
