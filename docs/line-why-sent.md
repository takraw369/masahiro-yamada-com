# LINE Control Plane P0 — Why Sent

Scope: Issue #68, existing `/dashboard/lian` only. Base `4a3ebf1b960dccf2109ec0bec6e1f98f95a0be84`. No new page, navigation, write action, auth/session change or send path.

Outbound Recent Messages gain a collapsed native Why Sent disclosure. It shows recorded message/sequence/step evidence, contact-consistent joined enrollment/definitions, recorded trigger/transport, and exact retention guard evidence when available. Missing values display **Not captured**. Current definition names and guard state are labelled current. A request group is not an execution ID. Inbound messages never receive this disclosure.

The companion `masa-automation` branch `feat/line-why-sent-68` prepares `supabase/migrations/20260909_masa_line_why_sent.sql`. Its contract/investigation receipt is `supabase/tests/line-control-plane/README.md`. It preserves all original snapshot fields and owner authorization. The new UI works against the old snapshot; the old UI works against the additive snapshot.

## Evidence and limits

Live sequence dispatch v8 creates an aggregate run but does not store run ID, due timestamp, attempt or API receipt on individual messages. The UI never substitutes a nearby run, current enrollment step, or current next_send_at. Runtime behavior is unchanged.

Duplicate cause remains **UNKNOWN**. The inspected 20:10 messages (89 and 90) are retention sends on Sep 8 and Sep 9 respectively, with different daily guard dates. No retained outbound row matches 11:19–11:23 JST. This does not explain the reported 11:21/20:10 pair. Exact date/original receipt and per-message execution/attempt evidence are missing.

The optional label is **Duplicate candidate**, never confirmed duplicate. The RPC requires matching contact, full body, transport/reason within 15 minutes, plus an exact validated enrollment/sequence/step or retention guard tuple. Missing IDs cannot be matched using body/time alone.

## Verification and collisions

`npm test` adds evidence mapping/legacy/malformed field tests to existing security regression. `npm run test:preview` retains existing route/auth/CSRF checks and adds an authenticated Worker smoke with a local-only RPC fixture and synthetic signed session. It checks outbound-only collapsed details, old messages, escaped long text, empty state and sanitized RPC failure/malformed response. No real credentials or production requests are used. Local preview accepts explicit synthetic bindings; environment allowlisting remains in place.

Current open PR review: #76 changes deploy workflow only; #74 changes auth/config; #44 and #66 include Calendar/Distribution plus changes to `scripts/local-preview.mjs` and `scripts/smoke-preview.mjs`. The two preview helper hunks here must be preserved when those branches are integrated later. No open PR was merged, rebased, retargeted or imported. No Dashboard layout/navigation files changed. The Issue's historical #55 NO-GO section is stale; #55 is done, and current master already includes #73.

## Release boundary

Prepared only: no production migration, merge, deploy, secret or message send. Review both scoped PRs. Production authorization must precede applying only the additive RPC migration and deploying this UI. Do not replay Calendar or owner-registration migrations. After approved rollout, the remaining device check is to open the existing authenticated production `/dashboard/lian` on iPhone, expand an outbound Why Sent, and verify evidence/readability with no horizontal overflow. This is not a request to send a test message.

Rollback UI independently to the accepted prior deployment. Backend rollback restores only the original snapshot function body/grants, without touching data/owner registration. Keep Issue #68 open for the unknown historical cause and the final production/device receipt.
