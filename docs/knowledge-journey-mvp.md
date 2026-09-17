# Knowledge Journey MVP

## Purpose

Knowledge Journey answers an operational question that ordinary page analytics does not:

> Who is trying to learn what, how far have they gone, and where is the next useful intervention?

It is a learning-signal layer for MASA Knowledge Shelf, not a device-identification system and not a second CRM.

## Privacy boundary

The browser receives a random first-party pseudonymous `visitor_id` and a per-session `session_id`.

We intentionally do **not** construct an identity from device/browser characteristics. No font list, canvas/WebGL output, audio characteristics, screen dimensions, hardware concurrency, device memory, or user-agent combination is used to produce a fingerprint.

Anonymous events remain anonymous. If a visitor later voluntarily submits an email lead form with consent, the same first-party `visitor_id` can be linked to that Contact and recent anonymous Shelf events can be attached to the consented identity. This is identity stitching from a user-provided identifier, not fingerprinting.

## Stage model

| Stage | Signals |
| --- | --- |
| discover | Shelf view |
| explore | asset click / item view |
| engage | 30s active view / 50% scroll / CTA click |
| study | 120s active view / 90% scroll / video start |
| commit | lead submit / Quest start / Quest clear |
| checkout | checkout start |
| convert | purchase |

Stage is the deepest observed signal, not a claim about a person's internal motivation.

## Attention model

- `ACTIVE`: latest event within 24 hours.
- `COOLING`: latest event 24–72 hours ago and not converted.
- `DROP SIGNAL`: latest event more than 72 hours ago and not converted.
- `CONVERTED`: conversion-stage evidence exists.

`DROP SIGNAL` must never be presented as certain abandonment. It is a queueing signal for UX review, content improvement, or a user-permitted follow-up.

## Data path

```text
Knowledge Shelf
  -> /api/library/journey
  -> knowledge_journey_event_add_v1
  -> existing funnel_events

Email lead + consent
  -> /api/library/lead
  -> submit_library_lead_v2
  -> existing library_leads + contacts
  -> same visitor_id's recent events gain contact_id

Private Dashboard
  -> owner-key server-side RPC
  -> masa_knowledge_journey_snapshot_v1
  -> /dashboard/knowledge-journey
```

No new analytics SaaS and no parallel customer database are introduced.

## Canonical event fields

The server owns `visitor_id`, `session_id`, `asset_slug`, `path`, attribution fields, `stage`, `origin`, and tracking mode. Client `meta` cannot override canonical fields. Metadata is bounded to a small key/value envelope.

## Current signals

- `ks_shelf_view`
- `ks_asset_click`
- `ks_item_view`
- `ks_engaged_30s`
- `ks_engaged_120s`
- `ks_scroll_50`
- `ks_scroll_90`
- `ks_cta_click`
- `ks_lead_submit`
- `ks_video_start`
- `ks_quest_start`
- `ks_quest_clear`
- `ks_checkout_start`
- `ks_purchase`

Only events with an implemented product surface should be emitted. Video, Quest, checkout and purchase hooks are reserved for their later real integrations.

## Quality / safety gates

Before production deployment:

1. Tests/build pass on the combined Knowledge Shelf + Journey tree.
2. Authenticated Dashboard preview renders without leaking owner credentials.
3. iPhone smoke verifies one anonymous Shelf journey.
4. Lead-submit smoke verifies consented identity stitching.
5. Privacy/cookie language matches actual production behavior.
6. Paid entitlement remains server-side before protected content is released.
7. Retention/deletion policy is defined before Journey history becomes long-lived customer data.

Production deployment remains a Human Gate.
