# Knowledge Flow — resume checkpoint

## Goal / acceptance
Implemented a usable TypeScript MVP at `/dashboard/knowledge`: URL capture, rich
Inbox, Library, structured Flow, search/filtering, editable connections and local
persistence. Public routes, existing authentication, Cloudflare bindings and live
storage remain unchanged.

The first handoff refinement is now included: human intent is kept separate from
AI/summary fields, connection reasons are explicit, and `Output` is generalized to
`Destination` so one source can flow toward Content, Research, Project, Canonical,
or Hold without forcing every useful item into publishing.

## Source of truth / recoverable state
- Repository: `takraw369/masahiro-yamada-com`.
- Branch: `feat/knowledge-flow-mvp`; original base `6586891` from `master`.
- Draft PR: https://github.com/takraw369/masahiro-yamada-com/pull/92
- Original milestones: `e98faea`, `13b8260`; mobile polish: `c8dfd9e`.
- ChatGPT handoff refinement: human `why_saved`, `connection_reason`,
  `destination_type`, v1→v2 local snapshot migration and search coverage.
- `docs/knowledge-flow.md`: design, logical data model, integration mapping,
  Phase 2 priorities and validation receipt.
- `src/components/knowledge-flow/`: reusable React workspace, cards, forms,
  presentation primitives and ordered Flow.
- `src/lib/knowledge-flow/`: types, nine editorial fixtures, query functions and
  versioned repository adapter; no live API or secret access.

## Architecture decisions
Astro 7 / React 19 client-only islands / Cloudflare Workers. Existing middleware
continues to require signed Dashboard sessions. `/mind` remains the live FLOW MIND
cockpit. The existing knowledge API and its URL-intake rejection remain intact.
Drive / MASA_OS remains canonical. Demo browser storage is not canonical storage.
The new route adds noindex meta/header and never joins public content collections.
No sitemap generator is present. No package dependency or production binding added.

Do not create a second Knowledge or Project system for Phase 2. The live
`sunlovesflow-core` Supabase already contains the relevant layers:
- `masa_intelligence_feed` for discovered / captured external information,
- `knowledge_items` + `knowledge_relations` for developed Knowledge and explicit
  relationship reasons,
- `os_current_projects` for the current MASA project read model,
- existing owner-gated Dashboard RPC/API contracts for Intelligence and FLOW MIND.

## Completed / verification
- Capture → classify → Library → Flow → reload persistence verified in Chrome.
- Desktop and iPhone emulation, mobile capture, duplicate reopening, search,
  Escape, 320px overflow and five axe A/AA scans verified by the original MVP pass.
- Human intent fields now participate in keyword search without replacing summary.
- Old local v1 snapshots are migrated in-memory to v2 so existing demo edits are
  not silently discarded; an existing non-empty `output` migrates to Content.
- Current branch CI should remain the release receipt for typecheck/build/security;
  no production deployment or Supabase mutation has been performed.
- Actual iPhone Safari/VoiceOver and production runtime remain UNVERIFIED.

## Local preview / resume
`npm run preview:knowledge` (Node 22.19+ or 24) rebuilds an isolated local Worker,
using a local-only password verification fixture. Open
`http://127.0.0.1:8787/dashboard/knowledge`, enter `knowledge-flow-local-demo`,
then return to the knowledge URL after login. No production credentials required.
The demo persists per browser/origin under `masa:knowledge-flow:demo:v1`; the value
stored at that key is now schema version 2 after the next successful edit. JSON
export is available. Data remains in browser storage after logout.
Local screenshots/test scripts: `work/knowledge-flow/` (not pushed, not required).

## Open work / next smallest verifiable action
1. Make Today action-first rather than statistics-first: surface the best 1–3
   records to touch now and demote counts to secondary context.
2. Replace fixture Project choices with live `os_current_projects` through the
   authenticated server boundary; never expose Supabase credentials client-side.
3. Add a reviewed source-intake adapter using existing Intelligence contracts so a
   captured URL lands in `masa_intelligence_feed` before promotion to Knowledge.
4. Map explicit connection reasons to existing `knowledge_relations.reason` when a
   source is promoted/developed; do not infer that a relation is human-approved.
5. Keep Drive/Canonical promotion behind an explicit human gate.

## Human gate
Do not merge/deploy without MASA release intent. `master` pushes can deploy the
production Worker. Supabase schema/data mutation is also a separate approval step.
