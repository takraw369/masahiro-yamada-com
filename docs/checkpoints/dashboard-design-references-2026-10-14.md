# Dashboard reference gallery — 2026-10-14

## Goal / acceptance

Keep five researched dashboard references in MASA Design Studio, allowing later comparison, favorites, notes, preview, explicit application and standard reset. Brand orange is #EE7800. Preserve existing design choices and private data boundaries.

## Implementation

- Existing `/dashboard/design-templates` receives a first `参考5案` tab; no separate app, database or auth path.
- Reference library: `src/data/dashboardDesignReferences.ts`; original SVG layout diagrams in `public/assets/dashboard-reference-presets/`.
- Gallery: `DashboardDesignReferenceGallery.tsx`; existing `HomeDesignConfigurator.tsx` handles preview and application.
- `MASA Orange` is an additional allowlisted skin. #EE7800 buttons use #171717 text; small links use #A84B00.
- All five references and URLs are source content. Favorites, notes, preview resume position and applied home design persist in this browser. No cross-device synchronization is claimed.
- Existing saved combinations and six prior themes remain available. Preview does not automatically apply or mutate canonical task data.
- Inspo MCP was unavailable in the research session. References were inspected through public creator/vendor demos; third-party code and images were not copied.

## Verification receipts

- Full Node regression suite: 441 passed, 0 failed.
- Production build and Worker config verification passed before final presentation-only positioning change; final gates still required below.
- Browser on isolated localhost with synthetic session and no production services: favorites and notes restored on reload; orange/studio preview restored; explicit apply changes Home; standard reset removes Home overrides and retains reference favorites/notes.
- 320 / 375 / 390 / 430 CSS px: document scrollWidth equals clientWidth; all five cards present; favorite/try controls 44–45px; note input 16px.
- Focused parser tests: malformed/oversized/unknown state rejected or sanitized, notes bounded, duplicate favorites deduplicated, unavailable storage throws instead of reporting persistence.

## Open work / next action

Finish final browser screenshot after moving the previous adopted-combination panel below the workbench, then release-delta typecheck, build, preview smoke, dependency security gate, diff review and remote PR/CI. Deployment remains UNVERIFIED until a successful production receipt. Do not report a PR as a deployed dashboard.

## Recovery

Repository default/deploy branch is `master`, not historical `main`. Work is on `codex/dashboard-design-references-20261014`, based on freshly fetched `216674b`.

Host default Node was broken; bundled Node v24.19.0 was used. Dependency installation hit local disk exhaustion. Only this task's partial node_modules was removed, and a compatible existing dependency tree was used without changing package files. Synthetic preview helpers live in ignored work/ and must not be committed.

## Human Gate

No payment, external message or canonical state change is part of this feature. Preserve normal repository production gates and report any gate that prevents release.
