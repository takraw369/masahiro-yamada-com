# NotebookLM Knowledge Harvest P0 — sanitized resume checkpoint

## Goal and acceptance

Recover actual NotebookLM knowledge through authorized exports, preserve provenance and fact/claim/interpretation boundaries, reuse the existing MASA Knowledge Layer, and provide a repeatable importer with duplicate/difference planning, no-write dry-run and tests. No new database or Dashboard. Originals are immutable; private content and credentials stay outside Git; no merge or production deploy.

## Source of truth and current state

Implementation base: master at `9fc4a23a252eef8365b6c3c8b0b34e2be33973b7` in `takraw369/masahiro-yamada-com`. Follow fresh repository/remote/runtime state before this checkpoint. Existing architecture is documented in `docs/flow-knowledge-os-architecture.md`. `/dashboard/knowledge` is the existing interface; its owner RPC and API contract are reused as candidate previews only.

Related work inspected: merged #205 and #307; open #313 (depends on masa-automation #232) and #92. Unmerged UI prototypes were not used as source of truth. Current source_intake_v1 in masa-automation takes Raindrop IDs and is not a text import API.

## Completed

- Normal authenticated NotebookLM access observed; no cookies or unofficial session APIs used.
- Existing local exporter format and Drive Canon read. Local inventory contained 422 notebook manifests; this is inventory, not 422 completed harvests.
- Bounded pilot: 3 notebooks, 5 source documents, 5 structured candidates, 15 exact-quote-grounded statements, 11 relation proposals. Original files total 60,049 bytes; SHA-256 before/after unchanged. Actual source content, annotations and live read snapshots are private local artifacts outside this repository.
- Real source dry-run and private JSON/Markdown output/readback verified. Immediate reimport: 5 unchanged. One annotation change: 1 update and 4 unchanged. No live writes or canonical promotion.
- A real authorized Google Docs readable export was also tested independently; it is an already-existing Canon, not another harvested notebook or new canonical asset.
- Existing Knowledge IDs were observed for relation proposals. RLS flags/policies and capture function definition were read. RLS enabled and an owner guard exist; this is not a full negative authorization test. Exact URL lookups for the 5 sources returned no matches in sources/fabric nodes; semantic/Drive-wide duplicate review remains open.

## Verification

- 26 focused importer tests PASS (including real CLI dry-run/local output, source fidelity, export-time/scan-time separation, updates, provenance, partial-batch resume and conflict holds).
- Production build and Worker artifact configuration PASS.
- Release-delta typecheck PASS: 0 changed-file errors; 214 existing repository Astro errors remain.
- Production dependency security gate PASS with the repository's existing upstream exception (no dependency changes).
- Current local full repository run: 551/552 PASS; one existing browser test failed because this host's Chromium wrapper was broken / installed Chrome failed on teardown. All remaining cases pass. GitHub CI at the initial implementation commit `6075e8a` passed all 551 tests, including the actual browser test, plus build/preview/security checks. The additional export timestamp regression makes the suite 552 tests; consult the PR for current-head CI. Browser regression remains UNVERIFIED on this Mac; no application/UI code changed.

## Open work and Human Gate

1. Inspect private candidate packet with MASA; choose existing canonical UPDATE/MERGE/LINK targets, check rights and semantic duplicates.
2. Verify live owner RPC authorization including negative cases and current RLS/grants before any database write.
3. Approve the concrete canonical change through the existing owner flow; read back IDs, links and content. Source records and graph relations are not created by capture previews.
4. The 3 selected notebook Studio panes showed empty saved-output states during authorized read-only inspection. Saved notes/reports recovered: 0. Other notebooks and remaining source bodies are separate work. Do not infer that a source-only export captured Studio outputs.

Smallest next verifiable action: rerun the focused tests, then reimport the same private selection with its previous receipt and confirm unchanged counts before reviewing one canonical destination. Private workspace resume packet contains exact local paths/IDs; it must not be uploaded to a public repository. Importer documentation: `docs/notebooklm-knowledge-harvest.md`.
