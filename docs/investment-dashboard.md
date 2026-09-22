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

## Tenbagger Signal Lab — 2026-09-22
Astraのような専用金融AIを別ドメインとして追加せず、既存Capital Flow Labの「個別企業・予兆探索レイヤー」として扱う。

### Fixed evidence checks
1. Market cap: $0.5B–$3B
2. Gross margin: 40%+ and improving
3. ROIC > WACC with meaningful reinvestment runway
4. Debt / EBITDA ≤ 3×
5. Insider ownership ≥ 10% preferred

### Pre-signal layer
- gross-margin improvement before headline acceleration
- operating cash flow approaching positive territory
- SG&A / R&D efficiency changes
- management language / tone changes
- hiring, partnerships, regulation, competitor incidents
- relative strength and liquidity context

### Operating loop
1. Use the saved ChatGPT Research Brief to scan and collect candidate hypotheses.
2. Prefer SEC / IR / earnings materials and preserve source references.
3. Add only candidates worth human verification to Research Inbox.
4. Record the first counter-evidence to test before strengthening the thesis.
5. Mark each fixed condition only when verified; missing data remains `Unknown`, not `Fail`.
6. Move candidates through `INBOX → VERIFY → WATCH / REJECT`.
7. A WATCH candidate still does not become a position automatically; position decisions remain in the existing Experiment layer.

### Current persistence
The Signal Lab prompt and Research Inbox use browser LocalStorage (`masa-tenbagger-signal-lab-v1`) in the first MVP. This avoids changing the existing investment-state schema while the research workflow is being validated.

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
- Tenbagger Signal Lab is a research queue, not a buy/sell signal generator
- unverified figures remain Unknown; do not fill missing fundamentals by inference

## Next evolution
- promote Signal Lab state to Supabase after the workflow is validated
- add SEC / IR evidence ingestion and timestamped citations
- add batch candidate generation to `masa-automation/workflows/25_investment`
- official JGB yield series
- BOJ/MOF/Fed release collectors
- automated thesis-impact proposals
- conditional alerts
- optional read-only broker portfolio sync
