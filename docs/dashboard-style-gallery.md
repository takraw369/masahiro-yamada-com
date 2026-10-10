# Dashboard Style Gallery | Pilot 2026-10-11

## Purpose
MASAが「サンプル画像で比較 → 選択 → ライブプレビュー → 適用 → 元に戻す」をiPhoneから行える最初のデザイン選定UI。

## Scope
- Private authenticated route: `/dashboard/design-templates`
- First use case: `/dashboard` (home) only.
- Six original SVG preview images: Dawn Focus / Night Gold / Ocean Flow / Glass Layers / Editorial Calm / Quest Energy.
- Selection updates the sample live preview. "このデザインをホームに適用" writes a validated preset id into the current device's localStorage. Home reads only that allowlisted value and applies scoped CSS.
- "標準デザインに戻す" removes the value. Other devices/users are not changed.
- Does NOT change tasks, layout ordering, stored data, offers, payment, ACE, LINE, or other routes.
- No template screenshot reuse, no copyrighted site asset downloads, no new npm dependencies, no external APIs, no migration.
- User must explicitly apply. Do not automatically replace the official design by selecting a sample.

## Reference DNA
Research canonical: MASA DESIGN INTELLIGENCE (Google Drive), section: REFERENCE INTAKE | Web Design 8 Sources, 2026-10-11.
- Dawn: Refero/Navigation hierarchy.
- Night: Refero/Supahero; controlled contrast.
- Ocean: Refero/Navbar; readable flow.
- Glass: Liquid Glass inspiration; lightweight CSS, not imported external library.
- Editorial: Supahero/Footer; hierarchy, typography.
- Quest: 3dicons/Scrolltide/CTA Gallery; sense of progression, but no heavy animation.

## Acceptance gate
1. Confirm 6 SVG thumbnails are present and different.
2. Tap any template: selected state and interactive live preview update.
3. Only explicit "適用" stores the preference and home changes; untouched default remains original.
4. Restore button returns to default. Broken/unknown storage never changes the site.
5. Verify at 320/375/390/430px CSS widths: no horizontal overflow, tap targets >=44px, selected state visible without color alone.
6. Contrast and reduced-motion checks. Existing Dashboard React widgets may keep their existing style: this is a visual-shell pilot, not a global theming migration.
7. MA​SA human visual review (KEEP / REFINE / DROP) required before merging or deploying to production.

## Future extension
After the human gate, promote approved preset tokens into shared component patterns. Next targets: landing pages and ACE, but they require separate screen-specific implementation and final approval. Cloud sync across devices and per-product themes are out of scope.
