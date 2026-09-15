# Knowledge Flow — resume checkpoint

## Goal / acceptance
Implemented a usable TypeScript MVP at `/dashboard/knowledge`: URL capture, rich
Inbox, Library, structured Flow, search/filtering, editable connections and local
persistence. Public routes, existing authentication, Cloudflare bindings and live
storage remain unchanged.

## Source of truth / recoverable state
- Repository: `takraw369/masahiro-yamada-com`.
- Branch: `feat/knowledge-flow-mvp`; base `6586891` from `master`.
- Draft PR: https://github.com/takraw369/masahiro-yamada-com/pull/92
- Implementation milestones: `e98faea`, `13b8260`; mobile polish: `c8dfd9e`.
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

## Completed / verification
- Capture → classify → Library → Flow → reload persistence verified in Chrome.
- Desktop and iPhone emulation, mobile capture, duplicate reopening, search,
  Escape, 320px overflow and five axe A/AA scans verified.
- 76 tests, production build/config, release delta typecheck, isolated Worker
  public/auth/knowledge smoke, audit and diff checks passed.
- Full repo typecheck has 363 pre-existing errors; changed source files are clean.
- GitHub CI test/build + secret scan passed on `13b8260`; consult current PR head
  checks for final docs/mobile polish. No deployment was performed.
- Actual iPhone Safari/VoiceOver and production runtime remain UNVERIFIED.

## Local preview / resume
`npm run preview:knowledge` (Node 22.19+ or 24) rebuilds an isolated local Worker,
using a local-only password verification fixture. Open
`http://127.0.0.1:8787/dashboard/knowledge`, enter `knowledge-flow-local-demo`,
then return to the knowledge URL after login. No production credentials required.
The demo persists per browser/origin under `masa:knowledge-flow:demo:v1`; JSON
export is available. Data remains in browser storage after logout.
Local screenshots/test scripts: `work/knowledge-flow/` (not pushed, not required).

## Open work / next smallest verifiable action
Phase 1 code is ready for UX review. Review current PR checks and try saving one
URL, adding a summary/project, setting its state to 育てる, and opening Library/Flow.
For Phase 2, inspect live canonical schema + owner/RPC contracts before implementing
an HTTP repository. Do not invent parallel Project/Canonical storage. Metadata,
AI, semantic search, ingestion, publishing and Drive canonicalization are deferred.

## Human gate
No implementation approval pending. Do not merge/deploy without release intent:
`master` pushes automatically deploy the production Worker.
