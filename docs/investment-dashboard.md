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


## Market Network — 2026-10-12

The Japan-only company relationship research surface is integrated into the existing
`/dashboard/investment` after Tenbagger Signal Lab. This is **not** a second
investment app or an automatic trade signal.

- Source: https://github.com/mattyamonaca/JP_Market_Vis
- Data: published JP Market Vis M4/M5 JSON; the browser reads it **only after
  explicit user interaction** (do not load ~43 MB expanded JSON on dashboard open).
- Integrity: reject M4/M5 with mismatched `dataset_id`; show generated date and
  source version, and display an external site fallback on network errors.
- Features: company/code search, category filtering, company-centered 1-hop
  relationship map, verified/unverified distinction, lazy evidence-shard loading,
  per-browser company watch list.
- Limitations: no historic snapshots for comparable month-over-month edge changes,
  no financial scoring, no automatic candidate promotion, no Supabase replication
  and no automatic investment orders. Relation count is *not* evidence of revenue growth.
- User action: verify relevant EDINET/IR primary documents and reference dates
  before promoting an observation to a research thesis.
- License: software uses Apache-2.0; included public datasets may carry separate
  terms from EDINET, IR sources and Wikidata. Do not assume blanket relicensing.
- Next phase: derive stable time-series snapshots from terms-compliant sources,
  track first/last observation separately from event dates, and correlate changes
  with financial disclosures only after reproducible validation.

## Global Financial Risk Monitor — 2026-10-13

This is a read-only stress monitor integrated at the top of the existing
`/dashboard/investment` page, not a new dashboard or trading agent.

- Signals: US 10Y yield, JGB 10Y (unconnected/Unknown until approved official series),
  WTI crude, USD/JPY, gold, ICE BofA US high-yield OAS via FRED, VIX, NASDAQ Composite.
- Data path: `/api/dashboard/financial-risk` fetches Yahoo Finance chart reference data
  and FRED public CSV on page open or on explicit refresh. No secrets or DB migration.
- Per-indicator rule thresholds are in `src/lib/financialRisk.ts`. Outputs are
  `normal / watch / elevated / severe / unknown`, not probability estimates.
- Aggregate state requires at least 5 fresh valid readings. Missing/stale readings
  stay Unknown and never become green by default. Severe aggregate requires several
  co-occurring red readings including at least one credit/VIX stress signal.
- Every reading includes its source, publication/observation time, comparison and
  threshold explanation. Gold's rise alone is not confirmation of crisis.
- FRED ICE BofA OAS units are **percent**, not basis points (e.g., 3.15% = 315bp).
  Source: https://fred.stlouisfed.org/series/BAMLH0A0HYM2
- No broker execution, portfolio writes, credential changes, or notification scheduling.
- News headlines/Robert Kiyosaki opinions are not input to the numeric risk state.
- Caveat: Yahoo Finance chart is an unofficial/uncontracted data interface;
  failed requests are surfaced visibly as Unknown. Prefer a licensed provider for
  production-strength data guarantees.

## Global Market Intelligence: relative strength + research — 2026-10-13

Extends the EXISTING `/dashboard/investment`; does not create a new app.
The screen is a human-in-the-loop observation and research surface.

### Phase 1 (this release)
- `/api/dashboard/market-flow` retrieves six months of daily ETF reference
  data (Yahoo Finance chart interface), using adjusted close if a complete
  adjusted series exists; otherwise raw close (explicitly shown).
- Compares approximately 21 and 63 US trading sessions: SPY baseline, QQQ,
  IWM, EWJ, EEM, TLT, GLD, XLE, XLF, XLK and XLV.
- Shows the absolute price returns and *percentage-point return differences*
  versus SPY with observation timestamps, stale/missing safeguards and
  source links. Group and 1M / 3M controls are client-side.
- Research labels ("persistent", "emerging", "lagging", "mixed", "unknown")
  are qualitative screening cues, NOT investment recommendations. The 3pp
  cutoff is heuristic, not backtested predictive accuracy.
- Clicking "市場比較を開く" is required before network fetch. This avoids
  eleven extra chart requests on every visit alongside Risk Monitor and
  the pre-existing market signals.
- Local research queue stores only ETF symbol keys in
  `masa-capital-flow-watch-v1` (browser only, not Supabase). Copyable research
  briefs prompt examination of causes, counterevidence and primary sources.
- Important: ETF prices and sector outperformance are **NOT** ETF net flows,
  creations/redemptions, positioning, or causal proof of capital rotation.
  True flow data is displayed as **unconnected** until terms-compliant,
  attributable primary sources are integrated. EWJ is a USD-listed
  unhedged Japanese equity ETF and is not a yen-local equity benchmark.
- No automatic trading, profit targeting, newsletter, notification or changes
  to existing investment-state persistence. Trading remains manual.
- Source: https://finance.yahoo.com/ ; source data is best-effort and may be
  delayed, fail or rate-limit. For production grade uptime use a contracted
  provider with redistribution rights.

### Phase 2 (not implemented)
Add ETF issuer net creation/redemption figures, official fund flow statistics,
thematic catalysts, dated historical snapshots and compare signals against
real capital flows before asserting "where money goes".

### Phase 3 (not implemented)
Automate daily/weekly significant-change detection using existing
`masa-automation/workflows/25_investment`, with evidence and alert thresholds,
without automatically changing positions or placing orders.
