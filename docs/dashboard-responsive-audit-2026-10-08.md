# Dashboard responsive audit — 2026-10-08

## Trigger
Real iPhone screenshot shows `/dashboard/tasks` as enormous unstyled task titles, run-together status labels, and a long Google Docs URL spilling horizontally.

## Root cause
Astro component-scoped CSS attaches per-element scope attributes to static HTML. JavaScript `innerHTML` inserts new elements *without* those attributes. Several dashboard pages styled runtime-created cards with scoped selectors that could not match them. `overflow-wrap` alone cannot repair missing card, heading or layout styles.

## Inventory
Source reviewed: **41 Dashboard Astro routes**, including specialized graph/board canvases and dedicated React islands.

**11 runtime-injection surfaces remediated** using **route-loaded external CSS** in `public/dashboard/runtime-css/`, bounded by `@scope (.page-root)`. This leaves legacy page scripts untouched: Task Flow, Evidence Lab, Choice Lab, FLOW Board, Living Graph, Design Lab, Question Lab, Relationship OS, Voice Inbox, ACE Assets and Content Flow.

**Delivery:** `DashboardLayout.astro` loads the matching stylesheet only on its route (not all eleven on every visit), and shortens the Task Flow mobile header without modifying its existing JavaScript.

**Shared policy for all Dashboard routes**: `src/styles/dashboard-mobile-guardrails.css` imported by `DashboardLayout.astro`. Provides consistent box sizing across static HTML, React islands and runtime-generated DOM; protects text, links and form elements against viewport overflow, and preserves internal scroll for code/canvas-type content.

## Task Flow specific changes
- Scopes CSS to the page root so dynamic task cards receive intended design.
- Compact mobile cards: status/ID/priority/phase, title, step tracker and long next action have distinguishable groups.
- In-card steps remain horizontally scrollable; the entire page must not scroll sideways.
- Long task/project names and URLs wrap inside cards.
- Filter/refresh controls keep a mobile touch target at least 44px.
- Shortened mobile header to “TASK FLOW”.

## Verification and honesty
- Source-based audit covers all 41 page entries; regression test confirms runtime style assets and route mapping, and flags new runtime-HTML pages lacking a mapped fix.
- PR CI: regression tests, typecheck, build, isolated Worker smoke, dependency audit, secret scan.
- Live visual iPhone verification **not established by CI**. Check 320/375/390/430 CSS px on Safari for actual overflow and readability. Preserve true scroll within Graph/Board canvases.

## Design contract
1. No static-only Astro CSS for JS-injected content.
2. Never fix horizontal overflows solely by hiding or clipping the whole page.
3. Preserve min-width:0, border-box, breakable long text and intrinsic sizing.
4. Dense data: prioritize title, status, next action before diagnostics.
5. Every future new dashboard route inherits shared mobile guardrails, with page-level CSS tested separately.

## Rollback
Revert the PR. No page JavaScript, API, authentication, database or persistence modifications.
