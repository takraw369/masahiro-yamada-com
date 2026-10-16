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
- #366 OPEN: video style selector and experimental renderer dependency. Existing simple copy-video handoff retained; no style selector copied.
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

To be filled with observed receipts before PR handoff. All samples must be synthetic, with local-only credentials. Operator timings and mistakes are scripted walkthrough observations, not a user study or measured productivity gains.

Human Gate: MASA KEEP/REFINE/DROP; physical iPhone Safari check before merge. Draft PR only; no merge, production deployment, public preview deployment, publishing or paid API calls authorized by Issue #370. Better Design public HTTPS final receipt remains UNVERIFIED when that deployment is prohibited; local rendering must not be represented as VALID receipt.
