# X native OAuth — production acceptance runbook

Status as checked on 2026-10-16: [website #356](https://github.com/takraw369/masahiro-yamada-com/pull/356) and [Runner #245](https://github.com/takraw369/masa-automation/pull/245) are merged and production is activated under MASA’s explicit approval. Actual Dashboard → Runner → D1 status and the official X consent page were observed. **MASAHIRO_501 consent, real token exchange, numeric-ID binding and stored-token recheck remain UNVERIFIED.** The other three brands remain disabled. Do not repeat key registration or migration during resume.

## Reused architecture and boundaries

The existing Dashboard → 投稿 → 接続と分析 panel, private `FLOW_RUNNER` service binding, S256 PKCE start/callback and bounded `GET https://api.x.com/2/users/me` transport are extended. Existing Harness sender IDs, `publish_queue`, human approval, idempotency and LINE integration stay unchanged. No new Harness, CMS, CRM, scheduler or canonical business account registry is introduced.

The four existing brand handles are `MASAHIRO_501`, `aima_no_te`, `kodomo_athlete`, `sunlovesflow`. OAuth connection metadata is separate from editorial playbooks and from the existing composer destination. Default authorized target is **MASAHIRO_501 only**; the other three remain locked until its real read-only acceptance is observed and expansion is separately approved.

Requests use exactly `users.read tweet.read`. Extra/write/DM/offline scopes or refresh tokens fail closed. Tokens are not sent to browser JavaScript, logs, Git, Sheets, Drive or Supabase. Credentials are encrypted with AES-GCM in the Runner's existing Cloudflare `FLOW_DB`; the encryption key is a Worker Secret. This existing public-client App requires no Client Secret. Tokens expire; reconnect is required. X documents a default two-hour lifetime without offline access: [official OAuth reference](https://docs.x.com/fundamentals/authentication/oauth-2-0/authorization-code). The actual `expires_in` returned by X controls the displayed expiry.

Initial binding requires an exact selected handle match from `/2/users/me`; the numeric ID is then immutable across reconnects. A previously configured identity pin must match. The known existing Harness ID for `kodomo_athlete` is preserved. No other brand ID is guessed. Local disconnect removes the stored credential, retains the identity pin and does not revoke the App in X. Revoke access in X's connected-app settings when needed. No native publishing path consumes these credentials.

## Initial inspection on 2026-10-16 (historical, before activation)

- Both PR heads inspected before changes: Runner `e3125c4`, website `1d5ccb6`.
- Initial Console inspection required login. After MASA logged in, the existing App settings were read directly: OAuth2 **Native App / public client** selected, OAuth1 **Read only**, exact callback below already present, website URL correct. No settings were edited or saved. Do not create a replacement App or switch its client type.
- Cloudflare Secret **names only** were listed: Runner has no X OAuth2 client/secret/encryption key; website already has `DASHBOARD_SESSION_SECRET`. No values were retrieved.
- Existing Harness D1 identity-only SELECT found one `kodomo_athlete` account. No canonical task/account writes or D1 writes occurred.
- Baseline active production versions: Runner `b1a40680-1c2a-4abd-8796-f39178a5aedb`; website `6fcdcafb-c14b-4510-99aa-268995dc068a`. Deployment verification is tracked in the checkpoint.

## MASA's Developer Portal screen

Open the [existing App settings](https://console.x.com/accounts/2042472179992801280/apps/settings?appId=32744513) and sign in personally if an inspection is needed. Existing App name: **2042472179992801280MASAHIRO_50**. The current portal path is **アプリ → existing App → 設定 → 認証設定**. No Portal edit is needed for the remaining first-account acceptance.

1. The existing **Type of App** is **ネイティブアプリ / 公開クライアント**. Configure the Runner as `X_OAUTH_CLIENT_TYPE=public`; no Client Secret is required for this App. OAuth 2.0 and the exact Callback are already configured. Confirm **OAuth 2.0** and current **Type of App**. Web App / Automated App or Bot are confidential clients; Native App / Single Page App are public clients. Keep the existing type unless its change is approved.
2. **Callback URI / Redirect URL** already contains this exact URL. No edit or Save action is required:

   `https://masahiroyamada.com/api/dashboard/x-oauth/callback`

   No trailing slash, query or fragment. Website URL, if required: `https://masahiroyamada.com`.
3. The existing public OAuth 2.0 Client ID is configured in the Runner. **No Secret reveal, regeneration or entry is required now.** Do not regenerate OAuth1 keys, disable OAuth1 or change legacy Read/Write/DM settings for this test. OAuth2 request scopes above constrain the new path. See [official App configuration](https://docs.x.com/fundamentals/developer-apps).

Secrets must be entered directly through the approved Cloudflare Worker Secret interface. Never paste them into chat, PRs, Dashboard fields or this document. App credentials cannot be inferred from the existing OAuth1 key fields.

## Approved production activation — completed

MASA explicitly approved encryption-key registration, the existing FLOW_DB credential migration, runtime flags and reviewed deployment on 2026-10-16. These actions completed; their approval is not pending.

| Component | Verified result |
| --- | --- |
| Existing X App | Public Native App, callback already registered; no App settings changed |
| Runner | PR245 merged as `47b1a27`; active Worker `7efd7569-76ea-4699-be69-11d1c0ba20f7` |
| Credential storage | Independent encryption-key Secret registered without plaintext output; only `0003_x_oauth_connections.sql` applied to existing FLOW_DB |
| Runtime | Read + persistence enabled, public client; `X_OAUTH_ENABLED_TARGETS_JSON=["MASAHIRO_501"]` |
| Website | PR356 merged as `b7eb274`; [protected production deployment succeeded](https://github.com/takraw369/masahiro-yamada-com/actions/runs/38857257498); subsequent unrelated deployments retain native-read settings |
| Observability | Both Workers redact query strings; website invocation URL logs off; each Worker logpush off and no tail consumer |
| Existing paths | Previous binding names retained; existing publish_queue and LINE paths preserved |

Fresh metadata follow-up on 2026-10-16 found website Worker `1709b44d-baf6-435f-aec0-a4d72d10ed11`; intended native-read, logging and service-binding settings remain present. Deployment IDs are receipts, not permanent pins: inspect current runtime before any future deploy. Account/zone Logpush-list permission returns 403, so independent export inspection remains **UNVERIFIED**. Do not enable raw request tails during OAuth or weaken Dashboard authentication for diagnostics.

D1 contains encrypted credential material plus minimal derived identity/expiry metadata, not canonical MASA task state. Key loss/rotation makes existing ciphertext unreadable: require reconnect using the preserved numeric ID. Do not erase identity pins or overwrite another user's binding as a recovery shortcut.

## MASA's first authorization and read-only acceptance

Production setup is complete. No additional Secret or App change is needed:

1. Open [Dashboard 投稿](https://masahiroyamada.com/dashboard/post), sign in, then **接続と分析 → Xアカウント接続**. In the **MASA @MASAHIRO_501** row, press **Xアカウントを接続**.
2. On X verify the signed-in account is **@MASAHIRO_501** and permissions contain only reading account/posts. MASA presses **アプリにアクセスを許可**. Wrong account: cancel, switch X account, retry. No posting, scheduling or DM test. The pending authorization expires after **10 minutes**: if delayed, restart from the Dashboard connect button rather than reusing an old consent/callback URL.
3. Back on Dashboard verify **接続済み**, exact handle, actual numeric X user ID and expiry. Press **読み取りを再確認** once. Capture only these safe results; never capture callback URL, code, cookie, token or Secret.

Acceptance requires direct real `/2/users/me` identity proof through the actual deployed Callback and stored credential recheck. Unit tests, synthetic browser states and editorial playbooks are not real account E2E. After this receipt passes, separately approve enabling the remaining three handles and authorize **each account independently**. Repeat identity and expiry checks for each. All native send/schedule/DM capabilities remain unavailable.

## Recovery and verification after consent

| Observed state | Safe next action |
| --- | --- |
| `expired` callback or delayed consent | Open Dashboard and start a fresh authorization within 10 minutes; never replay a saved callback |
| `identity_mismatch` | Cancel, verify selected brand and signed-in X handle, then retry with the intended account; never replace the pinned ID |
| `failed` callback | Verify safe configuration/error labels and current runtime; do not copy upstream response bodies, raw URLs, cookies or credentials into logs |
| Expired/revoked credential | Reauthorize the same brand and immutable numeric ID; no refresh/offline scope is requested |
| Local disconnect requested | Use the Dashboard confirmation; credential is erased and numeric-ID pin retained. This does not revoke the App on X |
| Revoke App access requested | MASA uses X’s connected-app settings. This may affect all grants using that App; do not use revocation as a routine E2E test |
| Stop native-read feature | Prepare reviewed flag changes for both existing services, retain encrypted records/identity pins and existing integrations; execute only under the applicable production authorization |

Safe production D1 read-back on 2026-10-16 at 12:24 UTC succeeded with zero connection rows and zero writes; first authorization remains pending. After the first actual callback, the agent records safe target/username/numeric ID, expiry and recheck timestamps. If database verification is needed, use an identity-only SELECT; **never `SELECT *` or return ciphertext**:

```sql
SELECT target, user_id, username, connected_at, verified_at, expires_at, status,
       CASE WHEN token_ciphertext LIKE 'v1.%' THEN 1 ELSE 0 END AS encrypted_v1_present
FROM x_oauth_connections
ORDER BY target;
```

Success requires one `MASAHIRO_501` connection matching actual `/2/users/me`, a successful stored-token read recheck, an encrypted credential presence boolean, and no other enabled brand. Do not disconnect a successful real grant just to test erase: isolated-D1 tests cover that behavior.

## Verification / resumption

Runner feature CI: [190 tests and checks PASS](https://github.com/takraw369/masa-automation/actions/runs/38856918670). Website feature CI: [509 tests, zero skipped and release checks PASS](https://github.com/takraw369/masahiro-yamada-com/actions/runs/38856920055). Production pipeline repeated the website release checks successfully. Earlier actual-handler/connector integration against isolated D1 passed 15 synthetic checks. These receipts do not prove live consent, token exchange or account binding. Whole-repository Astro debt was 214 errors at that release; changed source files had zero errors.

Follow-up command-line HTTP probes returned Cloudflare 403 before an application JSON result could be observed. Application-level unauthenticated 401 verification through that transport is **UNVERIFIED**; do not relabel the response as a successful auth test or bypass the edge protection.

Fresh evidence and the next smallest action are recorded in `docs/checkpoints/x-native-oauth-20261016.md`. Public HTTPS Better Design whole-dashboard finalization also remains UNVERIFIED; changed-panel local geometry at 390/1440/1728 had zero findings. Never weaken Dashboard authentication for that review. Native posting/scheduling/DM remains prohibited, and enabling the remaining three accounts requires first-account acceptance plus explicit expansion approval.
