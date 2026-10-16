# X native OAuth — approval and acceptance runbook

Status: implementation in existing draft PRs [website #356](https://github.com/takraw369/masahiro-yamada-com/pull/356) and [Runner #245](https://github.com/takraw369/masa-automation/pull/245). Production is not activated. First real OAuth E2E remains **UNVERIFIED**.

## Reused architecture and boundaries

The existing Dashboard → 投稿 → 接続と分析 panel, private `FLOW_RUNNER` service binding, S256 PKCE start/callback and bounded `GET https://api.x.com/2/users/me` transport are extended. Existing Harness sender IDs, `publish_queue`, human approval, idempotency and LINE integration stay unchanged. No new Harness, CMS, CRM, scheduler or canonical business account registry is introduced.

The four existing brand handles are `MASAHIRO_501`, `aima_no_te`, `kodomo_athlete`, `sunlovesflow`. OAuth connection metadata is separate from editorial playbooks and from the existing composer destination. Default authorized target is **MASAHIRO_501 only**; the other three remain locked until its real read-only acceptance is observed and expansion is separately approved.

Requests use exactly `users.read tweet.read`. Extra/write/DM/offline scopes or refresh tokens fail closed. Tokens are not sent to browser JavaScript, logs, Git, Sheets, Drive or Supabase. Credentials are encrypted with AES-GCM in the Runner's existing Cloudflare `FLOW_DB`; the encryption key and confidential-client secret are Worker Secrets. Tokens expire; reconnect is required. X documents a default two-hour lifetime without offline access: [official OAuth reference](https://docs.x.com/fundamentals/authentication/oauth-2-0/authorization-code). The actual `expires_in` returned by X controls the displayed expiry.

Initial binding requires an exact selected handle match from `/2/users/me`; the numeric ID is then immutable across reconnects. A previously configured identity pin must match. The known existing Harness ID for `kodomo_athlete` is preserved. No other brand ID is guessed. Local disconnect removes the stored credential, retains the identity pin and does not revoke the App in X. Revoke access in X's connected-app settings when needed. No native publishing path consumes these credentials.

## Inspected fresh on 2026-10-16

- Both PR heads inspected before changes: Runner `e3125c4`, website `1d5ccb6`.
- Initial Console inspection required login. After MASA logged in, the existing App settings were read directly: OAuth2 **Native App / public client** selected, OAuth1 **Read only**, exact callback below already present, website URL correct. No settings were edited or saved. Do not create a replacement App or switch its client type.
- Cloudflare Secret **names only** were listed: Runner has no X OAuth2 client/secret/encryption key; website already has `DASHBOARD_SESSION_SECRET`. No values were retrieved.
- Existing Harness D1 identity-only SELECT found one `kodomo_athlete` account. No canonical task/account writes or D1 writes occurred.
- Baseline active production versions: Runner `b1a40680-1c2a-4abd-8796-f39178a5aedb`; website `6fcdcafb-c14b-4510-99aa-268995dc068a`. Deployment verification is tracked in the checkpoint.

## MASA's Developer Portal screen

Open [X Developer Console](https://console.x.com/) and sign in personally. Select the **existing App**, then open its authentication settings (legacy portal labels: **Settings → User authentication settings → Edit**). The current portal uses **アプリ → existing App → 設定 → 認証設定**; this path and the selected fields were observed after MASA logged in.

1. The existing **Type of App** is **ネイティブアプリ / 公開クライアント**. Configure the Runner as `X_OAUTH_CLIENT_TYPE=public`; no Client Secret is required for this App. OAuth 2.0 and the exact Callback are already configured. Confirm **OAuth 2.0** and current **Type of App**. Web App / Automated App or Bot are confidential clients; Native App / Single Page App are public clients. Keep the existing type unless its change is approved.
2. **Callback URI / Redirect URL** already contains this exact URL. No edit or Save action is required:

   `https://masahiroyamada.com/api/dashboard/x-oauth/callback`

   No trailing slash, query or fragment. Website URL, if required: `https://masahiroyamada.com`.
3. **Keys and Tokens → OAuth 2.0 Client ID / Client Secret** provides the client credentials. Do not regenerate existing OAuth1 keys, disable OAuth1, or change legacy Read/Write/DM settings for this test. OAuth2 request scopes above constrain the new path. Check [official App configuration](https://docs.x.com/fundamentals/developer-apps).

Secrets must be entered directly through the approved Cloudflare Worker Secret interface. Never paste them into chat, PRs, Dashboard fields or this document. App credentials cannot be inferred from the existing OAuth1 key fields.

## Separate production approval packet

Only read-only App inspection has been executed; no listed production mutation has been executed. Approve the intended changes together only after reviewing both PR diffs and CI:

| Existing component | Proposed approved setup |
| --- | --- |
| X Developer App | Already inspected: public Native App + exact callback; preserve existing configuration, no change required |
| `masa-flow-runner` settings | `X_OAUTH_READ_ENABLED=true`, existing App's `X_OAUTH_CLIENT_ID`, `X_OAUTH_CLIENT_TYPE=public`, `X_OAUTH_REDIRECT_URI` |
| Runner Worker Secrets | New independent 32-byte base64url `X_OAUTH_TOKEN_ENCRYPTION_KEY`; existing public App needs no Client Secret |
| Runner persistence | `X_OAUTH_PERSIST_ENABLED=true`, apply the added credential migration to existing `FLOW_DB` only after approval; optional partial immutable ID pins via `X_OAUTH_EXPECTED_USER_IDS_JSON` |
| Initial rollout | Omit `X_OAUTH_ENABLED_TARGETS_JSON` so only MASAHIRO_501 is enabled |
| Website | Reuse existing `DASHBOARD_SESSION_SECRET`, enable `X_NATIVE_READ_ENABLED=true` |
| Deploy | Deploy reviewed Runner and website PR versions after explicit approval; flags default OFF before then |

The website source disables automatic request-URL invocation logs because OAuth callback query strings contain authorization code/state. Custom/error observability remains enabled. The built Worker configuration enforces this. Check any Cloudflare Logpush, Tail or external HTTP/access logs for query-string retention before activation; application code cannot redact independent platform exports. Do not enable a raw request tail during OAuth. This security configuration change takes effect only with the separately approved production deployment. See [Cloudflare invocation logging](https://developers.cloudflare.com/workers/observability/logs/workers-logs/).

D1 contains encrypted credential material plus minimal derived identity/expiry metadata, not canonical MASA task state. Key loss/rotation makes existing ciphertext unreadable: require reconnect using the preserved numeric ID. Do not erase identity pins or overwrite another user's binding as a recovery shortcut.

## MASA's first authorization and read-only acceptance

After approved setup/deployment:

1. Open [Dashboard 投稿](https://masahiroyamada.com/dashboard/post), sign in, then **接続と分析 → Xアカウント接続**. In the **MASA @MASAHIRO_501** row, press **Xアカウントを接続**.
2. On X verify the signed-in account is **@MASAHIRO_501** and permissions contain only reading account/posts. Wrong account: cancel, switch X account, retry. No posting, scheduling or DM test.
3. Back on Dashboard verify **接続済み**, exact handle, actual numeric X user ID and expiry. Press **読み取りを再確認** once. Capture only these safe results; never capture callback URL, code, cookie, token or Secret.

Acceptance requires direct real `/2/users/me` identity proof through the actual deployed Callback and stored credential recheck. Unit tests, synthetic browser states and editorial playbooks are not real account E2E. After this receipt passes, separately approve enabling the remaining three handles and authorize **each account independently**. Repeat identity and expiry checks for each. All native send/schedule/DM capabilities remain unavailable.

## Verification / resumption

Fresh code/test/CI evidence and the next smallest action are recorded in `docs/checkpoints/x-native-oauth-20261016.md`. UI guidance and local rendered evidence do not imply production deployment or real OAuth. Public HTTPS Better Design dashboard finalization remains UNVERIFIED until an approved exact-source preview is captured; never weaken Dashboard authentication for that review.
