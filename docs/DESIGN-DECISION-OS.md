# DESIGN DECISION OS

Purpose: externalize MASA's design judgment so humans and AI agents can make consistent decisions before implementation.

This complements `/DESIGN.md` (visual tokens/system) and `/docs/DESIGN-REFERENCE-STACK.md` (reference sources).

## Core worldview

Design should feel guided, not pushed. Prefer quiet intensity, earned beauty, human warmth beneath discipline, flow over force, and clarity before decoration.

## Default decision axes

- **Sharp > soft** — square geometry is the default. Rounded UI is an intentional exception.
- **Quiet luxury > loud energy** — controlled contrast, spacing, and typography before glow or spectacle.
- **Editorial depth for public pages / product efficiency for tools** — story pages may breathe; dashboards should get users to action fast.
- **Measured motion > decorative motion** — motion must clarify hierarchy, state, or emotional transition.
- **Discipline with warmth underneath** — first impression can be strong; the next layer should reveal humanity and welcome.

## Default taste profile

When no concept-specific override exists:

- dark or neutral base
- strong visual hierarchy
- generous whitespace
- one clear primary CTA per section
- typography-led composition
- sharp corners
- restrained accent usage
- imagery must support meaning, not fill space
- use a small number of interaction patterns repeatedly
- avoid decorative micro-headlines and tiny helper text unless information requires them

## Button rules

### Primary

Use for the single main action.

- square or near-square geometry
- clear contrast
- concise label
- substantial padding
- decisive, not playful
- preferably one dominant primary CTA per section

### Secondary

Use for lower-priority actions.

- outline or low-emphasis fill
- never compete with the primary CTA
- short functional labels

### Softer / rounded buttons

Allowed when the concept genuinely needs friendliness, family warmth, play, community onboarding, or a platform convention strongly benefits from it.

### Avoid

- several buttons at equal visual weight
- icon overload
- tiny CTA buttons surrounded by visual noise
- neon/glow CTA on calm or high-trust concepts
- mixing three or more button languages on one screen without a system reason

## Review questions

Before accepting a screen or section:

1. What is the one thing the user should understand?
2. What is the one action the user should take?
3. Is that obvious within roughly three seconds?
4. Does the button language match the emotional tone?
5. Is decoration competing with the message?
6. If animation disappeared, would hierarchy still work?
7. Does this feel like MASA / ACE / SLF, or like a generic template?
8. Could another agent reproduce this choice from written rules?

## Design Intent Card

Use this before generating or reviewing a design:

```md
## Design Intent Card
- Concept:
- Page / Screen type:
- Audience:
- Primary outcome:
- Emotional tone:
- First impression should feel:
- Visual direction:
- Preferred references:
- Button direction:
- Motion direction:
- Must include:
- Must avoid:
- Success condition:
```

## Capture approved decisions

For each approved direction, record:

- concept
- audience
- emotional tone
- page/screen type
- preferred references
- approved button style
- approved card style
- section order
- allowed motion patterns
- disallowed patterns
- Figma or screenshot reference
- implementation/component mapping

## Source-of-truth relationship

- `/DESIGN.md` = visual tokens and brand system
- `/docs/DESIGN-REFERENCE-STACK.md` = where to look and how to shortlist
- `/docs/DESIGN-DECISION-OS.md` = how to judge
- `/docs/CONCEPT-TEMPLATES.md` = concept-specific defaults
- `/docs/DESIGN-BRUSHUP-LOOP.md` = how to iterate quickly and promote patterns
