# Knowledge Flow — resume checkpoint

## Goal / acceptance
Implement a usable, responsive TypeScript MVP at `/dashboard/knowledge`: capture,
Inbox, Library, structured Flow, search, editable connections, and local persistence.
Preserve public routes, existing authentication, Cloudflare bindings and live storage.

## Source / current state
- Branch: `feat/knowledge-flow-mvp`, based on remote `master` (2026-09-15).
- Astro 7, React 19, Cloudflare Workers. React uses `client:only="react"`.
- Existing route duplicates FLOW MIND; `/mind` remains the existing live cockpit.
- `src/middleware.ts` already authenticates all Dashboard pages and APIs.
- Existing `/api/dashboard/knowledge` is an owner-scoped Supabase RPC boundary,
  and rejects URL-only captures. Do not change its contract for the prototype.
- Drive / MASA_OS remains canonical; local prototype is explicitly noncanonical.
- No sitemap generator or sitemap file is present in the repository.

## Decisions
Use a route-scoped React workspace, local fixture data and a replaceable repository
adapter. Respect MASA's explicit direction to design a new visual language here.
Use ordered Source → Theme → Project → Output paths, never a free-node graph.
Retain server-side auth; do not introduce a development bypass in application code.

## Completed / evidence
Repository, layouts, knowledge contracts, API, middleware, deployment workflow,
design rules and validation checklist inspected. Dedicated branch created.

## Open / next smallest action
Implement types, fixtures, storage adapter and UI, then run unit tests, typecheck,
build, isolated Worker auth/public-route smoke and authenticated browser checks.
All implementation and runtime behavior currently UNVERIFIED.

## Human gate
No gate for implementation. Do not merge to master: master pushes deploy production.
No production deploy or database migration is part of this local UI MVP.

## Implementation milestone
+- Route-scoped React workspace, typed fixtures, query model and local repository implemented.
+- URL capture, duplicate reopening, editable summaries/tags/theme/multiple projects,
+  manual score, states, output intent, and next action implemented.
+- Inbox/Library/Flow, attention filters, contextual rail and mobile navigation implemented.
+- Design/data model/Phase 2 guide and isolated authenticated preview helper added.
+- `npm test`: 76 passed. Production build + Worker config verification passed.
+- Full Astro typecheck: 363 existing repository errors; new Knowledge Flow files
+  have no errors. Release delta check and browser interactions still UNVERIFIED.
+- Next: isolated Worker smoke, browser capture/edit/reload/Flow checks at desktop
+  and iPhone widths; review diff, run release gate, publish working branch/draft PR.
