# C109｜Conversation → ACE Asset Pipeline

Updated: 2026-09-21

## Purpose

Turn valuable conversations into reusable canonical knowledge, learning materials, visuals, quests, and ACE Shelf assets without preserving raw chat as the canonical product.

## Canonical flow

`Conversation → Core Extraction → Drive canonical source → CONTENT_OS → ACE Material Factory → Draft → Visual Builder → Human Gate → ACE_ASSET_INBOX → ACE Asset Pipeline → ACE Base Camp / Knowledge Shelf → Quest / Reflection / Evidence → Canonical update`

## Chat intake

MASA should not need to fill long forms. Operational trigger phrases include:

- 資産化
- ACE化
- 本棚へ
- 教材にして
- 図解まで

On an explicit trigger, the working agent should prefer:

1. detect an existing canonical asset and update it when appropriate;
2. otherwise create a reusable Drive canonical source;
3. register or update CONTENT_OS;
4. prepare Visual Brief / derivative candidates;
5. queue into existing material / ACE asset flows rather than creating a parallel library.

## Canonical source contract

Do not use the raw transcript as the canonical asset. Extract:

- Purpose / why it matters
- Core thesis
- Key principles
- MASA first-party experience or interpretation
- Fact / Experience / Interpretation / Hypothesis boundary
- examples and cases
- Visual Brief
- derivative asset candidates
- Quest / Reflection candidates
- evidence or verification requirements
- provenance

## Visual Builder

The operator UI should be image-first and natural-language-first.

Primary route: `/dashboard/visual-prompt`

MVP interaction:

1. say what to make in natural language;
2. choose or auto-recommend one of the existing 20 visual structures;
3. optionally choose purpose and ratio;
4. generate a complete portable visual prompt;
5. send to ChatGPT image generation, Gemini, Canva, Figma, or another renderer.

The 20 visual structure thumbnails remain the visible selection layer. Their structure metadata remains the generation layer.

## Human gate

Automate preparation, not public publication.

Safe to automate:

- core extraction
- canonical draft
- CONTENT_OS registration
- material draft
- Visual Brief
- theme suggestion
- ACE draft registration

Keep explicit review for:

- MASA-specific intent / lived experience
- health, science, history, social or other factual claims requiring verification
- rights / attribution boundaries
- final naming
- ACE `live` publication

## Existing systems reused

- C089 Knowledge Shelf
- `docs/ace-asset-pipeline-20260916.md`
- `scripts/apps-script/ace-material-factory.gs`
- `ACE_MATERIAL_DRAFTS`
- `ACE_ASSET_INBOX`
- `/dashboard/ace-assets`
- `/dashboard/visual-prompt`
- `/dashboard/visual-structures`
- `src/data/visualStructureTemplates.ts`
- CONTENT_OS

Do not create a second membership system or duplicate ACE catalog.

## Current implementation

C109 Drive canonical source:

`https://docs.google.com/document/d/14YNs-i12AglPejN2aWNRzVUIPiQCYRR07cUrYHoH7Kk/edit`

CONTENT_OS:

- Asset ID: `C109`
- Status: `CANONICALIZED / BUILD_V0.1 / E2E_QUEUE`

Visual Builder branch implementation replaces the old form-heavy `/dashboard/visual-prompt` interaction with:

- one natural-language request field;
- purpose / ratio quick selectors;
- the existing 20 structure thumbnails;
- lightweight automatic template recommendation;
- portable prompt generation;
- local state persistence.

## Next E2E test

Use C109 itself as Case 01:

`C109 canonical source → Material Factory → ACE_MATERIAL_DRAFTS → MASA Human Gate → ACE_ASSET_INBOX → ACE draft registration → Theme classification → Shelf readback`

Only after this works should automatic Slide / PDF / infographic rendering and direct Drive-save be added.
