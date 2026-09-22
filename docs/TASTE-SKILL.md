# Taste Skill integration

This repository uses a project-local Taste Skill adapter for visual work:

- Skill: `.agents/skills/masa-taste-frontend/SKILL.md`
- Brand source of truth: `DESIGN.md`
- Agent workflow source of truth: `CLAUDE.md`
- Upstream: `https://github.com/Leonxlnx/taste-skill`
- Official upstream install name: `design-taste-frontend`

## Why an adapter instead of a blind upstream copy

The upstream Taste Skill is intentionally broad and includes defaults for React / Next.js / Tailwind-style projects. This repository already has an established Astro architecture and an ACE-specific black / gold design system.

The local adapter keeps the useful anti-slop behavior while preventing upstream defaults from replacing:

- ACE typography
- ACE palette
- Motion restraint
- Existing Astro / React architecture
- Existing routes, components, funnels, and accessibility behavior

## When agents should use it

Use the adapter for:

- Landing pages
- Campaign / offer pages
- Editorial / story pages
- Portfolio-style pages
- Redesigns
- Visual polish of an existing public page

Do not use it as the primary product-UI system for dashboards, dense tables, admin tools, or multi-step app flows.

## Current design pipeline

`Purpose / brief → DESIGN.md → MASA Taste adapter → implementation → visual review → CHECKLIST.md → Human Gate`

Taste is a quality layer, not a second brand system.

## Reviewing upstream changes

The upstream project changes quickly. To inspect or install the current official version locally for comparison:

```bash
npx skills add https://github.com/Leonxlnx/taste-skill --skill "design-taste-frontend" -a codex
```

Do not overwrite the local adapter automatically. Compare upstream changes and promote only the rules that improve this repository without conflicting with current architecture or `DESIGN.md`.

## Update rule

When a repeated visual correction from MASA becomes stable:

1. Add the concrete learning to `LEARN.md` first.
2. If repeated, promote the stable rule into `DESIGN.md` or the local Taste adapter.
3. Remove redundant wording from `LEARN.md` once the rule has become canonical.
