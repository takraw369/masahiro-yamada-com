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

### 2026-09-13 — Quest follow-up pressure
- Corrected: Questの未実行フォローで、同じ催促や強いプッシュを日ごとに繰り返さない。未実行が続くほど切り口と頻度を変える。
- Cause: 完了率だけを最適化すると、コーチングが「戻りやすい場」ではなく追い立てる通知になり、離脱や嫌悪につながる。
- Rule: 未実行フォローは原則として「許可・最小化 → 選択・主体性 → 再解釈 → 自律・クールダウン」と角度を変え、反応がなければ頻度を落とす。罪悪感、連続記録喪失の恐怖、同文連投で行動を迫らない。

### 2026-09-08 — Source-of-truth mismatch
- Corrected: treat executable project configuration as authoritative when repository documentation claims a different framework/runtime state.
- Cause: documentation can remain correct in spirit while technical version details become stale.
- Rule: before acting on framework, deploy, domain, storage, or runtime claims in docs, verify them against current executable config and fix confirmed stale docs.
