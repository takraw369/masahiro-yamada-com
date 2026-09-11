# MASA OS LINE IA — 2026-09-11

Status: Draft / Human Review

## Purpose

MASA OS の LINE 運用を、単発配信画面の追加ではなく「流入 → 登録 → 教育 → 行動 → 商品 → CV」を一貫して扱える顧客フローOSとして設計する。

比較対象:
- Lステップ（2026年時点の公式機能・マニュアル）
- L Message / エルメ（2026年時点の公式マニュアル）
- L Harness / line-harness-oss（現行OSS実装・API・Web UI）

## 1. 比較サマリー

| 領域 | Lステップ | L Message | L Harness | MASA OS 判断 |
| --- | --- | --- | --- | --- |
| 一斉・予約配信 | 強い。絞り込み、管理、配信単位の反応確認 | 強い。管理名、送信者、絞り込み、予約 | 実装済み。broadcasts / segment / schedule | `Send` に統合 |
| ステップ配信 | シナリオ、経過/時刻指定、絞り込み、アクション | ステップ、配信タイミング、分岐、継続 | 実装済み。scenario / steps / 3 delivery modes | `Flow` の中心 |
| 起動トリガー | 友だち追加、回答、タグ、各種アクション | 友だち追加、自動応答、リッチメニュー、フォーム、タグ、QR、CV、予約、商品等 | friend_add / tag_added / manual + IF-THEN基盤 | 起点をFlow上に明示 |
| 条件分岐 | タグ・友だち情報・行動を組み合わせやすい | 配信対象を分けて分岐可能 | APIは tag / metadata 条件、false jump を保持 | UIで未露出の分岐を可視化する |
| タグ / セグメント | 中核機能 | 中核機能 | 実装済み | `Audience` に統合 |
| 友だち管理 | 個別トーク、友だち情報、検索 | 友だちリスト、情報管理、1:1 | friends / metadata / operator chat / inbox | `Audience` + 常設Inbox |
| 自動化 | アクション管理が強い | エルメアクションが多機能の接着剤 | IF-THEN、自動返信、Webhook IN/OUT | `Flow > Automations` |
| リッチメニュー | 条件に応じた切替 | タグ等を起点に切替、タブ対応 | 実装済み | `Assets` |
| フォーム | 回答フォーム + 行動連携 | フォーム + アクション連携 | LIFF forms + metadata | `Assets` |
| 流入計測 | 流入経路、クリック、CV、クロス分析 | QR/流入、友だち分析、CV | tracking links、流入ファネル、CV | `Insights` |
| シナリオ分析 | 配信・反応・分析機能が成熟 | 友だち/配信/流入の分析 | scenario stats / step reach / logs | `Insights > Flow performance` |
| テンプレート | 配信各所から再利用 | 配信各所から再利用 | 実装済み | `Assets` |
| リマインダー | リマインダ配信 | ステップ/スケジュールで対応 | reminder機能あり | `Flow > Reminders` |
| AI操作 | 補助的 | 補助的 | MCP / SDKで自然言語操作が強い | MASA OSの差別化ポイント |
| 複数アカウント | 契約/運用単位に依存 | アカウント単位 | 標準で複数LINEアカウント | Account switcherを共通化 |

## 2. UI比較で採るもの / 採らないもの

### Lステップから採る
- シナリオを「作っただけでは動かない」ことが分かる起動設定の考え方。
- 配信対象・タグ・友だち情報を、メッセージ作成と切り離さずに使えること。
- 配信単位のクリックや反応を、その配信の文脈で確認できること。
- アクションを複数機能から呼び出せる共通概念。

### L Messageから採る
- 左メニューを「メッセージ / 情報管理 / 顧客対応」のように目的で分ける考え方。
- ステップ一覧にフォルダ/管理名を持たせる運用性。
- 友だち追加、自動応答、リッチメニュー、フォーム、タグ、QR、CV、予約、商品などから同じアクションを呼び出す考え方。
- ステップ開始・停止・再開・自動継続を運用者が理解しやすく見せること。

### L Harnessから採る
- API / DB / Cron / SDK / MCP は原則そのままエンジンとして使う。
- scenario list/detail、delivery mode、template、tag、stats、on-reach tag の既存機能。
- AIが scenario / step を自然言語で作れる設計。
- multi-account / inbox / tracking / forms / rich menu / automation の既存資産。

### 採らない
- 20個前後の機能を同じ強さで左ナビに並べること。
- 「機能名を知っている人だけが使える」画面構造。
- Step編集、タグ、分析、流入を別世界として分断すること。
- バックエンド未対応なのに Draft / Publish / Version などをUIだけ先行して作ること。

## 3. MASA OS 正解IA

Global:

`Output > LINE`

LINE Center のローカルナビは6つに絞る。

1. **Overview** — 今日見るもの
   - 友だち増減
   - 未返信 / 要対応
   - 稼働中Flow
   - 次回配信
   - 異常 / 失敗
   - CV / 反応の変化

2. **Send** — 今送る
   - Broadcast
   - Scheduled
   - Segment send
   - Delivery history

3. **Flow** — 自動で動かす
   - Step Flow / Scenario
   - Automations / IF-THEN
   - Auto reply
   - Reminders
   - Trigger/action relationships

4. **Audience** — 誰に送るか
   - Friends
   - Tags
   - Segments
   - Metadata
   - Scoring

5. **Assets** — 何を使うか
   - Templates
   - Rich Menu
   - Forms / LIFF
   - Tracking links / QR

6. **Insights** — 何が効いたか
   - Inflow funnel
   - Broadcast response
   - Step reach / drop-off
   - Click / CV
   - Segment / cohort comparison

`Inbox` は7個目のタブにせず、LINE Centerの常設アクションとして右上に置く。未返信数や長時間放置がある時だけ目立たせる。

## 4. Step Flow Builder V1

### Layout

Desktop:
- 左: Flow timeline / canvas
- 右: 選択中StepのInspector
- 上: Scenario名 / Account / Active status / Test / Save

Mobile:
- timeline優先
- StepタップでInspectorをsheet表示

### Flow node

各Stepで一目で見せるもの:
- `WHEN`: 即時 / N分後 / N日後 / 指定時刻
- `WHO`: 全員 / 条件
- `DO`: Text / Image / Flex / Template / Action
- `AFTER`: タグ付与等
- `RESULT`: 到達数 / 到達率（データがある時だけ）

条件分岐がある場合:

```text
[1日後] 教育メッセージ
        ↓
  purchasedタグあり？
    ├─ YES → 購入者フォロー
    └─ NO  → オファー
```

### Inspector

- Timing
- Audience / Condition
- Message / Template
- Action after reach
- False branch / next step
- Test

APIに存在する conditionType / conditionValue / nextStepOnFalse はUIで扱えるようにする。ただし最初の実装では、現行backend契約を再確認してから保存UIを有効にする。

## 5. MASA OSならではのAI操作

LINE Centerの上部に自然言語Commandを置く。

例:
- 「新規登録から5日間の教育シナリオを作って」
- 「購入タグが付いたらセール案内を止めて」
- 「このFlowで離脱が大きいStepを3つ教えて」
- 「今週クリック率が落ちた配信を改善して」

AIは直接公開/送信せず、原則:

`提案 → 差分表示 → 人間確認 → 適用`

送信・有効化・大量変更は明示確認を維持する。

## 6. Data/API mapping

| MASA OS | L Harness |
| --- | --- |
| Send | broadcasts / schedules / segments |
| Flow | scenarios / scenario_steps / reminders / automation rules |
| Audience | friends / tags / metadata / scoring |
| Assets | templates / richmenus / forms / tracking links |
| Insights | scenario stats / message logs / tracking funnel / conversions |
| Inbox | conversations / operator chat |

既存 `masahiroyamada.com` には `/api/line-harness/[...path]` proxy があるため、別のLINEバックエンドを作らない。

## 7. V2.2 visual direction

V2.1の黒×金はブランドページ寄りで、日常操作では読みにくい。

V2.2は **Warm Light Workbench** とする。

- Page background: warm neutral gray
- Panels: white / off-white
- Primary text: near-black
- Secondary text: medium slate
- Gold: CTA・選択・重要状態だけ
- Border: 明確なneutral gray
- Success / warning / error: goldではなく意味色
- Decorative serif: brand/titleに限定
- 操作UI: sans-serif主体

目的は「SLFらしさを消す」ではなく、ブランド色を情報階層に従属させること。

## 8. Build order

1. V2.2 color/readability preview
2. LINE Center IA visual preview
3. Read-only API connection (accounts / scenarios / stats)
4. Broadcast integration
5. Step Flow CRUD
6. Conditions / branch UI
7. Audience / assets links
8. Insights
9. AI Command → review → apply

## References checked

- Lステップ公式: 2026年全機能一覧、シナリオ配信、アクション管理、流入経路/分析、2026年アップデート
- L Message公式: 2026年チュートリアル、ステップ配信、分岐、友だち追加時開始、タグ/リッチメニュー、友だち管理
- Shudesu/line-harness-oss: README、Scenarios wiki、scenario routes/db/sdk、current web scenario list/detail

Research date: 2026-09-11
