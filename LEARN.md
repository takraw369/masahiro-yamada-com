# LEARN.md — Actionable Learning Only

This is not a diary or session log.
Store only feedback that must change future implementation behavior.

## Entry format

### YYYY-MM-DD — short label
- Corrected: what MASA made us change
- Cause: why the first implementation missed
- Rule: what must be done differently next time

## Promotion rule

When the same class of learning appears twice:

1. Promote it to `CLAUDE.md`, `CHECKLIST.md`, `DESIGN.md`, or the relevant canonical code/doc.
2. Keep only the minimum historical note here if it still adds value.
3. Do not let this file become a second rulebook.

## Current learnings

### 2026-09-08 — Source-of-truth mismatch
- Corrected: treat executable project configuration as authoritative when repository documentation claims a different framework/runtime state.
- Cause: documentation can remain correct in spirit while technical version details become stale.
- Rule: before acting on framework, deploy, domain, storage, or runtime claims in docs, verify them against current executable config and fix confirmed stale docs.
