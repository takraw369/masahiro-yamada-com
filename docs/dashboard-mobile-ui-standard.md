# Dashboard Mobile UI Standard

Status: canonical implementation guardrail for MASA OS Dashboard surfaces.

## Baseline

Every Dashboard screen must work first on a phone-width viewport before desktop polish.

Acceptance widths: **320 / 375 / 390 / 430 CSS px**.

## Non-negotiable rules

1. **No page-level horizontal overflow.** Flex/grid containers and their text-bearing children use `min-width: 0`; direct Dashboard content children stay within `max-width: 100%`.
2. **Long text is intentional.** IDs, URLs, evidence titles, task names and mixed Japanese/Latin strings must either wrap with `overflow-wrap: anywhere` or truncate with an explicit ellipsis.
3. **44 px touch targets on mobile.** Primary buttons, menu controls and compact action chips should reach at least 44 px in height/width where practical.
4. **No iOS focus zoom.** Text inputs/selects/textareas used in compact Dashboard UI must render at 16 px or larger on phone breakpoints.
5. **Media never widens the viewport.** Images, SVG, video, canvas and iframe content are constrained to their container unless the component owns a deliberate internal pan/scroll surface.
6. **Safe areas are part of layout.** Sticky/mobile chrome keeps `env(safe-area-inset-*)` handling.
7. **Horizontal scrolling must be local and deliberate.** Graphs, tables or timelines may scroll/pan inside their own bounded component; they must not make the whole page wider.
8. **Regression protection is required.** A mobile contract test should cover overflow-critical CSS whenever shared Dashboard layout or dense flex/grid cards change.
9. **Action before explanation.** On phone, the primary next action should appear within the first practical viewport whenever possible. Repeated page titles, duplicated explanations, large date cards and secondary orientation copy are reduced or removed on mobile.
10. **One-screen density is part of quality.** A layout is not finished merely because it no longer overflows. The first screen must answer “what do I do now?” before decorative or explanatory content.
11. **Mobile chrome stays compact.** Persistent header actions keep 44px tap targets but use shorter labels/icons on narrow screens so content starts earlier.

## Current implementation

Shared protections live in `src/layouts/DashboardLayout.astro`.

Dense cockpit-specific protections live in `src/components/dashboard/DashboardCockpit.tsx`.

The first regression contract is in `tests/dashboard-cockpit.test.mjs`.

## Visual gate

Before merging a Dashboard UI change, verify at least one real or emulated iPhone-class viewport and confirm:

- no text or card crosses the right edge;
- no unexpected page-level horizontal scroll;
- long Evidence/Task strings remain readable or cleanly ellipsized;
- input focus does not zoom the page;
- tap targets remain easy to hit;
- sticky top controls still fit without collision;
- the primary action/task appears before duplicated explanation or orientation content;
- the first practical viewport answers “what do I do now?” without requiring a long scroll.
