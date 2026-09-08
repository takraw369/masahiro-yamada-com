# Investment Dashboard / Capital Flow Lab

## Purpose

投資情報を貯めるためではなく、世界の資本Flowを「観測 → 仮説 → 少額実験 → 検証 → 増減判断 → 学習資産化」するMASA OS内の投資司令盤。

## Source of Truth

- UI / human decision surface: `masahiro-yamada-com` `/dashboard/investment`
- automation / research: `masa-automation` `workflows/25_investment`
- operational state: Supabase `masa_investment_state`
- durable evidence / project handoff: Google Drive `PROJECT_投資ダッシュボード｜Capital Flow Lab`
- execution: broker orders remain manual

## Live MVP — 2026-09-08

Implemented:

- Dashboard navigation entry `Investment`
- `/dashboard/investment`
- live-on-open market endpoint for USD/JPY, TOPIX, 1615 bank ETF, 1475 TOPIX ETF, US 10Y, NASDAQ, BTC
- source / observed timestamp / daily-change display
- THESIS-001 confidence / trigger / invalidation management
- experiment-capital and position log (`seed → core → exit`)
- intelligence log for human/AI evidence
- Supabase persistence across devices
- LocalStorage fallback if cloud persistence is unavailable
- production Supabase migration applied
- manual-only broker execution guardrail

JGB 10Y is intentionally not represented by an unverified proxy ticker. It remains a manual signal until a reliable official/approved series is wired.

## THESIS-001

**日本マネー逆流｜Japan Capital Repatriation**

BOJ normalization → Japan yields rise → rate differential narrows → yen carry shrinks → yen strengthens → Japanese capital returns home → domestic financials / Japan equities benefit → foreign risk assets may face marginal liquidity pressure.

This is a hypothesis, not a prediction. Confidence must move with evidence and counter-evidence.

## Existing automation assets

Do not create a second investment automation domain. `masa-automation/workflows/25_investment` already exists and includes the conservative `smart_money_weekly` research sensor and Investment Committee / human-gate rules. Dashboard work should integrate with this domain rather than duplicate it.

## Operating loop

1. Dashboard automatically refreshes market signals when opened.
2. AI / MASA adds consequential intelligence only.
3. Evidence updates thesis confidence, trigger, or invalidation.
4. MASA decides whether to enter / add / wait / exit.
5. Positions and rationale persist in Supabase.
6. Weekly learning should extract reusable principles into Drive without turning every market headline into permanent knowledge.

## Guardrails

- no automatic broker orders
- no leverage by default
- rumor never directly becomes a position action
- preserve contrary evidence
- distinguish observed price movement from causal explanation
- living expenses and experiment capital remain separate
- do not increase size solely because price moved in the expected direction

## Next evolution (not required for MVP)

- official JGB yield series
- BOJ / MOF / Fed release collectors
- automated thesis-impact proposals from `masa-automation`
- alert thresholds and event-triggered notifications
- optional read-only broker portfolio sync
