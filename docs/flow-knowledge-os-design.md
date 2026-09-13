# FLOW Knowledge OS — UI Design Foundation

> Internal cognitive workspace for MASA. This is not a landing page. It is a daily-use thinking, reading, connecting, reviewing, and publishing environment.

## 1. Design intent

The interface should feel like **a quiet study at dawn**: low-noise, warm, focused, fast, and alive only where attention is required.

Primary principle:

**Reduce cognitive load before adding visual personality.**

The system should make it easy to move through:

`Capture → Read → Think → Connect → Review → Promote → Publish`

The UI must never compete with the content.

---

## 2. Core visual concept — Ink / Paper / Sun

The existing ACE system uses deep black and gold. FLOW Knowledge OS keeps that identity around the workspace, while making the main reading/writing surface warmer and easier to use for long sessions.

### Default light workspace

```css
:root {
  /* Shell */
  --shell: #171513;
  --shell-elevated: #211E1A;
  --shell-border: #302B25;

  /* Reading / thinking surface */
  --paper: #F4F0E8;
  --paper-raised: #FBF8F2;
  --paper-soft: #ECE6DB;

  /* Text */
  --ink: #211E1A;
  --ink-secondary: #5F584F;
  --ink-muted: #8A8176;
  --text-on-dark: #E9E2D6;
  --text-on-dark-muted: #A69B8D;

  /* Brand accent */
  --sun: #B89455;
  --sun-strong: #C9A96E;
  --sun-soft: #E7D8BC;

  /* Knowledge states */
  --seed: #8A8176;
  --insight: #4F769B;
  --definition: #9A7440;
  --canonical: #B89455;
  --quest: #5F7D62;
  --content: #8A665B;
  --product: #745D86;

  /* Feedback */
  --success: #50765B;
  --warning: #A57B3D;
  --danger: #A95A4C;
  --info: #4F769B;

  --focus-ring: rgba(184, 148, 85, 0.35);
  --selection: rgba(184, 148, 85, 0.20);
}
```

### Dark workspace

Dark mode should be available, but the default reading surface remains differentiated from navigation.

```css
[data-theme="dark"] {
  --shell: #0F0E0C;
  --shell-elevated: #181613;
  --shell-border: #2A2621;
  --paper: #191714;
  --paper-raised: #211E1A;
  --paper-soft: #28241F;
  --ink: #E5DED2;
  --ink-secondary: #B0A79B;
  --ink-muted: #7E766C;
}
```

Gold is not decoration. It means **importance, promotion, or current focus**.

---

## 3. App anatomy

Desktop default uses a stable 3-pane structure.

```text
┌────────────────┬─────────────────────────────────────┬──────────────────────┐
│ NAV / CAPTURE  │ MAIN CANVAS                         │ CONTEXT / AI         │
│                │                                     │                      │
│ Today          │ Read / Write / Highlight            │ Related              │
│ Inbox          │                                     │ Backlinks            │
│ Journal        │ Current document / note             │ AI actions           │
│ Review         │                                     │ Project links        │
│ Projects       │                                     │ Promotion            │
│ Canonical      │                                     │ Source / provenance  │
│ Publish        │                                     │                      │
└────────────────┴─────────────────────────────────────┴──────────────────────┘
```

Recommended desktop widths:

- Left rail: 224–256px
- Main canvas: flexible, optimal text width 680–780px
- Right context rail: 300–360px
- Main app max width: none; use viewport intentionally

The center should always own the user's attention.

### Mobile

Mobile collapses to one canvas with a bottom nav:

`Today / Capture / Think / Review / More`

Context and AI appear as a bottom sheet, not a permanent panel.

---

## 4. Information hierarchy

### Top level

1. **Today** — what deserves attention now
2. **Capture** — fastest possible input
3. **Think** — journal, notes, blocks
4. **Read** — saved external sources
5. **Connect** — relationships and backlinks
6. **Review** — resurfacing and spaced review
7. **Build** — canonical, definitions, quests
8. **Publish** — output queue

Avoid showing every feature simultaneously.

---

## 5. Daily home — Today

Today should not be a generic dashboard.

It should answer only four questions:

- What should I look at?
- What should I think about?
- What should I finish?
- What can become an asset today?

Recommended modules:

- **Continue** — unfinished active item
- **Review 3** — three resurfaced notes/highlights
- **Promote 1** — strongest canonical candidate
- **Publish 1** — strongest output candidate
- **Capture bar** — always reachable

No vanity metrics above the fold.

---

## 6. Unified content model in the UI

Every item uses the same base card regardless of origin.

Possible source types:

- Web article
- Raindrop bookmark
- PDF
- YouTube
- Chat
- Journal block
- Memo
- Drive document
- Canonical
- Project
- Definition
- Quest
- Published content

Cards differ by a small source icon/label only. Do not create visually different mini-apps for each source.

Each item exposes:

- title or first line
- source
- created/imported date
- project links
- lifecycle state
- backlinks count
- last touched date
- next action

---

## 7. Knowledge lifecycle

Knowledge states are first-class UI objects:

`Seed → Insight → Definition → Canonical → Quest / Content / Product`

Rules:

- State is visible but never dominant.
- Use a 6–8px status dot plus label, not large colored cards.
- Gold is reserved for Canonical and promotion actions.
- State transitions should feel like promotion, not file movement.

Primary action wording:

- `Grow`
- `Connect`
- `Promote`
- `Turn into Quest`
- `Draft post`
- `Make canonical`

---

## 8. Reading experience

Reading mode should feel closer to a book than a dashboard.

- Main line length: 68–78 Japanese characters equivalent / 680–780px max
- Body: 16–18px desktop, 16–17px mobile
- Japanese line height: 1.8–2.0
- Paragraph spacing: 0.8–1.1em
- No persistent cards surrounding the article body
- Header controls collapse while scrolling
- Highlight colors should be subtle and semantic

Highlight behavior:

1. Select text
2. Floating mini-toolbar appears
3. Highlight / Note / Ask / Connect / Quote
4. Saved highlight immediately becomes independently addressable knowledge

---

## 9. Writing / block thinking

Borrow the best part of block-based tools without making the user think about block mechanics.

- Enter creates a new thought block
- `/` opens commands
- `[[` links knowledge
- `@` links people
- `#` adds lightweight states/tags
- Drag handle appears only on hover
- Blocks can be promoted independently

Default screen must still look like normal writing, not a database editor.

---

## 10. Context rail

The right rail is the system's intelligence layer.

### Related
Semantic and explicit relationships.

### Backlinks
Where this thought has appeared before.

### AI
Context-sensitive actions only. Avoid a generic empty chatbot.

Examples:

- Find contradiction
- Find older version of this idea
- Explain connection
- Turn into definition
- Draft X post
- Build note outline
- Find unused related assets

### Provenance
Always show where information came from.

---

## 11. Search

Search is command center, not a separate page.

Shortcut: `⌘K`

Search across:

- exact text
- semantic similarity
- people
- projects
- source type
- lifecycle state
- date

Results should support direct actions without opening each item.

---

## 12. Typography

Use the existing brand fonts selectively.

- **UI / body**: Zen Kaku Gothic New, 400–500
- **Reading**: Zen Kaku Gothic New, 400
- **Display / philosophy / canonical title**: Cormorant Garamond, 400–600
- **Data / IDs / technical provenance**: JetBrains Mono

Productivity UI should NOT use Cormorant for buttons, navigation, or dense labels.

---

## 13. Shape language

The existing ACE site uses sharp geometry. Keep precision, but slightly soften high-frequency interactive surfaces.

- Main panels: 0px radius
- Cards: 4px radius max
- Inputs / command palette: 6px radius max
- Pills only for filters/tags, never as the default shape
- No amoeba / blob UI
- No glassmorphism
- No decorative gradients except extremely subtle ambient light

---

## 14. Motion

Motion communicates state change.

- 120–180ms for hover/focus
- 180–240ms for panels
- 250–320ms for knowledge promotion
- no bouncing
- no scale-on-hover
- respect reduced motion

A promoted Seed becoming Canonical may use one subtle warm highlight sweep, once.

---

## 15. Accessibility and fatigue reduction

- Minimum body contrast target: WCAG AA
- Never encode lifecycle state by color alone
- Minimum interactive target: 40×40px desktop, 44×44px touch
- Full keyboard navigation
- Reading surface and chrome must remain visually distinct
- Avoid pure `#000` / `#FFF` for large reading surfaces
- Light and dark modes both required

---

## 16. First MVP screens

Build in this order:

1. **Today**
2. **Universal Capture**
3. **Reader / Note Canvas**
4. **Context Rail**
5. **Search / Command Palette**
6. **Review**
7. **Canonical promotion**
8. **Publish queue**

Do not build graph visualization first. Graph is a derived view, not a core workflow.

---

## 17. Core UX test

The product succeeds if MASA can complete these without thinking about file locations or source apps:

1. Capture one thought in under 3 seconds.
2. Save and read one external source.
3. Highlight a sentence and attach a thought.
4. See an older related thought automatically.
5. Promote a useful idea into Canonical.
6. Turn it into a publishable draft.
7. Return later and understand where every claim came from.

If any of these require navigating multiple tools, the design is not finished.
