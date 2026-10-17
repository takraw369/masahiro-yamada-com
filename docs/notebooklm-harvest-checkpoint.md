# NotebookLM Knowledge Harvest P0 — sanitized resume checkpoint

## Goal and acceptance

Recover actual NotebookLM knowledge through authorized exports, preserve provenance and fact/claim/interpretation boundaries, reuse the existing MASA Knowledge Layer, and provide a repeatable importer with duplicate/difference planning, no-write dry-run and tests. No new database or Dashboard. Originals are immutable; private content and credentials stay outside Git; no merge or production deploy.

## Source of truth and current state

Implementation base: master at `9fc4a23a252eef8365b6c3c8b0b34e2be33973b7` in `takraw369/masahiro-yamada-com`. Follow fresh repository/remote/runtime state before this checkpoint. Existing architecture is documented in `docs/flow-knowledge-os-architecture.md`. `/dashboard/knowledge` is the existing interface; its owner RPC and API contract are reused as candidate previews only.

Continuation: Draft PR [#375](https://github.com/takraw369/masahiro-yamada-com/pull/375), branch `codex/notebooklm-knowledge-harvest-p0`. Fresh master observed at `0a3d1392f5e10a0da700a331704207c46d4406fa`; the Knowledge API and architecture document were unchanged. Latest CI result must be read from the PR for its current head.

Related work inspected: merged #205 and #307; open #313 (depends on masa-automation #232) and #92. Unmerged UI prototypes were not used as source of truth. Current source_intake_v1 in masa-automation takes Raindrop IDs and is not a text import API.

## Completed

- Normal authenticated NotebookLM access observed; no cookies or unofficial session APIs used.
- Existing local exporter format and Drive Canon read. Local inventory contained 422 notebook manifests; this is inventory, not 422 completed harvests.
- Bounded cumulative harvest: 3 notebooks, 12 source documents, 12 structured candidates, 36 exact-quote-grounded statements, 25 relation proposals and 36 reuse proposals. Initial pilot was 5 documents; continuation added 7. Original files total 160,905 bytes; SHA-256 before/after unchanged. Actual source content, annotations and live read snapshots are private local artifacts outside this repository.
- Real source dry-run and private JSON/Markdown output/readback verified. Continuation delta: 7 create, 5 unchanged, 0 update/conflict. Immediate reimport and annotation-free resume: 12 unchanged. A coverage-only annotation change: 1 update and 11 unchanged. No live writes or canonical promotion.
- A real authorized Google Docs readable export was also tested independently; it is an already-existing Canon, not another harvested notebook or new canonical asset.
- Existing Knowledge IDs were observed for relation proposals. RLS flags/policies and capture function definition were read. RLS enabled and an owner guard exist; this is not a full negative authorization test. Exact URL lookups for the 5 sources returned no matches in sources/fabric nodes; semantic/Drive-wide duplicate review remains open.
- Bounded semantic review inspected and re-read 3 existing target texts. The 12 candidates have concrete LINK 4 / MERGE 4 / REFERENCE 4 proposals, grounded in target quotes and hashes. New capture previews are suppressed for all 12. No target was modified. Other canonical assets were not exhaustively searched.
- Real exports exposed an article boundary before unseen paid content. Explicit partial-export and selected-passage coverage is now preserved, rendered, diffed and retained on resume. Coverage: 10 exported-text-only, 1 partial export, 1 selective reading. Original completeness remains unverified. Same-book reviews carry dependency relations and are not independent empirical corroboration.
- Concrete private additions consolidate overlapping proposals into two existing-owner worksheets: organization/individual purpose with unagreed points retained; repetition count versus observation of progress. These are unverified proposals, not MASA's demonstrated results.

## Verification

- 33 focused importer tests PASS, including partial coverage, exact boundary evidence, coverage-only differences and annotation-free/partial-batch resume.
- Real data checks verify 36 source evidence spans, 12 target evidence spans/hashes, 12 unchanged originals, unchanged reimport, coverage-only difference, private packet readback and dry-run without output creation.
- Prior verified head `21cfcf5`: CI run `38995748009` passed all 555 tests including the actual browser regression, production build, Worker configuration, isolated preview, release delta, dependency security and secret scan. Changed-file type errors 0; existing Astro errors 214. Continuation adds 4 tests; consult the PR for current-head CI.
- The existing local Mac browser runtime fails separately; Linux CI is the browser verification receipt. No application/UI code or dependencies changed.

## Open work and Human Gate

1. Review the concrete two-worksheet additions and 12-candidate packet with MASA; confirm existing canonical UPDATE/MERGE/LINK targets, rights and semantic duplicates. Targets have observed text evidence; this does not authorize a write.
2. Verify live owner RPC authorization including negative cases and current RLS/grants before any database write.
3. Approve the concrete canonical change through the existing owner flow; read back IDs, links and content. Source records and graph relations are not created by capture previews.
4. The 3 selected notebook Studio panes showed empty saved-output states during authorized read-only inspection. Saved notes/reports recovered: 0. Of their 28 sources, 16 remain unprocessed. Other notebooks are separate work. Do not infer that a source-only export captured Studio outputs or that a partial export includes the original remainder.

Smallest next verifiable action: read current-head PR checks, then reimport the private cumulative selection with its latest receipt and confirm 12 unchanged before reviewing one concrete existing-owner addition. Private workspace resume packet contains exact local paths/IDs and the two complete proposed additions; it must not be uploaded to a public repository. Importer documentation: `docs/notebooklm-knowledge-harvest.md`.

## MASA OS 3 continuation — 2026-10-17

Fresh source/CI and private continuation-002 receipt re-read; all prior 12 candidates and original hashes verified. Added 4 selected-passage extractions from existing owner-authorized local exports: cumulative 3 notebooks / 16 source documents / 16 candidates, 52 grounded statements, 16 target evidence spans. 12 of the selected notebooks' 28 sources remain. New proposals: LINK 1 / MERGE 2 / REFERENCE 1; cumulative LINK 5 / MERGE 6 / REFERENCE 5. All candidate capture previews remain suppressed and live writes remain zero. New statements distinguish observed document text, author claims, extractor interpretations (not approved MASA interpretations), and testable hypotheses. Do not imply full-original reading, verified effects, personal experience or recovered Studio notes.

All 3 canonical Drive targets were re-fetched; normalized text unchanged. New concrete additions concern premise testing versus logical construction, self-authored status/help requests, and target/observed-change/support alignment; existing definitions stay canonical. Exact sources, quoted evidence, private worksheets and commands are in the existing private-harvest/continuation-003 packet, outside Git. Reimport and annotation-free resume: 16 unchanged; annotation-only change: 1 update/15 unchanged; partial batch: 1 present/15 retained. New 4 raw export hashes unchanged; previous 12 verification rerun.

Implementation now holds identical bodies under different URLs and rejects ambiguous previous candidate IDs/source aliases. Focused tests 36/36 PASS. Production build/config passed. Read latest exact-head CI before continuing.

Live read-only permission checks: RLS/policies/grants re-read on Knowledge tables; fabric nodes have RLS/no policies and no anon/authenticated direct privileges. In read-only transactions, anon saw zero nonpublic knowledge rows; authenticated role with empty JWT claims saw zero private/unpublished rows; invalid owner search RPC rejected with untrusted_owner. These are role simulations and one invalid-owner read, not full end-user JWT or write authorization tests. Actual owner/nonowner write denial/readback remains UNVERIFIED and behind Human Gate. No schema, permissions, authentication or production data changed.

KEEP: Drive Canon, existing Knowledge Layer and claim/evidence boundaries. REFINE: review the 4 concrete additions, rights and semantic overlap, then current target revision plus actual owner/nonowner authorization. DROP: duplicate captures, a parallel DB/dashboard and inferred source remainder. Human Gate: all live registration/canonical updates, production deploy, merge. Next smallest action: read exact-head CI, open private continuation-003/PROPOSED-CANONICAL-ADDITIONS.md, and review one concrete target addition with MASA before any write.
