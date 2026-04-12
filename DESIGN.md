# ACE METHOD — DESIGN.md

> Design system for masahiro-yamada.com and all ACE Method digital products.
> Inspired by Lamborghini's true-black + gold aesthetic, adapted for athlete cognitive education.
> All AI coding agents must follow this file when generating UI.

## Brand Identity

- **Brand**: ACE METHOD (Athlete Cognitive Education) by MASA (山田昌寛)
- **Tagline Philosophy**: 惹き出す、押し込まない (Draw out, don't push in)
- **Feeling**: Approaching a dojo at dawn — quiet intensity, earned beauty, nothing wasted
- **Audience**: Athletes, business athletes, parents raising athletes, health-conscious adults

## Color Tokens

```css
:root {
  /* Backgrounds */
  --bg-void:        #0D0B08;   /* Deepest black — page background */
  --bg-surface:     #1A1612;   /* Card / section background */
  --bg-elevated:    #241F1A;   /* Hover states, modals */
  --bg-overlay:     rgba(0, 0, 0, 0.75); /* Modal overlay */

  /* Gold spectrum — primary accent */
  --gold-pure:      #C9A96E;   /* Primary gold — headings, accents */
  --gold-muted:     #8B7355;   /* Secondary gold — labels, borders */
  --gold-dim:       #5A4D3A;   /* Tertiary — subtle accents */
  --gold-glow:      rgba(201, 169, 110, 0.08); /* Hover backgrounds */

  /* Text */
  --text-primary:   #D4C5A9;   /* Body text on dark */
  --text-muted:     #7A6F5F;   /* Secondary text */
  --text-dim:       #4A4030;   /* Tertiary / labels */

  /* Borders */
  --border-default: #2E2822;   /* Default border */
  --border-hover:   #8B7355;   /* Hover border */
  --border-accent:  rgba(201, 169, 110, 0.2); /* Gold accent border */

  /* Semantic */
  --accent-fire:    #E85D4A;   /* Energy, tension, CTA warning */
  --accent-water:   #5E7CE2;   /* Calm, growth, insight */
  --accent-earth:   #5DAA68;   /* Health, stability */
  --accent-line:    #06C755;   /* LINE brand green */
}
```

## Typography

### Font Stack
- **Display / Headings**: `'Cormorant Garamond', serif` — weight 300, 400, 600
- **Body / UI**: `'Zen Kaku Gothic New', sans-serif` — weight 300, 400, 500
- **Monospace** (code/data): `'JetBrains Mono', monospace`

### Scale
| Role | Size | Weight | Letter-spacing | Font |
|------|------|--------|---------------|------|
| Hero title | 36–48px | 300 | 0 | Cormorant Garamond |
| Section title | 20–24px | 300 | 0 | Cormorant Garamond |
| Label / Tag | 9–11px | 400 | 3–6px | Cormorant Garamond |
| Body | 13–14px | 300–400 | 0 | Zen Kaku Gothic New |
| Small / Caption | 11–12px | 400 | 0–1px | Zen Kaku Gothic New |

### Rules
- Headlines are NEVER bold (weight 700). Maximum weight is 600 for emphasis.
- Labels use uppercase + wide letter-spacing (3–6px).
- Body text line-height: 1.7–1.9 for Japanese, 1.5–1.6 for English.
- Never use Inter, Roboto, Arial, or system fonts.

## Spacing & Layout

### Grid
- Max content width: **480px** (mobile-first, single column)
- Desktop max: **1200px** (2–3 column grid for landing pages)
- Padding: 20–24px horizontal on mobile, 40–80px on desktop
- Section spacing: 64–120px vertical

### Spacing Scale
| Token | Value | Usage |
|-------|-------|-------|
| xs | 4px | Inline gaps |
| sm | 8px | Between related elements |
| md | 16px | Card padding, form gaps |
| lg | 24px | Section sub-spacing |
| xl | 40px | Between sections |
| 2xl | 64px | Major section breaks |
| 3xl | 120px | Hero / landing page sections |

## Components

### Cards
```css
.card {
  background: var(--bg-surface);
  border: 1px solid var(--border-default);
  padding: 20px;
  /* No border-radius — sharp edges convey precision */
}
.card:hover {
  border-color: var(--border-hover);
  background: var(--bg-elevated);
}
```

### Buttons — Primary
```css
.btn-primary {
  background: linear-gradient(135deg, var(--gold-muted), var(--gold-dim));
  color: var(--bg-void);
  padding: 14px 48px;
  font-family: 'Cormorant Garamond', serif;
  font-weight: 600;
  font-size: 13px;
  letter-spacing: 3px;
  border: none;
  cursor: pointer;
  /* No border-radius */
}
.btn-primary:hover {
  background: linear-gradient(135deg, var(--gold-pure), var(--gold-muted));
}
```

### Buttons — Secondary
```css
.btn-secondary {
  background: transparent;
  border: 1px solid var(--border-default);
  color: var(--text-muted);
  padding: 12px 32px;
  font-family: 'Cormorant Garamond', serif;
  font-size: 12px;
  letter-spacing: 2px;
}
.btn-secondary:hover {
  border-color: var(--border-hover);
  color: var(--gold-pure);
}
```

### Buttons — LINE CTA
```css
.btn-line {
  background: var(--accent-line);
  color: #ffffff;
  padding: 16px 44px;
  font-size: 15px;
  font-weight: 700;
  border-radius: 6px; /* Exception: LINE buttons use slight radius */
  box-shadow: 0 4px 20px rgba(6, 199, 85, 0.25);
}
```

### Dividers
```css
.divider {
  width: 48px;
  height: 1px;
  background: linear-gradient(90deg, transparent, var(--gold-muted), transparent);
  margin: 24px auto;
}
```

### Input Fields
```css
.input {
  background: transparent;
  border: none;
  border-bottom: 1px solid var(--border-default);
  color: var(--text-primary);
  padding: 14px 4px;
  font-size: 17px;
  font-family: 'Zen Kaku Gothic New', sans-serif;
  outline: none;
}
.input:focus {
  border-bottom-color: var(--gold-muted);
}
```

## Motion & Animation

- **Philosophy**: Things emerge like dawn light. Nothing bounces. Nothing spins.
- **Default transition**: `all 0.3s ease`
- **Reveal animation**: `opacity 0→1, translateY(16px→0), 0.5s ease`
- **Staggered reveal**: 200ms delay between sequential elements
- **Hover**: Border color and text color transitions only. No scale transforms.
- **Page transitions**: Fade, 0.4s ease

## Visual Effects

### Ambient Glow
```css
.ambient {
  position: fixed;
  top: 0; left: 0; right: 0; bottom: 0;
  background: radial-gradient(
    ellipse at 30% 20%,
    rgba(139, 115, 85, 0.04) 0%,
    transparent 50%
  );
  pointer-events: none;
}
```

### Blur Gate (locked content)
```css
.locked {
  filter: blur(8px);
  user-select: none;
  pointer-events: none;
  -webkit-user-select: none;
}
```

## Layout Patterns

### Hero Section (Landing Page)
- Full viewport height
- Single atmospheric image or gradient background
- One line: brand feeling (not a tagline)
- CTA button centered at bottom third
- Maximum 7 words visible

### Content Section
- Label (uppercase, letter-spaced, gold-muted) at top
- Content card below
- Generous vertical spacing (64–120px between sections)

### Progress Indicators
- Thin bar (2px height) with gold gradient fill
- Dot indicators: 6px circles, gold-muted for active, border-default for inactive

## Imagery Guidelines

- **Style**: Cinematic, atmospheric, high contrast
- **Color treatment**: Desaturated with warm undertones
- **Subjects**: Athletes in motion, dojo environments, dawn/dusk lighting
- **Never**: Stock photos, clipart, illustrations with flat colors
- **Placeholder**: Use solid color blocks matching the palette, never lorem picsum

## Responsive Behavior

| Breakpoint | Width | Behavior |
|-----------|-------|----------|
| Mobile | < 480px | Single column, 20px padding |
| Tablet | 480–768px | Single column, 40px padding |
| Desktop | 768–1200px | 2-column grid where appropriate |
| Wide | > 1200px | Max-width 1200px, centered |

## Anti-Patterns — NEVER Do These

1. **No border-radius** on cards, inputs, or primary buttons (exception: LINE CTA)
2. **No bright white backgrounds** — darkest surface is `#0D0B08`
3. **No bold headlines** — max weight 600
4. **No generic fonts** — never Inter, Roboto, Arial, system-ui
5. **No bouncy animations** — no spring physics, no scale transforms on hover
6. **No emoji** in UI elements
7. **No bullet points** in marketing copy — use prose or numbered steps
8. **No purple gradients** — gold is the accent color
9. **No stock photography**
10. **No cluttered layouts** — when in doubt, remove elements

## File Naming

- Components: `PascalCase.tsx` (e.g., `TrinityDiagnosis.tsx`)
- Pages: `kebab-case.astro` (e.g., `trinity.astro`)
- Styles: `kebab-case.css` (e.g., `global-tokens.css`)

## Framework Context

- **Framework**: Astro 6+ with `@astrojs/react`
- **Adapter**: `@astrojs/cloudflare` (Workers)
- **Styling**: Inline styles for React components, CSS variables for Astro pages
- **Deploy**: Cloudflare Workers via GitHub Actions CI/CD
- **Repository**: github.com/takraw369/masahiro-yamada-com
