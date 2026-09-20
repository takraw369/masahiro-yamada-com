# DESIGN BRUSHUP LOOP

Purpose: reduce review latency, capture taste quickly, and turn approved improvements into reusable assets.

## Three-speed loop

### A. FAST LOOP — component / small section

Use for buttons, spacing, typography, hover, card treatment, section hierarchy, and small motion changes.

1. Identify the friction in one sentence.
2. Classify it: hierarchy / copy / component / spacing / motion / mobile / accessibility.
3. Compare at most 3 relevant references when needed.
4. Make one focused delta in `/ui-lab` or the feature branch.
5. Check desktop + mobile + reduced motion.
6. Keep, revise once, or reject.
7. If reusable, record the pattern.

Rule: do not turn a small polish task into a redesign.

### B. FEATURE LOOP — full screen / page

Use when the information architecture or emotional direction is changing.

1. Fill a short Design Intent Card.
2. Select the nearest Concept Template.
3. Shortlist 2–3 design directions.
4. Choose one direction using Design Decision OS.
5. Build a minimal Figma or `/ui-lab` proof.
6. Review hierarchy, button language, mobile, motion, accessibility, and performance.
7. Implement the winning direction.
8. Capture accepted decisions for reuse.

### C. PROMOTE LOOP — design system

Use only after a pattern proves useful more than once or is clearly foundational.

1. Confirm it solves a recurring problem.
2. Normalize tokens and states.
3. Define allowed contexts and exceptions.
4. Add a Figma example if visual judgment matters.
5. Add or update the code component.
6. Add usage guidance to the canonical docs.
7. Replace duplicates gradually; do not churn working UI without benefit.

## Feedback capture protocol

MASA can give low-friction feedback in natural language, for example:

- `これ好き。理由は余白と文字の強弱。`
- `このボタン嫌い。丸さと光り方が違う。`
- `こっちはACEよりBook Cafe向き。`
- `この動きは気持ちいいけど、トップには強すぎる。`

The agent should extract from that feedback:

- object: button / card / layout / typography / motion / image treatment
- verdict: prefer / avoid / concept-specific
- reason
- applicable concept
- strength: hard rule / default / soft preference / experiment

Only stable or repeated preferences should become canonical rules. One-off reactions stay as experiment notes until confirmed.

## Review budget

To keep the loop fast:

- small component: inspect only the affected area plus nearby hierarchy
- section: inspect section + previous/next transition
- page: inspect full flow
- design system promotion: inspect all known usages

Do not perform a full-site audit for every small change.

## Default gates

A change is ready to keep when:

- purpose is clearer or action is easier
- hierarchy survives without animation
- CTA weight is intentional
- mobile remains coherent
- reduced-motion does not break meaning
- no unnecessary dependency or heavy effect was added
- the result feels concept-specific rather than generic

## Rejection reasons

Reject or revise when:

- effect value is mostly novelty
- visual hierarchy became less clear
- interaction is heavier than its benefit
- concept identity weakened
- multiple CTAs compete
- mobile treatment looks like a compressed desktop design
- it creates a new pattern where an accepted pattern already works

## Routine cadence

### During active build
Run FAST LOOP continuously on the changed area.

### At feature completion
Run FEATURE LOOP once before merge.

### Periodically
Run PROMOTE LOOP on accepted patterns and consolidate the design system. Prefer consolidation over endlessly adding new components.

## Output after each meaningful polish cycle

Record only what matters:

```md
### Design Receipt
- Target:
- Problem:
- Change:
- Why it improved:
- Concept:
- Keep / revise / reject:
- Reusable pattern?: yes/no
- Canonical update needed?: yes/no
```

This receipt prevents rediscovering the same design decision in future chats or branches.
