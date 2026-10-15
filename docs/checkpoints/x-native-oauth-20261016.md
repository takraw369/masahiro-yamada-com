# X native OAuth continuation — 2026-10-16

Purpose: safely connect the four existing X brands from MASA Dashboard, retaining existing Harness identities, publish_queue and LINE. First real acceptance is MASAHIRO_501 authorization -> GET /2/users/me -> correct handle/numeric-ID receipt; no posting/scheduling/DM.

## Current state / checkpoint 1
- Existing PR #356 head 1d5ccb6 and companion automation #245 head e3125c4 inspected fresh; both already have ephemeral read-only PKCE flow, not persistent connections.
- Worktree: /Users/hondod20/Projects/masa-dashboard-x-oauth-20261016; Runner: /Users/hondod20/Projects/masa-x-oauth-20261016. Existing PR branches reused; primary checkouts have unrelated edits and remain untouched.
- X Developer Console redirects to login; App identity/type/OAuth2/callback settings remain UNVERIFIED. No login credentials requested.
- Fresh Cloudflare Secret-name listing: Runner has no X OAuth client/token Secret; website has existing DASHBOARD_SESSION_SECRET, no X credential. Values were never retrieved.
- Existing Harness D1 identity-only SELECT returns one kodomo_athlete binding; do not overwrite its numeric ID or Harness UUID. No rows written. Other target IDs unknown until verified authorization.
- Production baseline: Runner b1a40680-1c2a-4abd-8796-f39178a5aedb (2026-10-14); Dashboard 6fcdcafb-c14b-4510-99aa-268995dc068a (2026-10-15). No deploy performed.

## In progress / acceptance still UNVERIFIED
- Extend existing Runner RPC with encrypted Cloudflare-only credential storage, identity pins, expiry, safe list/recheck/local disconnect; reuse existing FLOW_DB, no business registry.
- Extend authenticated Dashboard handlers + existing panel to connection states and management. First authorized target default MASAHIRO_501 only; other brands gated until first real E2E approval.
- Scope fixed users.read tweet.read, no offline/refresh; expiry requires reconnect.
- Prevent request URL invocation logs from retaining callback authorization code/state; retain custom/error observability.
- Run current tests/build/typecheck, security review, synthetic cross-repo integration, CI. No actual X consent or live E2E yet.

## Next smallest action
Complete shared RPC contract and execute handler/Runner synthetic /me acceptance before pushing existing PR branches.

## Human Gate
Separate approval required for production Secret entry, X App settings and callback allowlist changes, database migration, production deployment/flags. X identity consent is MASA-operated. Dashboard public HTTPS design finalization remains UNVERIFIED without approved exact-source preview. Never copy credentials, tokens, OAuth codes, cookies or private logs into checkpoints/PRs.
