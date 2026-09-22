---
name: masa-taste-frontend
description: Project adapter for Taste Skill anti-slop frontend guidance on masahiro-yamada.com. Use for landing pages, editorial pages, portfolios, campaign pages, and redesign work. Do not use this as the primary rule set for dashboards, data tables, or multi-step product UI.
---

# MASA Taste Frontend Adapter

This project uses Taste Skill principles as a bias-correction layer, not as a replacement design system.

## Source and precedence

Upstream inspiration: https://github.com/Leonxlnx/taste-skill
Official install name: `design-taste-frontend`

When instructions disagree, follow this order:

1. Executable code and current verified behavior
2. `CLAUDE.md`
3. `DESIGN.md`
4. This skill
5. Generic upstream defaults

`DESIGN.md` is the brand source of truth. Never replace its color, typography, spacing, motion, or component rules just because upstream Taste Skill suggests a different stack or aesthetic.

## When to use

Use this skill for:

- Landing pages
- Campaign or offer pages
- Editorial / story pages
- Portfolio-style pages
- Existing-page redesigns
- Visual polish where the current UI feels generic or AI-generated

Do not treat this skill as the primary pattern library for:

- Dashboards
- Dense tables
- Admin tools
- Multi-step application flows
- Auth or infrastructure surfaces

For those, preserve product usability, existing components, accessibility, and architecture first.

## 1. Read the brief before styling

Before changing UI, infer:

- Page kind
- Audience
- Desired emotional tone
- Existing brand assets
- Existing route / funnel purpose
- Accessibility and performance constraints

Then form a one-line internal design read such as:

`Reading this as: premium athlete education landing page for adults, with quiet intensity and high trust, preserving the ACE black/gold design language.`

Do not ask a design question when the repository and task already make the direction clear.

## 2. MASA baseline dials

Use these as default judgment aids, not hard-coded product settings:

- `DESIGN_VARIANCE: 6`
- `MOTION_INTENSITY: 3`
- `VISUAL_DENSITY: 3`

For a campaign or flagship landing page, variance may rise to 7. Motion should rarely exceed 4 unless the task explicitly calls for a more cinematic experience.

The existing `DESIGN.md` motion rule wins: quiet reveal, no bounce, no gratuitous scale, no spin.

## 3. Anti-slop rules

Actively avoid common AI-generated design tells:

- Purple / blue glow aesthetics that conflict with the ACE palette
- Centered hero + three equal cards as an automatic default
- Generic glassmorphism
- Rounded-everything UI
- Random icon mixtures
- Default Inter / system-font SaaS styling
- Decorative microcopy that adds no meaning
- Tiny eyebrow labels above every heading
- Unnecessary explanatory helper text
- Excessive section badges
- Repeated gradient text
- Stock-photo filler
- Motion added only to make the page feel "premium"

Prefer fewer, stronger elements with deliberate hierarchy.

## 4. Existing brand wins

Before introducing any new font, color, icon family, motion library, component library, or layout convention:

1. Read `DESIGN.md`.
2. Check current implementation and `package.json`.
3. Reuse existing tokens and components where possible.
4. Add dependencies only when the task genuinely requires them.

Do not force React, Next.js, Tailwind, Motion, shadcn, or any upstream Taste Skill default into this Astro project when the current stack already solves the problem.

## 5. Redesign protocol

For redesign work, audit before rewriting:

1. Purpose and conversion path
2. Information hierarchy
3. Typography
4. Spacing and rhythm
5. Color and contrast
6. Component consistency
7. Motion restraint
8. Mobile behavior
9. Accessibility
10. Performance and funnel regressions

Preserve what already works. A redesign is not permission for a broad rewrite.

## 6. Visual hierarchy test

Every page should make these answerable within a few seconds:

- What is this?
- Who is it for?
- What should I notice first?
- What is the next action?

If more visual elements compete with the primary answer, remove or demote them.

## 7. Pre-flight check

Before reporting UI work complete, verify:

- The result still follows `DESIGN.md`.
- No generic AI-purple / glass / rounded-card drift appeared.
- Typography is intentional and readable in Japanese and English.
- Mobile layout is usable.
- No unnecessary new dependency was introduced.
- Existing navigation, auth, routes, funnel flow, and performance were not degraded.
- Motion respects reduced-motion expectations and the project motion philosophy.
- No placeholder copy, fake metrics, fake testimonials, or unfinished components remain.
- Applicable items in `CHECKLIST.md` pass.

## 8. Upstream refresh

The upstream Taste Skill changes quickly. When intentionally refreshing project guidance, compare the latest official source first:

`npx skills add https://github.com/Leonxlnx/taste-skill --skill "design-taste-frontend" -a codex`

Do not blindly overwrite this adapter. Review upstream changes and promote only rules that improve this project's design without conflicting with `DESIGN.md` or the current architecture.
