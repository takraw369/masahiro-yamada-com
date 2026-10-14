# ACE People Graph v0.1｜LAB prototype handoff

## Status / boundaries
- Self-contained **offline HTML** under `docs/prototypes/`; **not routed or deployed** to the PRIMARY Dashboard.
- All 24 initial people and 37 edges are fictional fixture data. Add-person stores only in browser memory (resets on reload).
- No SNS API, authentication, external scripts, production Supabase, contacts import, scraping, real-person matching, or new source-of-truth.
- Existing Source of Truth remains: Drive Human Graph blueprint → Supabase structured PERSON/identities/relationships (after live schema verification) → PRIMARY dashboard UI.

## v0.1 preview behavior
- Display modes: **全体** (radial), **階層** (left-to-right levels), **分類** (ACE / X / Instagram / TikTok / in-person).
- Distance filter **1–4 hops** from current focus; shift focus to selected person.
- Type filters, optional tentative edges, text search, shortest path, zoom, pan, draggable nodes.
- Person details include example aliases and a no-SNS person; manual add demonstration.
- White highlights verified connectors, dashed connectors denote hypothetical/unconfirmed; text is explanatory fixture only.

## Browser checks (headless Chromium, static HTML)
- Desktop 1440×900 and mobile 390×844 render, no page runtime errors or horizontal overflow.
- Initial: 24 persons, 37 edges, 21 visible at 3 hops. At 1 hop: 7 visible. At 4 hops: 24 visible.
- Both alternate graph modes render.
- Shortest path: 4-hop fixture path displayed.
- Added a mock offline contact: count goes 24 → 25; search highlights the contact.
- Reset reverts 25 → 24 and clears stale path label.
- Node selection, refocusing, disabling all edge types, unreachable route feedback, restoration: pass.

## Follow-on task for Codex (separate reviewed PR)
1. Inspect current `src/pages/dashboard/graph.astro`, `src/pages/dashboard/relationships.astro`, layouts, auth, review gates, and existing Supabase schema/RLS.
2. Port only useful graph interactions into the existing graph's **People** lens; do not copy fixture arrays or create a second app/CRM/person table.
3. Support person identity resolution after explicit review; every SNS profile must map to a single person_id, not be another node.
4. Edge schema: direction/type, witnessed-vs-candidate status, time, source, privacy/consent, visibility, and auditability. Social follow is distinct from actual meeting/Quest collaboration.
5. Read-only synthetic fixture and permission tests first, then separate user-controlled onboarding for real contact data.
6. All real data must require per-user authorization and role filters; sensitive inferred relationships must remain private. Production deploy is a separate explicit approval gate.

Canonical: [Human Graph blueprint](https://docs.google.com/document/d/1QjII1jKwce6oBp3-Za8IQVq37LTuxbBvVyubRKk885I/edit) · [FLOW MAP](https://docs.google.com/document/d/1evH8KF_4bY8CiUX7T5Iub5Yg4Ra9UJgQ5aowWFmilb4/edit) · [FLOW Visual Brain Issue #173](https://github.com/takraw369/masahiro-yamada-com/issues/173)
