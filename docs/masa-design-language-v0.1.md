# MASA Design Language v0.1

Status: **working design grammar**. Not ACE brand lock. **Contrast-first correction adopted in v0.2**.

## Why

MANIMANI felt stronger than many existing pages because it behaves like a **place you enter**, not a document you read.

The goal is not to copy MANIMANI's dark theme everywhere. The goal is to preserve the useful grammar:

**world → signal → action → response → progress**

## Core principles

1. **Depth before decoration** — background, surface and action layers must be visually distinct.
2. **One luminous signal at a time** — cyan/gold/violet are signals, not wallpaper.
3. **Actionable surfaces feel touchable** — interactive cards get depth, hover/focus and clear state change.
4. **Progress should be felt** — use path, state, number or world change; avoid static explanation-only pages.
5. **World-building is functional** — atmosphere must improve orientation, motivation or return behavior.
6. **Mobile action-first remains canonical** — style may never push the primary next action below decorative copy.
7. **Glass is a hierarchy tool** — use it for active/interactive surfaces, not every box.
8. **Motion answers interaction** — default still; move when touched, changed or progressing.
9. **Density has rhythm** — compact control areas + breathing room around decisions.
10. **Same DNA, different concentration** — utility tools can be 20–30% immersive; learning/game surfaces can be 60–80%.

## Token layer

Canonical reusable tokens live in:

`src/styles/masa-design-language.css`

Key families:

- Night / depth: `--masa-night-*`
- Surfaces: `--masa-surface*`
- Signals: `--masa-gold`, `--masa-cyan`, `--masa-violet`, `--masa-green`
- Borders / glass: `--masa-line*`
- Shape: `--masa-radius-*`
- Interaction: `--masa-motion`

Adoption is **opt-in** using a page-level `.masa-world` container. This prevents one experiment from repainting every Dashboard page.

## Concentration guide

- **Dashboard / control surfaces:** 30–45% — strong depth, restrained glow, action clarity first.
- **Learning / Quest / habit tools:** 50–70% — progress, feedback and character/world cues can be stronger.
- **MANIMANI / game surfaces:** 70–90% — immersion is part of the product.
- **ACE core:** undecided — do not lock the brand from this document.

## Learning loop

Every strong reference or successful screen should become a rule, not just a screenshot:

**reference → decompose → hypothesis → token/component → real use → feedback → grammar update**

Use `/dashboard/design-lab` to collect repeated taste signals. A single preference is a candidate. Repeated preferences across different questions and real screens can graduate into this grammar.

## v0.1 adopted pattern

The first attempt darkened the entire PRIMARY `/dashboard`. User feedback: **“色変えただけやん！ちと見ずらい”**. That approach failed.

Corrected v0.2 adoption:

- **light, high-contrast reading canvas** for widgets, lists, controls and long text;
- **one dark, immersive feature surface**, the real TODAY'S QUEST from canonical tasks;
- NOW / NEXT / WAIT real counts before the task, not invented XP;
- one clear next-action CTA linking to existing Task Flow;
- distinct visual hierarchy through layout/spacing, not color alone;
- existing API, auth and data paths unchanged.

Rule: *MANIMANI feel is an interaction principle, not permission to darken everything.*

## Do not

- darken a page only to make it look premium;
- use multiple glow colors with equal emphasis;
- turn every information block into a card;
- add animation without state meaning;
- sacrifice contrast or mobile fit for atmosphere;
- copy a reference's branding when the useful part is its interaction grammar.

## Next graduation criteria

A rule moves from v0.1 experiment to shared default only when at least one is true:

- the same preference repeats in Design Lab;
- the pattern clearly improves task completion / orientation;
- the user repeatedly asks for the same feel across unrelated surfaces;
- the pattern survives both iPhone and desktop without hiding the primary action.
