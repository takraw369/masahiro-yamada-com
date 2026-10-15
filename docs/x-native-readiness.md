# X Native read-only Dashboard diagnostics (draft)

The existing `/dashboard/post` page keeps using the X Harness poster and
scheduler. Nothing in this change selects a native account for posting.

When an operator opens the existing **接続と分析** tab, a separate panel calls
`GET /api/dashboard/x-native-accounts`. This new route:
- is already covered by centralized Dashboard session and same-origin checks
  in `src/middleware.ts`, and repeats session verification locally;
- refuses access unless Worker runtime variable `X_NATIVE_READ_ENABLED` is
  **exactly** `true` (default OFF, 423 response);
- uses the existing private Cloudflare `FLOW_RUNNER` service binding and its
  `xNativeAccountsReadOnly()` method from masa-automation Draft PR #245;
- strips unknown fields and refuses multi-account/write-capable responses;
- never returns API tokens or X provider raw errors;
- has **no POST or publishing route**, no Account OS switch, and no new secrets.

Until the Flow Runner #245 code passes review and is explicitly deployed,
keep this feature OFF. Changing this flag and deploying either production
Worker needs a separate explicit human approval. When permitted, validate
one real user-context token and `GET /2/users/me` first; do not equate a brand
playbook with a connected X OAuth account.

Existing X Harness and the Dashboard's `/api/x-harness/*` publishing
paths remain unchanged. Do not enable X official API posting from this panel.

Related:
- Flow Runner prerequisite: https://github.com/takraw369/masa-automation/pull/245
- X Harness recovery runbook: docs/x-connection-recovery.md

## 2026-10-15 resumed state

Legacy Harness key recovery is on hold. This PR continues the existing private
Flow Runner read path; it does not switch the composer to a different sender.
Production `X_ACCESS_TOKEN` is absent on Flow Runner and `X_NATIVE_READ_ENABLED`
is not enabled on the website. Authenticated real-account API/UI E2E is
**UNVERIFIED**. No production deploy, secret write, OAuth, post or schedule ran.

Runtime failure contracts now distinguish missing credential (503), X permission
or auth rejection (502 with `x_401`/`x_403`, separate from Dashboard session 401),
rate limiting (429), timeout (504) and invalid response (502). The actual handler
is tested with a private service-binding fixture; errors never become an empty
successful account list. The panel has a retry button and validates the success
shape again before display. A response outside the four brands is flagged.

The editorial playbook now follows BRAND_OS's 2026-10-15 charter v1.1:
`MASAHIRO_501`, `aima_no_te`, `kodomo_athlete`, `sunlovesflow`. These are editorial
targets, not connected-account records. The unapproved `all_are_ace` display alias
is removed. Explicitly selecting an unconnected brand clears the old composer
selection and blocks review, while keeping the draft. Native numeric X IDs never
enter the legacy Harness send path.

Next Human Gate: authorize the existing X app for one user-context read credential,
register it securely on the existing Flow Runner, and approve deployment/enablement
separately. Read scopes are `tweet.read` + `users.read`; refresh requires a separate
`offline.access` decision. This code exposes no OAuth callback and requires no
posting scope. Do not enter credentials into the Dashboard or chat.

Only after a real `/2/users/me` receipt should four-account OAuth mapping and the
existing Issue #217 `publish_queue` approval/scheduling/receipt bridge proceed.
Preserve `human_approved`, idempotency, source lineage and provider-specific IDs.
No second scheduler, account registry, CRM or LINE path is introduced.

The existing SNS_ACCOUNT_REGISTRY is behind BRAND_OS. The accompanying local
handoff proposes changes to the existing handle-matched rows only; no canonical
Sheet update was performed. Source policy is distinct from OAuth verification.
