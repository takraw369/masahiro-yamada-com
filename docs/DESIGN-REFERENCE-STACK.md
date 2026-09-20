# DESIGN REFERENCE STACK

Purpose: improve design judgment before implementation. This is not a dependency list. It is a reference and selection workflow for ACE METHOD / MASA digital products.

## Principle

Do not copy a visual style wholesale. Use external references to identify interaction patterns, hierarchy, information density, motion quality, and proven UX conventions, then translate only the useful parts into the ACE design system defined in `/DESIGN.md`.

## Reference layers

### 1. Product / UX patterns
- Mobbin — real product screens and flows. Use when plan access is available.
- Figma references / community files — use for layout exploration and system-level composition before code.

### 2. Web composition / art direction
- Land-book — curated website and section references. Strong for page composition, typography, editorial hierarchy, sport / health / education references.
- Awwwards — use selectively for storytelling, interaction, transitions, experimental composition. Never adopt spectacle by default.

### 3. Component / motion sources
- ObsidianUI — interaction and motion layer. Prefer isolated components, adapted to ACE tokens.
- 21st.dev — browse multiple component registries, preview before implementation, and use agent/MCP workflows where useful.
- Magic UI — polished marketing motion and micro-interactions.
- React Bits — broad effect catalog; useful for discovering a specific interaction or text/background effect.
- Motion Primitives — restrained reusable motion primitives; prefer when a smaller composable interaction is enough.
- shadcn/ui / Radix — foundation and accessible primitives when applicable.

## Selection rubric

Before promoting an external pattern into production, evaluate:

1. Purpose fit — does it improve comprehension, trust, motivation, or navigation?
2. ACE fit — can it use existing colors, typography, spacing, square geometry, and tone without fighting the system?
3. Information hierarchy — does the eye know where to go first, second, third?
4. Motion necessity — does motion explain state/flow, or is it decoration?
5. Restraint — remove effects that compete with the message.
6. Mobile quality — touch, viewport, and reduced screen width must remain intentional.
7. Accessibility — keyboard, focus-visible, contrast, reduced-motion, semantic structure.
8. Performance — prefer CSS/native browser motion over heavy runtime when the result is equivalent.
9. Ownership — prefer source-copy / locally owned components over opaque dependencies when practical.
10. Maintainability — tokenized, understandable, removable, and reusable.

## Default rejection signals

- generic AI landing-page look
- excessive gradient/glow/noise
- unnecessary glassmorphism
- rounded cards/buttons that conflict with ACE geometry
- tiny helper text or decorative micro-headings
- motion without information value
- WebGL/3D when a CSS treatment produces equivalent value
- duplicate primitives already present in the codebase
- hard-coded colors/spacing that bypass the design tokens

## Workflow

Reference search -> shortlist 3 directions -> compare against this rubric -> adapt one into `/ui-lab` -> run visual + responsive + accessibility checks -> Jev/design review -> promote only if it improves the product -> document the accepted pattern for reuse.

For AI agents: never invent a new visual language when an accepted ACE pattern already exists. Search the project and this reference stack first. When using an external component, inspect dependencies and source, adapt tokens in the same change, and retain reduced-motion behavior.
