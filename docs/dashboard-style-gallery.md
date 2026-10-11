# MASA Dashboard Design Studio | Pilot 2026-10-11

## Purpose and source of truth
MASA can select visual **Style**, structural **Layout**, and independent **Components** from previews, compare a read-only preview of the real Home components, save favorite combinations, intentionally apply them to Dashboard home, and return to the exact original display.

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
- Choose **構成 → 見た目 → 部品** in three keyboard-accessible tabs. Japanese labels describe intended use. Desktop keeps choices beside a sticky preview; narrow screens include a persistent route between choices and results.
- Inline preview renders the actual `DashboardCockpit`, `RevenueMission`, `HomeFlowMap`, and `HomeOutputDoors`, using existing private GET endpoints. Preview is inert and mutation handlers are guarded. No invented production numbers. The separate localhost QA harness uses clearly labeled sample fixtures.
- The optional bounded `design-preview` query previews allowlisted v2 settings without reading or overwriting the saved Home choice. Authentication and X-Frame-Options DENY remain intact. No iframe exception.
- User must tap **Apply** for homepage to change. **Save favorite** stores a named combination only and never changes live pages. Up to 12 favorites; can load and delete locally.
- **Reset standard** removes the v2 stored config and legacy v1 config; original Dashboard displays again. UI changes never publish a page or alter offers, Stripe, LINE, data, workflows or access rules.

## Real implementation boundary
`src/data/homeDesignCombinations.ts` is the typed configuration and allowlist. It can safely read legacy `HOME_PRESET_STORAGE_KEY` but invalid v2 does not silently fall back to a stale value. `HomeDesignConfigurator.tsx` implements choices, favorites and explicit apply/reset. `src/styles/dashboard-design-studio.css` renders visual combinations; `src/styles/dashboard-home-presets.css` implements home-only effects.

The `home-layout-grid` wraps four EXISTING major Dashboard sections (DashboardCockpit, RevenueMission, FLOW, OUTPUT). A shared region-order function keeps DOM reading order aligned with visual order for all six layouts; CSS controls columns only. The baseline has `display: contents` and is not altered by an unconfigured visit. On desktops wide enough, non-focus layouts can use two/three columns; at Home container widths < 860px the grid becomes one column and retains the meaningful ordering differences. No existing project widgets' internal data/order are rewritten.

Components visibly affect actual home output cards, real links and quick home navigation; home cards/CTA are also styled where widget CSS permits. Full theming of every nested React widget in every app is NOT implemented here. Reusing selected combos for ACE/SLF/LP is future work requiring screen-specific component mapping and explicit human review.

## Assets, licenses and cost
6 original in-repository SVG style cards and 6 original SVG layout wireframes. They are locally authored; do not scrape copyrighted screenshots from the eight reference providers. No external runtime assets, heavy animation, new npm dependencies, migrations, or database writes. Preview performs the same three read-only API calls as Home; choosing a style does not repeat them. Current-browser only via `localStorage`; favorites and applied styles are not synced between devices.

## Human / release gates
1. Confirm 6 style + 6 layout thumbnails and distinct variants; all controls have obvious selected states.
2. Confirm each layout changes the *actual four Home regions' visual order / column distribution*, not only the demo.
3. Test 320 / 375 / 390 / 430 CSS px on iPhone or emulation; avoid page-level horizontal overflow, ensure 44px targets and 16px editable inputs.
4. Apply / reload / favorite save / favorite load / favorite remove / standard reset; try legacy style v1 and malicious/corrupt v2 JSON; confirm baseline unchanged.
5. Check focus, color contrast and reduced-motion behavior, and that no unrelated Dashboard/ACE routes change.
6. CI build, typecheck-release, tests, security and isolated Worker preview must pass.
7. MASA visual verdict **KEEP / REFINE / DROP** before adopting a combination. Follow already-authorized release scope; do not ask again for permission supplied in the session.

## Follow-up opportunities
After hands-on use, promote approved layout/part combinations to reusable Design Grammar, support device-independent saved presets (authenticated Cloud state with explicit choice and revision policy), and add per-product template targeting to ACE, SLF and sales landing pages. Avoid importing a reference site's exact code until licensing and accessibility are checked.

## Phase 1 checkpoint | 2026-10-11
User feedback: difficult to see, read, choose and use. Structure and feedback precede decorative expansion. This change refines the existing PR #289; no second Design OS, route or PR.

Local evidence: source-bundled React preview with explicitly synthetic fixtures; 320/375/390/430px page widths checked without horizontal overflow; active picker controls at least 44px and editable inputs 16px. Read-only nested preview controls are inert. Structure switch changed actual region order; tab arrow navigation worked. Apply/favorites/reset verification and exact-head CI are recorded in the Drive checkpoint once observed. Local dependencies differ from the project lockfile, so localhost is visual interaction evidence only. Production deployment, physical iPhone use and MASA taste verdict remain UNVERIFIED until separately observed.

Next phases: (2) carry MASA-approved composition to Dashboard and Publishing Flow, then (3) refine X/ACE and public conversion pages for each audience. Reuse this grammar only after observed use; do not equate aesthetic polish with proven popularity or conversion.

## Phase 2 selected combination | 2026-10-11
MASA said 選んだ; the applied local Home DOM showed **night / tiles / soft buttons / soft cards / chips / solid CTA**. This exact combination is recoverable via the named choice in Design Studio. It is not imposed as the default on other browsers. Explicit Apply remains required.

Selected dark Home skins now use opaque readable widget surfaces, larger supporting text, consistent accent/field colors and 44px revenue controls. Publishing Flow reads the same validated browser preference, prioritizes one draft-opening action before the metadata, uses Japanese task shortcuts and labels, and moves phase guidance/week planning/full roadmap behind native details. Its existing field IDs, storage schema, canonical Drive links, human publication boundary and handoff payload are preserved. Its base/choice CSS is globally bounded by the route root so runtime-added material/result rows receive the same styling.

Source QA: 320/375/390/430px page overflow0; primary draft CTA in the first practical viewport; active actions≥44px and all text inputs16px. Selecting MAP updated the visible summary and previously folded guide, then TOUCH was restored. Release proof is the exact remote CI and deployment receipt in Drive, not this description.

## X editor adoption — 2026-10-12

`/dashboard/post` reads the same validated device choice as Home and Flow. The
editor precedes draft generation, account strategy and profile-loop helpers;
these helpers remain available in native closed disclosures. Flow import remains
explicit, expires after 24 hours and refuses to replace an existing draft,
including while the composer is hidden behind its reserved-posts tab.

Before the existing POST endpoints are called, a review shows the exact copy,
active account and local scheduling time. Editing or expired scheduling makes
that review invalid. Tests use synthetic accounts; UI QA never posts to X.

Motion grammar is reused from PR #303, head
`c577f033c7f64bb287a48f1fabcd035216ba9730`: the identical
`src/data/motionPresetCatalog.ts` supplies `quiet-fade` (260ms) for review,
`press` (180ms) for button response, and `success` (340ms) for completion.
Only opacity/transform animate; no looping, typing animation or layout tween.
Reduced-motion disables animation, transition and press translation. This
adoption does not merge or publish the separate Motion Picker route; PR #303
continues to own that route and its selection interface.

Source QA baseline at 390px: the former editor was 6036px below page start.
With Flow import closed, the source preview editor starts at 435px and its
review action ends at 742px (844px viewport). Check the deployed computed
styles as well as source preview: common Dashboard CSS can override fields.
Physical iPhone and user impact remain separate, unverified acceptance items.

Production follow-up: connection-read failure adds a retry action. Keep retry
beside the account selector so this state does not push the next action below
the first 844px viewport at 320px. Verify this error state separately from
synthetic connected-account fixtures. Do not interpret an API failure as zero
accounts, or claim that UI work repaired the backend connection.
