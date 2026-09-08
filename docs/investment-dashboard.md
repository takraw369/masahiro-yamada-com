# Investment Dashboard / Capital Flow Lab

## Purpose

投資情報を貯めるためではなく、世界の資本Flowを「観測 → 仮説 → 少額実験 → 検証 → 増減判断 → 学習資産化」するためのMASA OS内ダッシュボード。

## Source of Truth

- UI / human decision surface: `masahiro-yamada-com` `/dashboard/investment`
- automation / collection / analysis jobs: `masa-automation`
- durable knowledge / evidence: Google Drive investment assets (existing folders should be consolidated rather than duplicated)
- execution: manual first. Broker/order execution is out of scope until explicit controls and risk rules exist.

## Core objects

### Signal
- symbol / series
- current value
- change
- regime
- timestamp
- source

### Thesis
- id
- title
- hypothesis
- confidence 0-100
- supporting evidence
- counter evidence
- next trigger
- invalidation
- affected assets
- last updated

### Position / Experiment
- asset
- amount
- entry date
- entry thesis
- expected trigger
- invalidation
- status
- P/L

### Intelligence
- source
- published_at
- event_at
- facts
- interpretation
- thesis impact
- confidence impact

## MVP watchlist

1. USD/JPY
2. JGB 10Y
3. BOJ policy / guidance
4. TOPIX
5. Japan banks
6. US 10Y Treasury
7. NASDAQ
8. BTC
9. Japan overseas securities flows
10. Japan FX reserves / intervention disclosures

## THESIS-001

**日本マネー逆流｜Japan Capital Repatriation**

Flow:

BOJ normalization → Japan yields rise → rate differential narrows → yen carry shrinks → yen strengthens → Japanese capital returns home → domestic financials / Japan equities benefit → foreign risk assets face marginal liquidity pressure.

Do not treat this as a prediction. Update confidence from observed evidence.

## Automation phases

### Phase 0 — now
- dashboard route
- thesis display
- experiment capital
- manual position log
- local persistence

### Phase 1 — data
- market data ingestion
- timestamp/source labels
- daily snapshots
- event calendar

### Phase 2 — AI strategy
- news/event intake
- deduplicate
- fact vs interpretation
- map evidence to thesis
- confidence update proposal
- trigger / invalidation alerts

### Phase 3 — shared operating system
- Drive evidence links
- portfolio history
- weekly learning report
- content reuse candidates
- API-accessible strategy state for other AI agents

## Guardrails

- AI may recommend, rank, explain and update confidence.
- AI must preserve evidence and counter-evidence.
- No automatic broker order execution in early phases.
- Do not increase position size merely because price moved in the expected direction; require thesis evidence.
- Keep living expenses and experiment capital separate.
