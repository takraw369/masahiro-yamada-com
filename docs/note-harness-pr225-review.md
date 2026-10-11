# PR #225 review / resume checkpoint — 2026-10-06

Goal: safely close Chat/Drive → draft → Human publish → note URL/metrics → stored CTA → existing learning/purchase loop. Review started from `71755065673280dcd5c56c161acaca3c1220e6f9` on `feat/note-harness-tracked-links`. No merge, production deploy, production migration or note publication is authorized by this review.

## A. Findings

- Anonymous `resolve_tracked_link_v1` calls could inject click receipts/KPIs and arbitrary receipt strings directly, bypassing the Worker classifier.
- Preview/prefetch headers and HEAD were not excluded. Unknown UA was counted as human in receipt reporting, funnel events and publication rollup.
- `bigint` metrics were cast to existing `integer` publication fields without bounds. Engagement sums could overflow both integer and bigint. Integer click saturation could make an otherwise valid redirect fail.
- Stored campaign references allowed 160 characters, while Knowledge Journey and consent registration retain 120. Existing destination UTM could also select a campaign different from the tracked link's campaign.
- Dashboard fetched existing links but never rendered them; existing-link edit/pause/archive was not discoverable. Successful publication registration left the selectable publication list stale.
- Shared campaign outcomes were summed once per link, overstating consent, LINE and revenue totals. Paid reporting included unconsented contacts if their source_campaign matched.
- Dashboard exposed raw upstream error text in its failure UI.
- The dependency security gate detected high-severity `source-map-js` 1.2.1 advisory GHSA-68fv-2mgg-jv7q, with a patched 1.2.2 available.

## B. Minimal corrections

- Added the established server-derived owner capability to the resolver; removed its old four-argument overload. Public routing still resolves only stored ACTIVE slugs. No query parameter is used as a destination or attribution value.
- Preview/prefetch/HEAD and known automation clients become diagnostic bot receipts; unknown is excluded from human counters. Worker-generated random receipt IDs replace request-supplied identifiers. Referrer query/hash are stripped; raw IP and raw UA are not persisted.
- Validate complete HTTPS destination URLs and reject embedded credentials. External destinations receive no additional UTM. Canonical owned HTTPS origins receive the stored source/campaign, replacing inconsistent destination UTMs; alternate ports are treated as external.
- Enforce integer bounds before metric writes/casts, use numeric arithmetic for engagement sums, and saturate the existing publication click integer at 2,147,483,647. Exact receipt counts remain bigint. Publication retries are serialized by published URL.
- Keep campaign references at 120 characters in API and SQL; supply `nh-<slug>` in the owner upsert when omitted.
- Render stored links and prefill existing metadata for editing/status changes; refresh lists after successful saves. Deduplicate top-level non-click totals by campaign and disclose repeated campaign-level outcomes in link rows.
- Require consent for assisted purchase reporting. UI describes LINE as subsequent channel events, not confirmed friend-add, and source_campaign revenue as first-touch assisted rather than direct conversion.
- Hide upstream error payloads from the unavailable UI. Failed loads expose no forms or synthetic zero KPIs.
- Add exactly one shared CREATE navigation item for `/dashboard/note-harness`; no layout rewrite.
- Pin only `source-map-js` to 1.2.2 and update its lockfile entry. The existing time-bounded upstream audit exception is unchanged.

## C. Verification

- `npm test`: **225 pass, 0 fail**, including executable route/API regression cases (21 Note Harness cases).
- `npm run build`: PASS; production Worker artifact config verification passed.
- `npm run security:check`: PASS. The pre-existing `http-cache-semantics` exception expires 2026-10-31; this is not a claim of zero advisories.
- `npm run typecheck`: FAIL, **204 existing errors**. The same 204 errors were observed before these corrections; no changed source file has a diagnostic. Do not describe full typecheck as green.
- Isolated `npm run test:preview`: PASS, with synthetic credentials and localhost RPC fixtures. Observed authenticated dashboard rendering; create/pause/archive; note URL registration; metrics writes/bounds; query redirect rejection; owned/external UTM behavior; preview/HEAD classification; shared-campaign totals; and missing-RPC fail-closed responses. Existing public/auth/LINE smoke also passed.
- Read-only live catalog review: `sunlovesflow-core` (`qydbtholbwbuwiswmqsr`), PostgreSQL 17.6; columns, types, defaults, constraints, function signatures/definitions, existing triggers, migration history and public/private schema CREATE privileges inspected. The three Note Harness migrations were **not applied**. No production row data was read or changed.
- Disposable in-memory PGlite/PostgreSQL verification against catalog-derived columns/defaults/check constraints: all three migrations ran in dependency order and were replayed twice. Ten behavior checks passed: unauthorized resolver denial, partial-index receipt deduplication, human/bot/unknown rollup, pause/archive fail-closed, native snapshots/publication/learning-summary bridge, integer and bigint boundaries, click ceiling, consented temporal assisted outcomes, and RLS/GRANT/owner enforcement. Six checks failed on the original PR and passed after corrections.
- This SQL fixture omits unrelated production foreign keys/triggers; relevant live funnel triggers were inspected and do not award growth for `tracked_link_click`. It does not substitute for a Supabase staging/PostgREST integration check.
- Gitleaks 8.30.1 scans and GitHub CI receipts: see final PR HEAD checks. Redacted tracked-change/history scans are required before push; local ignored fixture artifacts are not PR content.

## D. Remaining risks / UNVERIFIED

- Full-repository type debt remains (204 errors).
- Bot/human classification is heuristic. Spoofed browser UA cannot be proven human; UI discloses this. External LINE clicks cannot prove friend addition or carry extra UTM.
- Outcomes are persisted first-touch campaign assistance, not click-to-purchase causality. Multiple links sharing a campaign cannot receive unique CTA-level credit for those outcomes.
- Top dashboard totals cover retrieved links (maximum 200), not an unbounded lifetime census. Publication integer clicks saturate only at their schema ceiling; raw receipt counts remain exact.
- Production migration, live PostgREST schema reload/integration, real note dashboard values, and real consent/LINE/purchase end-to-end receipts remain **UNVERIFIED**. No real publication or purchase was performed.
- `http-cache-semantics` remains under the repository's existing narrow exception; reassess before 2026-10-31.

## E. Human Gate / next smallest verifiable action

1. Review the final PR HEAD and green required CI checks; full typecheck debt must remain disclosed.
2. In an approved isolated Supabase staging environment matching current core, apply in order: `20261005_note_harness_tracked_links.sql` → `20261005_zz_note_harness_learning_bridge.sql` → `20261005_zzz_note_harness_attribution_summary.sql`. Read back the five-argument resolver signature, owner gate, function execution grants, private table RLS and partial unique index; refresh/verify PostgREST schema cache.
3. With explicit production approval, apply those migrations to core before releasing this runtime. Confirm the existing DASHBOARD_PASSWORD derives a key already present in the owner registry; missing/incorrect capability fails closed. Keep migration/deployment/merge as separate human-approved operations.
4. Use an existing content asset/draft. Register the URL after a human publishes note; connect each saved CTA to its publication and verify ACTIVE redirect, PAUSED/ARCHIVED denial, and copy the `/go/<slug>` URL into the human-reviewed note.
5. Enter actual note dashboard signal snapshots and read back `content_metric_snapshots`, `content_publications`, and `content_learning_summary`. Verify one approved consented Journey, then subsequent real LINE event / existing paid purchase receipts where available. Treat missing outcomes as unverified, never manufacture conversion evidence.

Resume order: repository and final remote PR HEAD → live core catalog/migration state → this checkpoint → staging RPC read-back. Local disposable SQL harness/catalog/results were kept under ignored `work/pr225-review`; reconstruct from fresh metadata if unavailable.
