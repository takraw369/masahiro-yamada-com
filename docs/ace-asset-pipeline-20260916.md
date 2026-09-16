# C089｜ACE Asset Pipeline

Updated: 2026-09-16

## Purpose

Turn MASA's completed learning outputs into reusable ACE learning assets without copying the private Knowledge OS into ACE.

Canonical flow:

`FLOW MIND / Research → create asset → Google Drive canonical file → ACE Asset Pipeline → auto-classify theme → Draft Human Gate → Live → ACE Base Camp → Quest / Reflection → Evidence → My ACE → next mountain`

## Ownership boundary

- **FLOW MIND / MASA Knowledge**: private thinking, source lineage, extraction, canonical promotion.
- **Google Drive**: canonical completed file for slides, PDFs, worksheets and other deliverables.
- **Supabase**: runtime asset index, theme mapping, entitlement state and delivery access.
- **ACE Base Camp**: user-facing discovery and learning surface.
- **CONTENT_OS C089**: business/product canonical parent for Knowledge Shelf and this pipeline.

Do not mirror MASA's full private corpus into ACE.

## Registration contract

Every ACE learning asset has:

- stable source reference for idempotency;
- title and short summary;
- one asset type: video / slide / guide / audio / worksheet / quest / reflection;
- canonical HTTPS asset URL;
- primary ACE theme / trailhead;
- draft / live / archived state;
- tags and provenance metadata.

If no theme is selected, the runtime classifies the asset from title + summary + tags. MASA can override the classification.

`source_system + source_ref` is unique. Re-registering the same source updates the existing asset instead of creating a duplicate.

## Human Gate

The publisher defaults to `draft`.

Automatic classification and registration are allowed, but public delivery is explicit: an asset becomes visible inside a trailhead only when its state is `live`.

This allows future creation tools to call the same publisher hook immediately after saving a completed file to Drive without turning every draft into user-facing material.

## Access / commerce

Foundation trailheads are included in ACE:

- FLOW Foundation
- BODY
- MIND

Optional trailheads use the existing platform entitlement layer:

- Food & Health
- Learning
- Relationships
- AI & Creation
- Athlete
- World Quest

No separate membership system is created. A future real offer should grant the corresponding `ace.theme.*` entitlement through the existing offer → purchase → entitlement flow.

Do not show a purchase CTA until the theme has real learning assets, an offer, entitlement mapping and tested delivery.

## Operator surface

Private dashboard:

`/dashboard/ace-assets`

Use it as the manual fallback and review surface. It accepts a Drive / YouTube / Canva / other canonical URL and registers it through the same runtime contract future automated producers should call.

FLOW MIND `/dashboard/knowledge` links directly to this publisher.

## Next automation boundary

Any generator that creates a finished learning asset should perform exactly two durable actions:

1. save/export the final artifact to its canonical Drive destination;
2. call the ACE Asset Pipeline registration hook with the stable Drive file ID/URL as source reference.

The creation tool does not need to know ACE catalog internals. Theme classification, idempotency and access are downstream responsibilities.
