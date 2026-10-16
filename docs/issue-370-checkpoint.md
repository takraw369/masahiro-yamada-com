# Issue #370 resume checkpoint

## Goal / acceptance
Creation-first Home; reach existing editor in <=2 intentional taps at 375/390px. Preserve saved themes, current selections/drafts, source rights, auth/account/scheduling/publishing gates. Draft PR only; no merge, deployment, paid API, payment or external publication.

## Current state
- Repo `takraw369/masahiro-yamada-com`, base `786d8db229316818df0877c220665551e6863988`.
- Branch `codex/issue370-creation-first-dashboard`.
- Draft PR https://github.com/takraw369/masahiro-yamada-com/pull/371 (attached to this task).
- UI source checkpoint: `a8bdd0b`; latest docs/tests/evidence commit follows it. Read fresh branch/CI before resuming.

## Completed
Current master, routes, tests, PRs, Drive Design Intelligence / Publishing Flow / Sellable Box and four official interaction references inspected. Bounded implementation connects Home to existing editors; picker folds and focuses editor; source-bound v1 handoff preserves X draft protection; source/copy/save failures keep work and show feedback beside controls. No new backend/dependency/generation feature.

## Evidence
- Initial implementation exact-head CI `38925566122`: 525 tests passed; release delta clean, existing repository type errors 214; production build, isolated Worker smoke, security, gitleaks passed.
- Follow-up exact-head CI `38926667336` passed; latest-head CI must be read fresh from PR #371 after the evidence commit.
- 26 focused tests passed after the save-feedback change, including conflicts and malformed/expired/pending handoffs. Added regression no longer relies on a focused submit button.
- Real isolated Astro Worker browser capture, synthetic credentials/data only: Home 320/375/390/430/1440/1728 has zero page overflow. Intent cards 88–101px high; Studio mobile visible inputs 16px and measured actions >=44px. Picker closes and focus reaches editor.
- 3 task walkthroughs plus version-conflict, source-outage and blocked-storage paths recorded in `docs/issue-370-creation-first-ux.md`; screenshots and synthetic measured receipts in `docs/reviews/issue-370/`.
- Better Design copy checks passed for initial creation entry and selected-material handoff. Scoped spacing completed at 390/1440/1728: 0 critical, 0 serious, 3 moderate (existing/project spacing outside default tool scale). Public HTTPS final receipt UNVERIFIED; deployment was not authorized.
- Local full-suite attempt exposed a missing/broken standalone Chromium launcher. GitHub Linux CI is the full-suite receipt; no product code or dependencies changed to bypass that local launcher. Native Node 22.23.3 used after Homebrew Node/older bundled Node issues. Do not treat local launcher failure as a product failure or a pass.

## Open work / Human Gate
Physical iPhone Safari, assistive-technology hands-on testing and MASA KEEP/REFINE/DROP remain UNVERIFIED. Four-way intent choice is the issue's required navigation, revealed only after opening the single creation action. No real Drive account contents, X publishing, LINE, payment or production state were exercised.

Do not merge/deploy. Before any future merge, reconcile #364's competing Home insertion point. Do not cherry-pick #325/#345/#366. Research source remains Drive; implementation/evidence belongs to this PR.

## Next smallest verifiable action
Read fresh PR #371 head + CI; open before/after images and run the three operator tasks on iPhone Safari. Obtain MASA's KEEP/REFINE/DROP and separate merge/deployment authorization if requested later.
