# Legacy MASA OS retirement — 2026-09-11

## Decision

Canonical dashboard: `https://masahiroyamada.com/dashboard`

Legacy dashboard to retire: `https://masa-os-dashboard.pages.dev/`

The legacy Pages app must not remain a second source of truth. Its unique value is migrated into the canonical dashboard/domain before retirement.

## Read-only inventory of legacy app

### Unique or worth preserving
- Wealth Engine growth phases
  - 0: 月10万円 — 労働を事業へ置換
  - 1: 月30万円 — ACE＋診断＋発信安定
  - 2: 月100万円 — 継続課金・アフィリ・複数商品
  - 3: 月300万円 — B2B・SYSTEM・チーム化
  - 4: 月833万円 — 年商1億｜単一収益源30%以下
- Revenue layers
  - 01 EARN — TIME · KNOWLEDGE · MEDIA
  - 02 COMPOUND — COMMUNITY · IP · PRODUCT
  - 03 SCALE — PLACE · SYSTEM · B2B
  - 04 CAPITAL — 株・ETF・不動産等
- Want to Map source sheet
- Wealth / Engine Map source sheet
- 13 Command Center presets

### Legacy shells that showed no unique live data while locked
- Project Map: “同期後に表示します”
- Asset Index: “同期後に表示します”
- Work Map / Flow Board: “認証後にPROJECT / TASKを読み込みます”
- Recent Activity: “同期後に表示します”
- Automation Health: metrics unavailable while locked

## Canonical mapping

| Legacy | Canonical destination |
| --- | --- |
| Project Map | `/dashboard/graph` |
| Want to Map | Want to source Sheet + Graph WANT TO node |
| Asset Index | Drive / Knowledge / Asset Flow canonical assets |
| Work Map / Flow Board | Quest + Calendar |
| Recent Activity | Graph Notes / OS metrics / Evidence |
| Command Center | `/dashboard/os#command-presets` initially; later integrate into command UX |
| Wealth Engine | `/dashboard/os` + source Sheet |

## Source sheets

- Wealth / Engine Map: `https://docs.google.com/spreadsheets/d/1_Z_EmfRaIN5iW8mCBj5PF1Yn8D-zFFQbfw_ko45zVV0/edit`
- Want to Map: `https://docs.google.com/spreadsheets/d/1gkYpIk28ScWY5xlFfkjyyBVa0Cmx3pl_oQuJ5sC8ij4/edit`

## Command presets migrated

1. 今日一番大事なのやって
2. 朝会
3. 今週レビューして
4. 適任に任せて
5. 自律実行で
6. SOURCE INBOXを全部処理して
7. これ資産化して
8. これ処理して
9. これ検証して
10. これXにして
11. 品質優先で
12. 改善TOP3出して
13. SCHEDULE更新して

## Retirement sequence

1. Merge and deploy `/dashboard/os` migration bridge.
2. Verify canonical page is reachable behind dashboard authentication.
3. Retire the Cloudflare Pages project `masa-os-dashboard` so the `pages.dev` URL is no longer used.
4. Do not create a replacement second dashboard.
5. Next phase: redesign the canonical dashboard UX and fold only frequently-used migrated controls into the primary surface.
