# FLOW Knowledge OS — Architecture Boundary

## Purpose

FLOW Knowledge OS is the human-facing cognitive cockpit for MASA OS.

It unifies the best interaction patterns from Reader / Readwise, Logseq, Obsidian, Raindrop and source-grounded AI without making any of those products a new system of record.

The product flow is:

`Capture → Read → Think → Connect → Review → Promote → Publish`

## Source of truth

Existing ownership remains intact:

- **Google Drive / MASA_OS** — human-readable canonical business and project assets
- **Supabase** — integrated read/query model, structured entities, state and relations
- **GitHub** — code, rules, Skills, orchestration and automation
- **ChatGPT / Codex** — AI execution, extraction, transformation and reasoning
- **FLOW Knowledge OS** — daily interface for attention, thinking and knowledge growth

Do not create a second independent Task / Project / Canonical truth inside the cockpit.

## What we absorb

### From Logseq

- block-first thinking
- backlinks
- graph relationships
- whiteboard / spatial thinking
- thoughts can grow independently from pages

### From Obsidian

- durable portable text
- link-first navigation
- local/export-friendly thinking
- extensibility without vendor lock-in

### From Readwise / Reader

- distraction-free reading
- highlights as addressable knowledge
- resurfacing and spaced review
- source preservation

### From Raindrop

- very low-friction capture
- inbox-first triage

### From NotebookLM-style research

- source-grounded cross-document exploration
- every synthesis can return to provenance

## Derived Cognitive Map

The graph is not manually curated truth.

Preferred flow:

`Chat / Raindrop / Drive / YouTube / Research / Notes`
`→ AI Knowledge Extraction`
`→ Drive / Supabase`
`→ Knowledge Units + Relations`
`→ FLOW Knowledge OS`
`→ Graph / Whiteboard / Review / Publish views`

Graph and Whiteboard are projections of the Knowledge Unit network.

The user should not spend time keeping the map tidy.

## Knowledge lifecycle

Every useful fragment can grow through:

`Seed → Insight → Definition → Canonical → Quest / Content / Product`

A source item and a MASA interpretation are different objects and should remain distinguishable.

Canonical promotion means higher reuse value, not merely moving a file into another folder.

## UX invariant

MASA should be able to:

1. capture a thought without deciding where it belongs;
2. read an external source without leaving the cockpit;
3. highlight one sentence and attach interpretation;
4. see older related thinking automatically;
5. promote a useful idea into canonical knowledge;
6. turn the same asset into a Quest or output draft;
7. trace every factual claim back to provenance.

If this requires manually synchronizing multiple note apps, the design is wrong.

## Current MVP boundary

The first implementation intentionally contains:

- Today attention view
- Universal Capture
- Reader
- Highlight capture
- Context / backlinks rail
- AI-action hooks
- Review
- Canonical promotion
- Publish candidate view
- command palette
- responsive mobile navigation

The initial interaction state uses local browser storage only as a prototype mechanism. It is not canonical storage.

Next data step: expose `KnowledgeCockpitSnapshot` from the Supabase read/query layer and replace prototype state incrementally.
