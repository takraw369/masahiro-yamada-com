# Issue #370 — 制作を先に置く最小改善

## Scope / reference lock

Base master: `786d8db229316818df0877c220665551e6863988`. Astro 7.3.1 / React 19 / Cloudflare. Existing Home, Knowledge Studio, Publishing Flow, Post and local v1 publishing handoff remain the implementation surfaces. No new Studio, database, dependency, AI generation, payment or publication action.

Research canonical documents read on 2026-10-17:
- [MASA DESIGN INTELLIGENCE](https://docs.google.com/document/d/1Zzyj7SmCCKfxelVevjunbp-jaantlSDIMgXayu2JIsM/edit): 1画面1主役、モバイルで行動を先に、既存Token・Patternを先に再利用。Drive is the research source; this memo records this PR's bounded implementation.
- [PUBLISHING_FLOW_OS](https://docs.google.com/document/d/1Rln-0-_vFsm76_BvTZDqql9nmYwi7KJHKNLPC4IQWN0/edit): source → draft → explicit review → publication. A source title is a scaffold, not generated article copy.
- [SELLABLE_BOX](https://docs.google.com/document/d/14wEp2PHCxCqKXeeCn3sZbKFdF1lbIupqM7jjW5LX6cQ/edit): reuse original material, define recipient/change/offer/next action, avoid competing products. This PR only copies a production brief for product concepts.

Existing theme/choice tokens remain canonical: `docs/masa-design-language-v0.1.md`, `docs/dashboard-mobile-ui-standard.md`, `docs/dashboard-style-gallery.md`, `homeDesignCombinations.ts`, `dashboard-home-presets.css`. Night / Tiles / Soft / Chips / Solid is a saved user choice, never a new forced default. No icon library installed; new controls use text.

### Four interaction references (principles only)

Reviewed official sources; no vendor assets/code or paid services used:

| Reference | Operator/context | Transferable principle | Adaptation / rejection |
| --- | --- | --- | --- |
| [Canva Home](https://www.canva.com/help/search-ai-bar/) | Creator choosing an output | Start from creation intent rather than operational metrics | Adapt: four existing-editor doors before operations. Reject: a second template/search platform. |
| [Notion buttons](https://www.notion.com/help/buttons) | Repeated small task | Name the outcome; open an existing page; confirm a consequential replacement | Adapt: existing editor links and explicit pending-handoff replacement. Reject: new automation/webhooks. |
| [Notion templates](https://www.notion.com/help/start-with-a-template) | Avoid repeated setup | Reuse known structure and existing content | Adapt: current Studio outline and source metadata. Reject: duplicated template catalog. |
| [Google Docs history](https://support.google.com/docs/answer/190843) | Editing while retaining earlier work | Preserve recoverable draft state; separate inspecting from replacing | Adapt: retain current version/save guards, protect existing Composer text. No new history system claimed. |

Better Design: find-design-system → retain product system; UI hierarchy and UX mobile information architecture/progressive disclosure, task detail, explicit handoff guidance loaded before changes. Live URL extraction reached the public login surface; its dark palette is not evidence to replace the authenticated user's selected Home scheme.

## Duplicate/overlap audit

- #364 OPEN: StatusFirstActions adds three task/status cards at the same Home insertion point. **Do not stack both as competing first actions**. Reconcile if either is merged; this issue explicitly prioritizes creation.
- #325 OPEN: opportunity widget and Design Studio bridge. Untouched.
- #345 OPEN: screenshot composer. No screenshot/export feature copied.
- #366 OPEN: same Studio file/video block may need a manual rebase; video style selector and experimental renderer dependency remain owned by that PR. Existing simple copy-video handoff retained; no style selector copied.
- #359 OPEN app catalog and #333 OPEN Intelligence reader: untouched.
- #339 saved-design sync, #357 weekly reminder, #331 video handoff, #365 Model Canvas: already merged. Retained, not recreated.

## Before → after (mobile first)

```text
BEFORE Home                         AFTER Home
[weekly slide reminder]             [つくる + short purpose]
[app shelf / many app links]         [投稿]       [記事・動画]
[configurable operations/KPI]        [教材・商品] [導線]
[output links / deep navigation]     [Drive素材→投稿 / 教材下書き]
                                    [same configurable operations]
                                    [same reminder / apps / references]

BEFORE Studio                       AFTER Studio
[intro + source search]              [intent title + saved-draft link]
[12 source cards + concepts]         [source picker, initially open]
[chosen source / video instructions] choose → fold picker + focus editor
[lesson fields / body / preview]     [source + rights + intent action]
[saved products far below]           [secondary video/lesson details]
```

Intent query parameters contain only fixed route intent. No source contents in URLs. Unknown intent uses the ordinary lesson/product workflow. Home is usable without JavaScript; dynamic source loading/editor behavior continues to use the existing private endpoint.

### Gains, costs and affected users

Creation begins before operation/status reading, supporting MASA's stated daily task. Operations remain directly below; users who visit Home mainly for status must scroll farther. A single intent routing block avoids adopting #364's competing task entry. Existing saved layout order within the four operational units remains unchanged.

Choosing a source now folds the long picker and focuses the editor; changing source remains a native disclosure. This saves traversal, but removes the full source list from immediate view after choosing. The selected ID, title, original link and rights remain visible. Source changes with an existing manuscript remain blocked by the original guard.

## Safe handoff contract

- Studio explicitly writes **only** `masa-publishing-handoff-v1`; no mutation to `masa-publishing-flow-v2`, current X account or draft storage.
- Additive optional `sourceUrl` / `sourceRights` fields preserve original reference and rights. Only HTTPS becomes a source link; text uses textContent. Old Flow handoffs remain valid.
- A fresh pending handoff requires confirmation before replacement. Cancellation/storage failure prevents navigation; manuscript remains intact. No claim that a clipboard action generated content.
- Post's existing 24h expiry, explicit import, draft protection, account selection and schedule/publication review remain unchanged. Source metadata stays outside Composer text.
- Article/product concepts: copy a source-bound production brief and paste into Codex; direct generation is explicitly preparation-only. Video continues through existing copy-to-Codex action. No direct MP4 claim.
- Lesson editing/preview/save uses existing expectedVersion and live-product update rejection; secondary editing is collapsed for post/article entry, expands when resuming a saved product.

## Verification and usability log

All runtime data and credentials below are synthetic and local-only. Chromium through Playwright rendered the actual isolated Astro Worker, not a hand-built replica. Source for Home/Studio was matched by SHA-256 to the committed branch before capture. Images cover the same source fixture and viewport sizes. This is a scripted walkthrough, not a MASA usability study; 3-second recognition and subjective effort remain UNVERIFIED.

### Tiny operator task log (390px)

Count convention: intentional link/button taps and field focus count; typing characters and scroll gestures do not. Baseline tap totals are reproducible **source-audit counts** using the existing mobile menu (menu → MORE TOOLS → Knowledge Studio = 3 taps), not recordings of a human. After paths were exercised in the real browser with fixtures.

| Task | Before → after taps | Scrolling / orientation / mistakes |
| --- | --- | --- |
| A. Drive material → X draft | Studio entry 3 → 1 via the Home Drive shortcut. Full modeled source-to-Composer path 11 → 5: old menu(3), source(1), Flow(1), focus three repeated fields(3), Post(1), expand/import(2); new shortcut(1), source(1), Post handoff(1), expand/import(2). | Before: source selected, then re-enter ID/title/audience in Flow. After: ID/title/audience/source URL/rights persisted; existing draft remains protected. X account fixture is disconnected, so text is editable while sending remains unavailable. No real post attempted. |
| B. Material → lesson + preview | Studio entry 3 → 2 through つくる → 教材・商品. Including source, two fields, outline and preview: 7 → 7 (the new preview link adds an explicit tap while removing traversal). Save adds one in either path. | Baseline editor began at document y≈2700px with 12 sources. After selection: list folds, focus moves to create-title; no manual traversal of the remaining source cards. Outline and rendered preview contain the synthetic core; save returns a draft receipt. No total-tap improvement claimed for this task. |
| C. Material → product/offer concept + next action | Source entry/copy sequence 5 → 4: old menu(3)+source(1)+generic AI brief(1); new intent(2)+source(1)+production brief(1). | Before generic lesson-refinement brief needed manual rewrite for product planning. After brief explicitly requests recipient/change/offer/next action, preserves source/rights and requires human approval. Article/product generation happens in Codex after paste, not in this browser. Clipboard was stubbed; user clipboard was not overwritten. |

Scripted route mistakes: none observed in the after walkthrough. One material issue was found during review: save-conflict feedback was ~1804px above the viewport. Fixed: the message now appears beside save controls at y≈596–647px in an 844px viewport, with the unchanged manuscript still editable. This is an observed repair, not a claim about user error rates.

### Failure and accessibility checks

- Version conflict: synthetic 409; exact manuscript retained; actionable explanation visible beside Save. Source/copy messages likewise sit beside the corresponding controls. No focus assumption after disabling a submit button.
- Source GET 503: clear connection failure and enabled refresh control; no fabricated empty list or generated result.
- Pending handoff cancellation and blocked storage: navigation stopped, old handoff and manuscript retained (executed source-handler tests).
- Malformed/expired handoff, existing Composer text, unsafe source URL: existing protection + new regression tests pass. Provenance never enters Composer text.
- Home and selected-lesson DOM at 320/375/390/430/1440/1728: page overflow **0px**. Intent cards **88–101px** high; measured Studio mobile actions >=44px and visible editable fields **16px**.
- Keyboard Enter opens native creation disclosure; selection focuses the editor heading. Reduced-motion browser context used. Existing font family is IBM Plex Sans JP with project fallbacks; no font/system replacement.
- Saved Night/Tiles/Soft/Chips/Solid fixture reads back as night with zero overflow; no preference writes by the new entry UI. Standard and Night images were visually checked for readable text and focus.
- **UNVERIFIED:** physical Safari, screen-reader hands-on, 200% text enlargement across every existing widget, live authenticated Drive/X data, actual publication/payment. Do not interpret fixture QA as those checks.

### Review / automated receipts

- Exact-head initial CI [38925566122](https://github.com/takraw369/masahiro-yamada-com/actions/runs/38925566122): **525 tests passed**, delta typecheck clean; **214 existing repository errors** remain; build, isolated Worker smoke, security and gitleaks pass.
- Follow-up [38926667336](https://github.com/takraw369/masahiro-yamada-com/actions/runs/38926667336) also passed. Read latest PR head checks after the final evidence commit; do not reuse an older receipt for a changed head.
- Local focused verification: **26 passed**, including source selection, pending cancellation, storage failure, safe URL/provenance, save conflict, saved design ordering, old Flow handoffs and no-overwrite guard. Full local suite's standalone macOS Chromium launcher failed; full-suite authority is GitHub Linux CI. No product dependency or test bypass added.
- Better Design principles/review rules loaded; initial entry and selected-material copy checks pass. First attempt had six visible choices; refined into one native creation disclosure. The four choices inside it are explicitly required by #370 and retained.
- `inspect-spacing`: completed for the modified creation entry at **390/1440/1728**; **0 critical / 0 serious / 3 moderate**, recorded in [spacing-review.json](reviews/issue-370/spacing-review.json). Moderate findings concern 6/26/54px and auto-centering values outside the tool's default 4px scale; these reuse the product's existing spacing. This scoped check is not full-dashboard visual approval.
- Per-rule self review: semantic disclosure/links and focus retained; no motion-only state; no fabricated counters, generation claims or copied vendor assets; source/saving guards retained. Fixed the serious offscreen error-feedback finding. Existing operational widgets/auth controls were not redesigned.
- Better Design public HTTPS final receipt is **UNVERIFIED**: no deployment/publication was authorized. No VALID receipt is claimed, and no private dashboard was made public to obtain one.

### Images and measured fixtures

All files below are synthetic QA evidence. [Baseline measurements](reviews/issue-370/baseline-measurements.json), [after measurements](reviews/issue-370/after-measurements.json), [interaction receipts](reviews/issue-370/ux-checks.json).

| State | Before | After |
| --- | --- | --- |
| Home / 390px | [Before](reviews/issue-370/baseline-home-390.png) | [Initial](reviews/issue-370/after-home-closed-390.png) / [4 intents](reviews/issue-370/after-home-390.png) |
| Home / 1440px | [Before](reviews/issue-370/baseline-home-1440.png) | [After](reviews/issue-370/after-home-1440.png) |
| Selected source / 390px | [Before](reviews/issue-370/baseline-studio-chosen-390.png) | [After](reviews/issue-370/after-studio-chosen-390.png) |
| Existing Night selection | — | [Night](reviews/issue-370/after-night-home-390.png) |
| X draft import | — | [Editable text, disconnected synthetic account](reviews/issue-370/after-post-import-390.png) |
| Lesson preview | — | [Preview](reviews/issue-370/after-lesson-preview-390.png) |
| Failure paths | — | [Save conflict](reviews/issue-370/after-save-conflict-390.png) / [Source outage](reviews/issue-370/after-source-outage-390.png) |

Full Home comparisons at 320/375/430/1728 are stored alongside these images.

### MASA review guidance

**KEEP:** creation first, reuse existing editors, explicit source/import/save/publication boundaries. **REFINE:** four intent labels, one-handed Safari path, whether the Drive shortcut should be the preferred daily entry. **DROP:** a second Studio, global theme replacement, KPI-first entry, automatic article/MP4/payment/publication expansion in this PR.

Human Gate: MASA KEEP/REFINE/DROP; physical iPhone Safari check before merge. Draft PR only; no merge, production deployment, public preview deployment, publishing or paid API calls authorized by Issue #370. Better Design public HTTPS final receipt remains UNVERIFIED when that deployment is prohibited; local rendering must not be represented as VALID receipt.
