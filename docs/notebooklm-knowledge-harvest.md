# NotebookLM Knowledge Harvest P0

Existing ownership: Drive / MASA_OS is canonical; Supabase is the integrated query/knowledge model; GitHub stores code and rules. This importer produces a **private intermediate review packet**, not a second database or Dashboard. Source exports are read only.

## Run

Use Node 22+; no packages, login or network are needed.

```sh
node scripts/notebooklm-harvest.mjs --input /private/export/index.json --source-id SOURCE_ID --dry-run
node scripts/notebooklm-harvest.mjs --input /private/export/index.json --source-id SOURCE_ID \
  --annotations /private/annotations.json --existing /private/existing.json --dry-run
# Parent directory must exist. Output is a NEW private directory, never alongside inputs.
node scripts/notebooklm-harvest.mjs --input /private/export/index.json --source-id SOURCE_ID \
  --annotations /private/annotations.json --write-local --out /private/review/batch-001
node scripts/notebooklm-harvest.mjs --input /private/export/index.json --source-id SOURCE_ID \
  --annotations /private/annotations.json --previous /private/review/batch-001/receipt.json --dry-run
node --test tests/notebooklm-harvest.test.mjs
```

Repeat `--input` and `--source-id` for a bounded batch. Without IDs, the entire specified manifest is read. Pass index.json explicitly; there is no recursive drive scan. Missing/failed/unavailable rows are counted separately and never become knowledge. A selected missing ID fails. Unsupported inputs fail closed.

Inputs: existing NotebookLM readonly exporter index.json + sources/notes Markdown; individual Markdown/text with optional `file.md.source.json`; Google Docs exported plain text with that metadata sidecar; readable Drive connector JSON `{title,content,id,url}`. The importer does not download Google Docs, extract cookies, or call unofficial NotebookLM APIs. Use the authorized Drive connector or the ordinary export UI to obtain readable text. HTML, PDF and binary DOCX require an explicit text export first.

Sidecar metadata uses `title, source_url, source_id, notebook_id, notebook_title, kind`. A URL or NotebookLM notebook/entity ID pair is required. NotebookLM index text is not the original binary. Notes/reports may be authored or AI generated and stay unverified.

## Structured annotations

Annotations are keyed by stable candidate ID, original source ID, or normalized source URL. They are editorial input, kept outside Git. The importer does **not** fabricate summaries or claim extraction.

```json
{
  "SOURCE_ID": {
    "summary": "The author proposes practising a task and then reflecting.",
    "principles": ["Connect practice to feedback."],
    "statements": [
      {"kind":"claim","text":"The author proposes feedback after practice.","quote":"Feedback follows practice."}
    ],
    "relations": [
      {"targetId":"OBSERVED_EXISTING_ID","title":"Education","relation":"applies_to","rationale":"A proposed learning design connection."}
    ],
    "reuse": [{"area":"education","idea":"One practice attempt followed by reflection."}],
    "openQuestions": ["Does the proposal transfer to this learner group?"]
  }
}
```

Every statement requires an exact quote from the preserved body. UTF-16 offsets and source hash are included. Allowed kinds: claim, hypothesis, interpretation, experience, fact. FACT is limited to `scope: document_observation`; it means the text was observed, never that an external claim is true. World facts require a separate verification workflow. Summaries/principles/relations/reuse remain unreviewed annotations/proposals. Raw source text is retained separately.

## Duplicates and differences

Canonical URL joins YouTube watch/short/live/share variants and Drive/Docs file variants. Original URLs, notebook/source IDs and all batch occurrences remain in the packet. Source-file export time and index scan time are separate; an already-local file is not relabelled as freshly exported. Same URL with different bodies is a conflict requiring review; both bodies are retained. URL-less notes use notebook + note IDs. Content hash ignores export wrapper timestamps. Revision hash also detects annotation/metadata changes.

`--previous` compares a previous transfer receipt: create/update/unchanged/conflict and changed fields. An absent source in a partial batch is never a deletion: it is carried in `deferredCandidates`, so a later partial reimport cannot create it again. Prior annotations are retained only when the body hash is unchanged. New provenance is added to existing occurrences; later URL enrichment preserves a previously seen notebook/source identity. Conflicts remain held across reimports until reviewed; P0 has no automatic conflict resolution. `--existing` accepts a local array `[{id,title,source_url}]` from a fresh authorized read; exact source URL matches propose LINK/MERGE. This is bounded snapshot matching, not proof that all existing canonical assets were checked. Semantic duplicates and canonical target choice require review. Local receipts do not mean a live import happened; applied/liveWrites remain zero.

## Existing integration boundary

Observed master API: `POST /api/dashboard/knowledge` accepts `{kind:"capture",text}`, up to 12,000 JS code units and 32,000 body bytes. The owner-guarded `masa_flow_mind_capture_v1` creates a **private draft self_note in masa_lens**, suitable for an explicitly labelled source-linked interpretation. It does not create an external source, knowledge_sources links, or graph relations.

Eligible new structured candidates contain a size-checked `integration.capturePreview` with this exact request shape. The tool never sends it. Repeated, updated, conflicting, unstructured or existing-matched records do not contain insert previews. Capture is insert-only; updates must use reviewed UPDATE/MERGE/LINK through the canonical owner, not another capture. Full structured data stays in the review packet; source relationships must later be materialized through existing authorized contracts.

`source_intake_v1` in masa-automation currently consumes Raindrop source IDs/inbox, not arbitrary NotebookLM text. No fictional text payload is emitted for that workflow. No new public API, schema, auth path or UI is introduced.

Next Human Gate: confirm rights and canonical target; review claims/interpretations and proposed relations; verify the current owner guard, grants/RLS and authenticated negative cases; then authorize the intended existing write path and read it back. Merely observing RLS enabled is not full permission validation. No live registration or canonical promotion is performed in P0.

## Privacy and verification

Dry-run is default and writes nothing, including receipts. Explicit `--write-local` writes JSON + Markdown into a new directory with mode 700/600. Outputs inside this repository are accepted only under ignored `work/`; symlink parents are resolved first. Manifest path traversal/symlink escapes and recognizable credentials are rejected. This is not a complete PII scanner: never commit source texts, annotations, snapshots or receipts. Git contains synthetic tests only.

Test coverage includes source fidelity, transcript-vs-fact distinction, duplicate provenance, content conflicts, metadata/annotation changes, skipped exports, partial-batch resume, capture contract limits, no repeat inserts, traversal/symlink rejection and no-write dry-run.
