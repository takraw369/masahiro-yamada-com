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
`offline.access` decision. The 2026-10-16 extension below supplies an OAuth callback and requires no
posting scope. Do not enter credentials into the Dashboard or chat.

Only after a real `/2/users/me` receipt should four-account OAuth mapping and the
existing Issue #217 `publish_queue` approval/scheduling/receipt bridge proceed.
Preserve `human_approved`, idempotency, source lineage and provider-specific IDs.
No second scheduler, account registry, CRM or LINE path is introduced.

The existing SNS_ACCOUNT_REGISTRY is behind BRAND_OS. The accompanying local
handoff proposes changes to the existing handle-matched rows only; no canonical
Sheet update was performed. Source policy is distinct from OAuth verification.


## 2026-10-16 OAuth unblock — first one-account read only

Existing sessions, private service binding and X `/2/users/me` transport are reused.
There was no X OAuth2/PKCE callback in either repository. Google login uses a
Supabase token bootstrap, and the Google Drive refresh connector is provider-
specific. The existing Harness exposes OAuth1 signing, not this authorization flow.

New authenticated routes inside this Dashboard:
- POST `/api/dashboard/x-oauth/start`: session + same-origin JSON + known handle;
  creates a random state, S256 verifier/challenge and a 10-minute encrypted pending
  HttpOnly/Secure/SameSite=Lax cookie. Verifier never enters browser JavaScript.
- GET `/api/dashboard/x-oauth/callback`: validates cookie/state/expiry, exchanges
  only through Flow Runner, checks account/scopes/receipt, consumes pending cookie
  and redirects 303 without code/state in the destination URL.
- GET `/api/dashboard/x-oauth/status`: returns safe preparation state and a
  historical sanitized receipt; never an access/refresh token or client secret.

AES-GCM uses a purpose-derived key from the already-existing
`DASHBOARD_SESSION_SECRET`, independently of the login password. Missing key fails
closed. Valid admin authentication is required on all stages; the pending cookie
is not bound to the raw rolling session nonce, because middleware renews it.
Origin, purpose and encryption-key binding plus PKCE prevent cross-context use.
No database/resources/schema changes. Confirmation receipts expire after 10 min.

The existing 接続と分析 tab now lets MASA select one of the four current brands and
press **Xで読み取りを許可**. On return it displays **認可時の読み取りを確認** with the
actual X user ID and time. A mismatch is explicitly rejected, even if another
brand's X identity is otherwise valid. It does not become the composer account.
The old fixed-token diagnostic remains separate; this new path needs no stored
`X_ACCESS_TOKEN`. Read scopes: `users.read tweet.read`, no offline/write scopes.
No access token is retained, so the receipt is not a persistent connection.

Proposed configuration, all still approval-gated:
1. Existing X App: verify current type/OAuth2 settings and add the exact callback
   `https://masahiroyamada.com/api/dashboard/x-oauth/callback`, keeping existing
   callbacks. No new App/Harness. App metadata is UNVERIFIED behind user login.
2. Runner: X_OAUTH_READ_ENABLED, X_OAUTH_CLIENT_ID, matching X_OAUTH_CLIENT_TYPE,
   X_OAUTH_REDIRECT_URI, and X_OAUTH_CLIENT_SECRET only for a confidential client.
   Optional pre-verified numeric ID pins are configuration, never learned or
   overwritten from the callback. No actual values are stored in source/docs.
3. Website: existing native-read flag and existing session encryption Secret.
   Deploy both existing PRs/flags only after separate approval.

After approved deployment, MASA's operation is at most three steps:
1. In the existing X Developer App, confirm OAuth2 and the callback above. Client
   credentials go only through the approved Cloudflare settings/Secret path.
2. Dashboard → 投稿 → 接続と分析 → 確認するブランド → **Xで読み取りを許可**.
3. On X, verify the selected account and read permissions, authorize, then confirm
   the returned handle and numeric X ID on Dashboard. Wrong account: cancel/retry.

This implementation is tested with a synthetic provider. Real user authorization,
production Secret registration, deploy and live E2E have not run. LINE and
publish_queue remain untouched. Subsequent persistent OAuth/token retention and
publishing are later work; they cannot consume this historical receipt as a grant.
