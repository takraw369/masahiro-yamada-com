# MASA Dashboard Design Studio | Pilot 2026-10-11

## Purpose and source of truth
MASA can select visual **Style**, structural **Layout**, and independent **Components** from previews, compose a live mockup, save favorite combinations, intentionally apply them to Dashboard home, and return to the exact original display.

The existing Google Drive "MASA DESIGN INTELLIGENCE" is the research and design-decision source of truth. This file describes the bounded implementation only. Preserve existing /dashboard/design-lab (25 preference signals) and /dashboard/visual-structures (20 diagrams); do not fork a second Design OS.

## UI and controls
- Private route: `/dashboard/design-templates` (navigation label: Design Studio). Linked from /dashboard/design-lab, Dashboard MORE TOOLS and a rail of 6 sample thumbnails on the Dashboard home.
- 6 **Style** preview SVGs: Dawn Focus, Night Gold, Ocean Flow, Glass Layers, Editorial Calm, Quest Energy.
- 6 distinct **Layout** SVG wireframe thumbnails: Focus First, Command Split, Journey First, Action Tiles, Editorial Story, Studio Grid. These show different positions and order of FOCUS/OFFER/FLOW/OUTPUT rather than recolored copies.
- 4 **Component** families with 3 independently selectable choices each:
  * Buttons: sharp / soft / pill;
  * Cards: outline / soft / float;
  * Home Quick Navigation: tabs / chips / dock;
  * CTA: solid / outline / minimal.
- Combined live preview uses the same layout IDs and corresponding CSS relationships as production home; sample data are explicitly illustrative.
- User must tap **Apply** for homepage to change. **Save favorite** stores a named combination only and never changes live pages. Up to 12 favorites; can load and delete locally.
- **Reset standard** removes the v2 stored config and legacy v1 config; original Dashboard displays again. UI changes never publish a page or alter offers, Stripe, LINE, data, workflows or access rules.

## Real implementation boundary
`src/data/homeDesignCombinations.ts` is the typed configuration and allowlist. It can safely read legacy `HOME_PRESET_STORAGE_KEY` but invalid v2 does not silently fall back to a stale value. `HomeDesignConfigurator.tsx` implements choices, favorites and explicit apply/reset. `src/styles/dashboard-design-studio.css` renders visual combinations; `src/styles/dashboard-home-presets.css` implements home-only effects.

The `home-layout-grid` wraps four EXISTING major Dashboard sections (DashboardCockpit, RevenueMission, FLOW, OUTPUT) with grid CSS and order changes for 6 layout options, not just colors. The baseline has `display: contents` and is not altered by an unconfigured visit. On desktops wide enough, non-focus layouts can use two/three columns; at viewport widths < 1160px the grid becomes one column and retains the meaningful ordering differences. No existing project widgets' internal data/order are rewritten.

Components visibly affect actual home output cards, real links and quick home navigation; home cards/CTA are also styled where widget CSS permits. Full theming of every nested React widget in every app is NOT implemented here. Reusing selected combos for ACE/SLF/LP is future work requiring screen-specific component mapping and explicit human review.

## Assets, licenses and cost
6 original in-repository SVG style cards and 6 original SVG layout wireframes. They are locally authored; do not scrape copyrighted screenshots from the eight reference providers. No external runtime assets, heavy animation, new npm dependencies, migrations, database writes or background API calls. Current-device only via `localStorage`; favorites and applied styles are not synced between devices.

## Human / release gates
1. Confirm 6 style + 6 layout thumbnails and distinct variants; all controls have obvious selected states.
2. Confirm each layout changes the *actual four Home regions' visual order / column distribution*, not only the demo.
3. Test 320 / 375 / 390 / 430 CSS px on iPhone or emulation; avoid page-level horizontal overflow, ensure 44px targets and 16px editable inputs.
4. Apply / reload / favorite save / favorite load / favorite remove / standard reset; try legacy style v1 and malicious/corrupt v2 JSON; confirm baseline unchanged.
5. Check focus, color contrast and reduced-motion behavior, and that no unrelated Dashboard/ACE routes change.
6. CI build, typecheck-release, tests, security and isolated Worker preview must pass.
7. MASA visual verdict **KEEP / REFINE / DROP**, *then* separate merge & production release approval. Keep draft until visual gate passes.

## Follow-up opportunities
After hands-on use, promote approved layout/part combinations to reusable Design Grammar, support device-independent saved presets (authenticated Cloud state with explicit choice and revision policy), and add per-product template targeting to ACE, SLF and sales landing pages. Avoid importing a reference site's exact code until licensing and accessibility are checked.
