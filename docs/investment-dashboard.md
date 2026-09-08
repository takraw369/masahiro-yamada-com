# Investment Dashboard / Capital Flow Lab

## Purpose
世界の資本Flowを「観測 → 仮説 → 少額実験 → 検証 → 増減判断 → 学習資産化」するMASA OS内の投資司令盤。

## Source of Truth
- UI / human decision surface: `masahiro-yamada-com` `/dashboard/investment`
- automation / research: `masa-automation/workflows/25_investment`
- operational state: Supabase `masa_investment_state`
- durable handoff/evidence: Google Drive `PROJECT_投資ダッシュボード｜Capital Flow Lab`
- execution: broker orders remain manual

## Live MVP — 2026-09-08
- Investment navigation + route
- live-on-open USD/JPY, TOPIX, 1615, 1475, US 10Y, NASDAQ, BTC
- source/timestamp/daily change
- THESIS-001 confidence, trigger, invalidation
- experiment capital + position lifecycle (`seed → core → exit`)
- intelligence log
- Supabase cross-device persistence + LocalStorage fallback
- production Supabase migration applied
- manual broker-order guardrail

JGB 10Y intentionally remains manual until a reliable official/approved series is connected.

## THESIS-001
**日本マネー逆流｜Japan Capital Repatriation**

BOJ normalization → Japan yields rise → rate differential narrows → yen carry shrinks → yen strengthens → Japanese capital returns home → domestic financials/Japan equities gain relative support → foreign risk assets may face marginal liquidity pressure.

This is a falsifiable hypothesis, not a prediction.

## Existing automation
Do not create a second investment domain. `masa-automation/workflows/25_investment` already contains the conservative `smart_money_weekly` sensor and human-gate rules. The dashboard is the decision surface for that domain.

## Operating loop
1. Dashboard refreshes market signals when opened.
2. AI/MASA records consequential intelligence only.
3. Evidence updates thesis confidence, trigger or invalidation.
4. MASA decides enter/add/wait/exit.
5. Positions and rationale persist in Supabase.
6. Durable principles/evidence are promoted to Drive; transient noise is not.

## Guardrails
- no automatic broker orders
- no leverage by default
- rumor never directly becomes position action
- preserve contrary evidence
- distinguish price movement from causal explanation
- living expenses and experiment capital remain separate
- do not add merely because price moved in the expected direction

## Next evolution
- official JGB yield series
- BOJ/MOF/Fed release collectors
- automated thesis-impact proposals
- conditional alerts
- optional read-only broker portfolio sync
