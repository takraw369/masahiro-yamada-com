# Knowledge Flow — Phase 1

## Experience

`/dashboard/knowledge` is MASA's information triage workspace. It replaces the
route's previous duplicate FLOW MIND view; the existing live reader/capture tools
remain at `/mind`. Dashboard's THINK navigation links to the new workspace.

The initial question is “今日、何につなげよう。” Today counts lead to real filters;
Recently Connected is ordered by connection time; Continue resumes developing or
ready items. Inbox contains `inbox` and `review`; all other states appear in Library.

Compact rows reveal source URL/domain, source type, a thumbnail or deliberate
local fallback, summary, tags, projects, status, score, saved date and next action.
Flow renders a separate ordered Source → Theme → Project → Output path per item.
Missing links are editable steps. Multiple projects remain on the same path.
There is no free-node graph and no chat dependency.

A URL capture saves immediately, then opens a focused editor. Classification is
optional. The editor changes meaning, theme, multiple projects, tags, score,
status, output intent and next action. `connected`, `developing`, and `ready`
require a project; `ready` also requires output intent. These are workflow states,
not evidence that content was published. No Publish or Canonicalize action writes
externally in Phase 1.

Desktop has a workspace sidebar, compact list, and contextual rail. On iPhone the
bottom navigation exposes Inbox / Library / Flow / 保存; Flow paths stack vertically.
Native modal dialogs provide focus containment, Escape and focus restoration.
Inputs on mobile are 16px to avoid focus zoom, with safe-area bottom spacing and
reduced-motion support. The new route has its own styles: the mission explicitly
prioritizes a new functional visual language over the old ACE marketing design.
No runtime dependencies were added, and public layouts/styles are untouched.

## Run / review

Use Node 22.19+ (the locked undici dependency requires it), or Node 24:

```sh
npm ci
npm test
npm run typecheck
npm run build
npm run test:preview
npm run security:check
```

`npm run preview` is intentionally unauthenticated and redirects to login. For
an isolated authenticated prototype, run:

```sh
npm run preview:knowledge
```

Open the localhost URL printed by the script, use the **synthetic local-only**
password `knowledge-flow-local-demo`, then visit `/dashboard/knowledge`.
The helper uses the existing isolated preview config and binds only localhost.
It supplies no live storage, harness or production credentials. No application
code bypasses authentication. Stop with Ctrl+C. Do not deploy the preview helper.

## Data and persistence

- `src/lib/knowledge-flow/model.ts`: joined UI read model, capture validation,
  composable keyword/project/status/attention query.
- `fixtures.ts`: nine editorial examples across ACE, SLF, YAKUZEN. Summaries and
  scores are invented UI examples, not extracted facts or actual private records.
  Thumbnails are local CSS fallbacks; provided image URLs are supported with an
  error fallback. No third-party image requests for fixture data.
- `repository.ts`: asynchronous `KnowledgeRepository` (`load`, `save`) boundary.
- `src/components/knowledge-flow/KnowledgeFlow.tsx`: workspace composition.
  `KnowledgeCard.tsx`, `KnowledgeDialogs.tsx`, `KnowledgePrimitives.tsx` and
  `FlowView.tsx` hold reusable presentation and editing components.

Local key: `masa:knowledge-flow:demo:v1`. First load uses fixtures; first successful
edit persists a versioned snapshot. Reopening in the same origin/browser restores
edits. Other origins/dev ports/devices do not share data. JSON export includes the
whole snapshot for recovery; import is not implemented. Storage reads validate
structure, dates, references, protocols and score range. Corrupt or incompatible
records are never silently reset. Failed writes do not update UI state. Revision
checks detect stale tab edits immediately before synchronous write (localStorage
is not a cross-tab transactional database; simultaneous write races still require
server concurrency control in Phase 2).

Duplicate capture compares normalized HTTP(S) URLs, ignoring fragments. Query
parameters are preserved because they can identify different sources; tracking
parameter equivalence is deferred. Duplicates open the existing item. New captures
have no guessed summary, thumbnail or asset score. Source type uses hostname/path
heuristics only. Keyword search is AND token matching across titles, URLs,
summaries, tags, themes, project names, output and next action. Saved filter buttons
implement unconnected and high-value items untouched for six calendar months;
this is not semantic/natural-language search. High value means manual score ≥80.

## Data model proposal / integration mapping

This is a **logical model**, not an applied SQL migration. Inspect live schema and
existing Flow Mind RPCs before deciding physical table names. Never introduce a
second canonical project or knowledge store.

| Logical entity | Fields / constraints | Integration purpose |
| --- | --- | --- |
| knowledge_items | UUID id, owner reference, url, normalized_url, title, source_type, thumbnail_url nullable, raw_content nullable, summary, status, asset_score nullable integer 0–100, next_action, created_at, updated_at, revision | Source + personal interpretation, map existing source/KnowledgeUnit IDs |
| tags | UUID id, owner reference, name; unique owner + name | Existing taxonomy if available |
| projects | Existing project id/reference, owner, name, description | Read existing project truth; fixture strings are not production IDs |
| themes | UUID id, owner, name | Explicit thematic layer separate from tags |
| knowledge_item_tags | owner, item_id, tag_id; unique tuple | Many-to-many tags |
| knowledge_item_projects | owner, item_id, project_id, connected_at; unique tuple | Many-to-many project links, preserve each connection time |
| knowledge_item_themes | owner, item_id, theme_id | MVP one primary theme; extend to multiple deliberately |
| outputs | UUID id, owner, title, state, external_ref nullable, canonical_ref nullable | Actual drafts/outputs later; MVP `output` is only text intent |
| connections | UUID id, owner, from_unit_id, to_unit_id, relation_type, reason, explicit, created_at | Reuse `KnowledgeRelation` supports / derived_from / used_by semantics |

Index owner + status + created_at, owner + updated_at, and all link foreign keys.
Unique owner + normalized_url provides idempotent intake. Owner-scoped foreign
keys must prevent cross-owner project/tag/output relations. Snapshot arrays are a
joined read model: normalize links in storage rather than copying project truth.
UI states describe triage; do not conflate them with `KnowledgeUnit.lifecycle`
(seed, insight, definition, canonical, quest, content, product).

### Supabase connection points

1. Inspect live canonical schema and existing `/api/dashboard/knowledge` contract.
   Current route delegates to `masa_flow_mind_*_v1` RPCs and rejects URL-only
   captures with `source_intake_required`. Preserve those clients. Add a reviewed
   source-intake contract rather than sending URLs to the existing text endpoint.
2. Replace the local repository with an HTTP adapter to authenticated Dashboard
   endpoints. UI components should not own credentials, owner IDs or DB clients.
   Move filtering/pagination server-side using `KnowledgeQuery`; a future query
   service can combine lexical retrieval with embeddings without changing cards.
3. Resolve the owner server-side through `getDashboardOwnerKey` / existing signed
   session. The current Dashboard session is not itself a Supabase Auth JWT;
   don't invent `auth.uid()` policies that do not match this auth model.
4. Reuse the established approved RPC/data access pattern, least privilege,
   explicit grants and owner-scoped RLS on all exposed relations. Do not expose a
   secret/service-role key in client code. Include negative cross-owner tests.
5. Use atomic transactions for item + link edits and revision/ETag checks for
   conflicts. No fallback writes to local demo or D1 on remote failure. Migration
   must explicitly map fixture IDs / import records and must be user-selected.
6. Drive / MASA_OS remains the human-readable canonical source. Canonicalization
   records a verified Drive reference and provenance, not another independent copy.

Security reference reviewed during design: [Supabase Data API security](https://supabase.com/docs/guides/api/securing-your-api).
No Supabase package, query, schema mutation, or permission change occurs here.

## Isolation / SEO

Existing middleware already requires a signed Dashboard session, rejects
cross-origin mutations, and applies private no-store headers. The route adds
`noindex,nofollow,noarchive` as both meta and `X-Robots-Tag`. It is on-demand and
uses no public content collections. The repository has no sitemap generator/file;
this implementation adds neither a sitemap entry nor a public-site link. If a
sitemap is added later, explicitly exclude `/dashboard/**` and `/mind`.

No production secret or private knowledge is in fixture assets. The fixture JS
bundle is public static code containing only demo examples. Actual saved values
remain in this browser's localStorage, are not sent to the server, and are not
removed by Dashboard logout. Therefore Phase 1 is for demo records on a trusted
personal browser; it is not secure cross-device private knowledge storage.

## Phase 2 / recommended order

1. **Persistence first:** verify live schema, map existing projects, implement
   owner-scoped intake/read/update endpoints and transactional revisions; add
   authenticated multi-user isolation tests and explicit demo import/export.
2. **Reliable capture:** metadata fetching in server jobs with SSRF defenses,
   redirect checks, size/time limits, provenance and idempotency. Add iOS Share
   Sheet and Raindrop import after this source-intake contract is stable.
3. **Background understanding:** X/YouTube ingestion where permitted, transcript
   extraction, summaries and proposed tags/projects with source evidence. Show
   pending/failed jobs, distinguish AI suggestions from user-confirmed links.
4. **Discovery:** embeddings, semantic search, duplicate candidates and resurfacing
   based on usefulness/last reviewed time. Retain explicit filters and lexical
   search; do not turn navigation into a chat prompt.
5. **Develop → Publish → Canonicalize:** real draft entities, destination adapters,
   explicit review before publication, actual output receipts, and Drive canonical
   references. Add item-level provenance back to original sources.

## Verification receipt — 2026-09-15

- Node 24.19.0; production build + Worker artifact verification passed.
- 76 Node tests passed, including new URL/query/persistence/conflict/corruption tests.
- Release typecheck: zero changed source files with errors. Full-repository
  Astro check reports 363 existing errors, chiefly unrelated dashboard pages.
- Worker smoke passed: public home/contact/FAQ/Tips/library/gate/login, anonymous
  private redirects/API denials, authenticated Knowledge Flow, no-store/noindex.
  One concurrent checker run exhausted the existing short readiness window;
  a clean sequential rerun passed. No timeout was hidden or relaxed.
- Chrome desktop 1440px and iPhone 13 emulation 390px: capture, edit tags/meaning/
  theme/project/score/output, move to Library, Flow projection, reload persistence,
  keyword search, duplicate URL reopening, Escape and mobile capture passed.
  No browser JS errors. 320px Flow overflow check also passed.
- axe-core 4.10.3 WCAG 2 A/AA + 2.1 AA: zero violations in desktop Inbox/editor/
  Flow and mobile Flow/capture after contrast fixes. Automated checks do not
  replace physical iPhone Safari / VoiceOver testing, which remains UNVERIFIED.
- `npm run security:check`: zero vulnerabilities. `git diff --check`: passed.
- Draft PR: [#92](https://github.com/takraw369/masahiro-yamada-com/pull/92).
  GitHub CI test/build + secret scan passed on implementation commit `13b8260`.
  Final documentation/mobile polish checks can be read on the PR.
- No production deployment, Supabase migration, or live knowledge write performed.

Local-only visual artifacts and browser checks are in `work/knowledge-flow/`
(ignored by Git); they contain synthetic data only. They are supplementary evidence,
not required runtime assets or a remote handoff dependency.
