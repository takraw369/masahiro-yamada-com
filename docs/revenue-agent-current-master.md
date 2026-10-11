# First Product Revenue Mission — current master reconstruction

Updated: 2026-10-04 (Asia/Tokyo)

## Goal and source of truth

既存資産 → 商品化 → QA → Human Gate → 販売 → Signal → Learning を、既存の Dashboard / FLOW Board / MASA OS に接続する。完成条件は、MASA が `/dashboard` を開くと First Product の残作業と次の一手が分かり、AI が共有された状態から作業を再開できること。機能数や画面数は成果指標にしない。

作業開始時に取得した参照:

| Reference | Inspected SHA | Use |
| --- | --- | --- |
| `origin/master` | `c2bc8846cfe6b7c029483c5a818040ddbfb420ee` | 実装の基点。FLOW Board の共有・編集機能を含む |
| PR [#172](https://github.com/takraw369/masahiro-yamada-com/pull/172) | `ca3e567ceb796fb4c7ebb01471fe7767f7b4d62e` | 旧 Revenue Agent の価値を監査する参考資料 |
| PR [#219](https://github.com/takraw369/masahiro-yamada-com/pull/219) | `c9c3da4e7818aaec41bab1321008549357883cc3` | Publishing Flow の境界を監査する参考資料 |

この SHA は監査の記録であり、将来の再開時に master を固定する指示ではない。再開時は repository → live remote branch/PR/runtime → この checkpoint → 最小の検証可能な一手、の順に確認する。#172 は merge/rebase/cherry-pick で一括移植しない。#219 の head は、監査した master の祖先ではない。

## Legacy #172 classification

分類はファイル全体を一括採用する意味ではない。同じファイルにある価値と問題を分け、UNIQUE VALUE のみ現在の構造へ再実装する。

| #172 file | UNIQUE VALUE | CURRENT MASTER ALREADY HAS | OBSOLETE | SHOULD NOT BE PORTED |
| --- | --- | --- | --- | --- |
| `docs/coconala-revenue-agent-v1.md` | First Product 仮説、自己完結した PDF / worksheet / prompt pack、AI / Marketplace / MASA の担当分担、販売ごとの手作業を不要にする設計、禁止事項、実売の根拠から学ぶ方針 | Drive 正本 / Dashboard 操作面 / Evidence へ戻す構想。`board.astro` の PRODUCT OS / DISTRIBUTION OS / ASSET FLOW、既存 Evidence API | 2026-09-21 の固定実装順と、現在の Project に未照合の `T0087` を運用上の確定 ID とする扱い | 第二商品、推薦・最適化基盤への拡張、Gmail detector 本番有効化。実売の証拠がない自動化率や収益目標の達成表示 |
| `src/lib/coconalaRevenueAgent.ts` | 必要な状態語彙、First Product の説明、AI_RUN / PLATFORM_AUTO / MASA_GATE の役割、ガードレール | 既存 owner/auth、Supabase helper、FLOW Board の共有 snapshot と revision、Evidence の記録方式 | `automationCoverage()` / `humanGateCount()` による作業数の比率。文字列の `sourceAsset` を選定・検証済み資産とみなすこと | 無条件 `nextStage()`、READY 根拠なしの昇格、`requiresHumanGate()` が初回公開しか扱わない設計、重大変更を確認せず `LEARN → LIVE` へ戻す規則 |
| `src/pages/dashboard/coconala-agent.astro` | 商品の約束・構成物、販売までの流れ、Human Gate を理解できる説明 | `DashboardLayout`、`DashboardCockpit`、共有 FLOW Board、Evidence Lab、Content Flow | 静的 NEXT BUILD と 75% / 手順数 / ¥1 の説明用メトリクス。現在の残作業を示さない表示 | 独立した Revenue 専用ページと専用 Dashboard。設定値だけから販売準備状況を示す UI |
| `src/pages/dashboard/index.astro` | Revenue Mission を既存 Dashboard から発見できる入口 | 現在の Dashboard の cockpit、deepDoors、OUTPUT、FLOW ナビゲーション | 古い並びへの deepDoors 1 行追加のみでは「開けば残作業が分かる」を満たさない | 古い Dashboard 全体の移植・置換。隠れたリンクだけで完了扱いすること |
| `tests/coconala-revenue-agent.test.mjs` | 販売・納品のたびに MASA の手作業を要求しない契約 | 既存 dashboard regression、auth/security の検証基盤 | 作業数が 75% 以上なら良いとするテスト、helper の happy path のみの確認 | `LEARN → LIVE` を無条件に保証するテスト、判定 helper の戻り値だけで Human Gate や READY の安全性を証明したとする扱い |

実装では、未充足の READY 条件、不正な状態遷移、公開・重大変更の Human Gate、販売・納品・学習の Evidence、保存競合、認証境界、外部自動公開が存在しない契約を検証する。既存テストの期待値を都合よく緩めない。

## One First Product

**考えすぎて動けない人のための AI言語化 → 7日行動設計ワークブック**

- Format hypothesis: PDF、worksheet / template、AI prompt pack。
- Customer problem hypothesis: 考えがまとまらず、次に何をするか選べない。
- Promise hypothesis: 曖昧な悩みを AI との対話で「仮説」「選択肢」「次の7日間の行動」へ整理する。
- これはセルフワークであり、適職・性格・健康などの診断商品ではない。
- Source asset: **未確認**。#172 の「既存サービス4」は候補の説明であり、現行 Drive / MASA_OS の資産 ID・URL・内容を確認した証拠ではない。架空の source URL や完成した本文を初期値として作らない。
- Price: 仮説として明示する。価格が確定・承認済みであると推定しない。

READY の判断には、source reference、title、customer problem、promise、main content、worksheet、prompt pack、sample / preview、product description、cover / thumbnail brief、QA、policy / exaggerated-claim check、price hypothesis、Publish Human Gate の準備を使う。資産そのものは Drive / MASA_OS に置き、Control Plane は参照と作業状態を扱う。タイトルだけやチェック済み表示だけで本文完成を推定しない。

実装上の `READY_TO_PUBLISH` は、14項目の準備・レビュー記録と MASA の公開判断記録が揃った状態。外部公開済み・自動公開許可済みを意味しない。QA 段階で不足を確認し、MASA が判断記録を残してから READY へ進む。

## Architecture decision

| Role | Existing surface / authority |
| --- | --- |
| Knowledge / product asset canonical | Drive / MASA_OS。Source、商品本文、worksheet、prompt pack、preview、QA の参照先 |
| Control Plane | 既存 `/dashboard` 内の `RevenueMission`。残作業、現在地、次の一手を表示 |
| Human + AI shared working surface | 既存 FLOW Board `main` scene の安定 ID `revenue-first-product` node。その `revenueMission` property に Revenue の制御 metadata を保持 |
| Source / Package / QA / Learn | AI が共有状態を読み、正本を参照して作業する |
| Checkout / delivery | Marketplace。Dashboard から payment / delivery を実行しない |
| Sales / delivery / learning evidence | 既存 `/dashboard/evidence` と `/api/dashboard/evidence`。Mission から既存 Evidence の ID・参照を関連付ける |
| Publish / exceptions / material decisions | MASA の Human Gate |

新しい Revenue database、Dashboard、Agent OS、canonical document system、API endpoint、Supabase schema、依存 package は作らない。既存 board POST に Revenue metadata の server-side validation を加える。RevenueMission は独立ページにしない。FLOW Board 本体の全面改修もしない。

現在の main scene には、`N021` PRODUCT OS、`N023` DISTRIBUTION OS、`N027` ASSET FLOW、`N030` REVENUE IDEAS がある。`withRevenueMission()` は N021 / N027 が存在する時だけ Mission への `supports` edge を追加する。他の node、edge、viewport、未知の metadata を保存時に落とさない。共通の初期盤面は `src/lib/flowBoard.ts` の `createFlowBoardSnapshot()` を再利用する。

状態の基本線は次のとおり。

```text
ASSET_SOURCE → PACKAGE → QA → READY_TO_PUBLISH → LIVE → SALE_DETECTED → DELIVERED → LEARN
                         MASA の判断記録が必要 ↑     ↑ 実際の公開証跡と human actor が必要
```

状態名は実績の証拠ではない。LIVE には公開 URL と公開証跡、SALE_DETECTED には実売の証跡、DELIVERED には受け渡しの証跡、LEARN には学習の証跡を必須とする。次の仮説・作業は `nextAction` に記録できる。購入通知だけから納品完了を自動推定しない。

PAUSED は実装しない。公開後の商品・価格・QA・規約確認・公開判断・公開 URL / 証跡はこの Control Plane で変更しない。学習後の重大変更や停止 / 再開は、MASA が販売先と正本を確認する別の Human Gate に残す。無条件の `LEARN → LIVE` も設けない。

### Shared mission schema v1

型の正本は `src/lib/revenueMission.ts`。Mission は単一 node の `revenueMission` object であり、`version: 1` を持つ flat schema。`version` 以外は文字列で、`state` は上記8状態のいずれか。未知の property・別 node ID・重複 Mission は validation error とする。

| Fields | Meaning |
| --- | --- |
| `sourceAsset`, `title`, `customerProblem`, `promise` | 選定資産の参照、商品名、課題、約束 |
| `mainContent`, `worksheet`, `promptPack`, `preview` | 商品構成物・購入前サンプルの正本参照 |
| `description`, `coverBrief`, `priceHypothesis` | 商品説明、表紙指示、価格仮説 |
| `qa`, `policy`, `publishGate` | 実物レビュー、規約 / 誇大表現確認、MASA の公開判断記録 |
| `liveUrl`, `liveEvidence`, `saleSignal`, `deliveryEvidence`, `learning` | 販売ページ URL と、公開・実売・納品・学習の証跡参照 |
| `nextAction` | AI が継続する次の作業 |

`createRevenueMission()` は `ASSET_SOURCE`、First Product の仮説3項目と残りの空欄を生成する。実在する source / artifact / evidence を初期値にしない。`getRevenueMission()` で読み、`updateRevenueFields()` で変更、`transitionRevenueMission()` で遷移を検証し、`withRevenueMission()` で既存 snapshot に戻す。API の `validateRevenueBoardUpdate()` はサーバーで前後を比較するため、ブラウザ UI を迂回した保存も同じ制約を受ける。

Package のいずれかを変更すると `qa` / `policy` / `publishGate` が空欄になる。QA / policy の変更でも publishGate は空欄になる。商品を先に保存し、改めてレビュー記録・人の判断記録を保存する。QA / READY から商品見直しへ戻れるが、状態を飛ばして LIVE などへ進めない。

## Publishing Flow #219 boundary

#219 の変更範囲は `dashboardCockpits.ts`、`content-flow.astro`、`dashboard/index.astro`、`post.astro`、`publishing-flow-contract.test.mjs` の5ファイル。Journey → What → Where / CTA → When → Create → Result を表示し、Drive の CONTENT_OS / DISTRIBUTION_OS と既存 Content Schedule に接続する。

保存は `masa-publishing-flow-v2` の localStorage overlay、旧キーは `masa-content-flow-v1`、X 下書き handoff は `masa-publishing-handoff-v1`。X composer への受け渡しは明示的なクリックと `masa:x-compose` event で行う。テストはページに API / fetch による公開処理を持たない契約を確認している。Revenue 用の共有 storage や reusable component が提供されているわけではない。

今回取り込むのは「既存正本への参照」「現在地と次の一手」「明示的な受け渡し」という考え方のみ。#219 のコード、localStorage store、学習リスト、X scaffold を二重実装しない。`/dashboard/content-flow` は既存の発信準備先として参照できるが、Revenue の READY / Publish Gate / Evidence は #219 の merge を前提としない。

将来の接続点は商品タイトル・対象者の課題・promise・source reference と、明示的に渡したい作業内容。Publishing Flow が Revenue の正本になったり、商品公開や X 投稿を自動承認したりする設計にしない。

## Human Gate and guardrails

MASA が確認する事項:

- Marketplace への初回公開。商品一式、preview、商品説明、価格、QA、規約上の不確実性を確認する。
- 価格の重大変更。
- 公開停止 / 再開。
- 規約解釈が不明確な変更。
- Payment、contract acceptance、destructive external action。

Human Gate の記録は実際の人の判断の記録であり、AI が同意したと補完しない。チェックや状態保存は Marketplace 上の操作を実行する許可ではない。通常販売・納品は Marketplace が担う。毎回 MASA に手動納品を要求する商品仕様を持ち込まない。

維持する禁止事項:

- 外部決済誘導。
- 不必要な外部連絡誘導。
- 適職・性格・健康等の断定診断。
- 成果保証。
- 架空実績・架空統計。
- 重複商品による露出水増し。
- Buyer data の目的外利用。

Coconala browser bot、自動 Marketplace 公開、Gmail sales detector の本番有効化、payment integration、scheduler、Drive 正本の自動変更、第二商品、recommendation engine、analytics platform は今回の範囲外。販売通知の送信者・件名パターンも実例なしに固定しない。

## AI resume and existing API contract

最初に作業 branch / PR と最新 master、モデルの型・validation、実際の shared board を読み直す。チャット履歴の状態をそのまま保存しない。既存認証を通じた同一 origin のリクエストを使う。Dashboard cookie、owner key、Supabase credential を checkpoint やコードへ書き出さない。

### Read the shared scene

`GET /api/dashboard/board?scene=main` の成功形:

```json
{
  "ok": true,
  "data": {
    "sceneKey": "main",
    "snapshot": { "nodes": [], "edges": [], "viewport": { "x": 0, "y": 0, "zoom": 1 } },
    "revision": 0,
    "updatedBy": null,
    "updatedAt": null
  }
}
```

この空配列は API の未保存 scene の例であり、既存 board を空で上書きする指示ではない。保存済み scene は返された snapshot 全体を保持する。`revision: 0` は未保存を表す。読取り失敗の `503 board_read_unavailable` を空の本番 state と扱わない。`revenue-first-product` が見つからなければ、未初期化として source が未確認の最初の作業を提示する。

### Save with compare-and-swap

既存 board API への保存形:

```json
{
  "sceneKey": "main",
  "snapshot": "<fresh GET の snapshot 全体に、許可された Mission の変更のみを適用した object>",
  "expectedRevision": 12,
  "actor": "ai"
}
```

上の `snapshot` の文字列は説明用 placeholder。実際には `nodes` と `edges` を含む object を送る。`12` も例であり、必ず直前に GET した整数 revision を使う。

1. `revenue-first-product` node の `revenueMission` を、現在のコードにある型・validation・遷移規則で扱う。未知の schema を推測して修復しない。新規作成時は `ASSET_SOURCE` から始める。
2. 他の node / edge / viewport と未知の metadata を保持する。Mission の表示名やメモの編集で metadata を消さない。
3. `POST /api/dashboard/board` に `Content-Type: application/json`、全 snapshot、`expectedRevision`、実際の actor を送る。AI は `actor: "ai"` とし、人の判断を偽装しない。
4. `409 revision_conflict` は GET からやり直す。最新内容と意図した小さい差分を比較し、他者の変更を保持して再検証する。revision を省略・null にして競合を回避しない。失敗した snapshot を盲目的に再送しない。
5. `503 board_write_unavailable`、認証エラー、validation error のときは未保存と表示する。保存成功を推定しない。成功 response の revision を受け取り、必要な read-back で実際の保存内容を確認する。

既存 API は scene key、snapshot shape と実 body サイズを検査し、最大 220,000 bytes / 500 nodes / 1500 edges を受け付ける。`main` の POST は `expectedRevision` に非負の safe integer を必須とし、省略・null は `400 expected_revision_required`。まず現在の snapshot / revision を読み、metadata と前後の遷移を検証し、その後も既存 save RPC の CAS で同時更新を保護する。Revenue の別 scene への配置、重複、削除は受け付けない。非 human actor が publishGate を記入したり LIVE へ進めたりすることは拒否する。

owner key はサーバーの `getDashboardOwnerKey()` が解決し、既存 RPC の trusted-owner check を使う。API の `actor` は操作の出所を示す文字列であり、人の承認を暗号学的に証明する仕組みではない。汎用 board editor の metadata を外部公開権限として扱わない。

### Evidence and next action

`GET /api/dashboard/evidence` は `{ ok, items }` を返す。`POST /api/dashboard/evidence` は `title` / `body` を必須とし、既存の `sourceKind`、`sourceUrl`、`evidenceType`、`evidenceQuality`、`tags`、`metadata`、`dedupeKey`、`occurredAt` を利用できる。成功時の `{ ok: true, item }` にある実際の `item.id` を `/dashboard/evidence#<item.id>` の参照文字列にする。既存 Evidence ID や販売・納品事実を生成しない。buyer の不要な個人情報を記録しない。

`liveEvidence` / `saleSignal` / `deliveryEvidence` / `learning` は既存 Evidence の参照、または HTTPS の `drive.google.com` / `docs.google.com` の証跡 URL を受け付ける。URL の形式検証は内容や実在の検証ではない。人または AI は記録の内容を確認してから参照を登録し、未確認の URL だけで売上・納品を断定しない。

AI は未充足条件と実際の canonical reference から、最小の次作業を選ぶ。Package 変更時は既存 QA / policy check / Human Gate がなお有効か確認し、古い承認で新版を READY / LIVE とみなさない。価格・公開状態・規約判断を含む変更は提案として準備し、Human Gate に残す。

この PR 作業中は production Supabase mutation、外部公開、merge、production deploy を行わない。将来の承認済み運用を説明する API 契約は、今回の production 書込みを許可するものではない。

## Resume checkpoint

- Goal / acceptance: 1商品について Dashboard から残作業・次の一手・READY / Human Gate を判断でき、AI が同じ FLOW Board の状態を再読して継続できる。Draft PR で停止する。
- Current state: `feat/revenue-agent-current-master` を現行 master `c2bc8846cfe6b7c029483c5a818040ddbfb420ee` から隔離 checkout `/private/tmp/revenue-agent-20261004/work/masahiro-yamada-com` で実装。2026-10-05 の fetch でも `origin/master` は同じ SHA で、他作業との差分・rebase はない。旧 `/Users/hondod20/Projects/masahiro-yamada-revenue-20261004` では編集しない。ローカル一時パスを正本とせず、再開時は remote / PR の最新状態を確認する。
- Completed: #172 の指定5ファイルを4分類し、#219 の境界を確認。Dashboard の RevenueMission、shared FLOW Board node/CAS validation、Evidence permalink、READY/遷移/Human Gate model、focused tests を実装。ローカル模擬 storage で Dashboard 保存 r1、Board focus、Evidence missing-reference 表示を確認。
- Open / dependencies: remote branch と Draft PR を作成し、GitHub CI を確認する。production runtime / production data は意図的に変更・検証しない。
- Relevant files: この文書、`src/lib/revenueMission.ts`、`src/lib/flowBoard.ts`、`src/components/dashboard/RevenueMission.tsx`、`src/styles/revenue-mission.css`、`src/pages/dashboard/index.astro`、`src/pages/dashboard/board.astro`、`src/pages/api/dashboard/board.ts`、`src/pages/api/dashboard/evidence.ts`、`src/lib/siteStorage.ts`、`src/middleware.ts`。最終的な model / component / tests は branch の diff を正とする。
- Verification: focused Revenue **46 / 46 PASS**、変更後 full suite **199 / 199 PASS**、production build PASS、isolated Worker preview smoke PASS、dependency security gate PASS（期限付き既知例外 `http-cache-semantics` / GHSA-ch52-4w7c-c8xp）、`git diff --check` PASS。Release-delta typecheck は変更10ファイルの diagnostics **0 / PASS**。Full typecheck は **204 existing errors** で終了し、変更前257 errorsのうち Evidence Lab の既存53 errorsを解消した。ローカル browser UI / synthetic Supabase read-write は確認済み。Production runtime / production Supabase は **UNVERIFIED**（意図的に mutation / deploy しない）。
- Next smallest verifiable engineering action: remote branch を push し、Draft PR の CI receipt を確認する。
- Next One Action for MASA: **Drive / MASA_OS からこのワークブックの元になる既存資産を1つ選び、その正本 URL を Mission に登録する。**
- Human Gate: Draft PR の review。その後の merge・production deploy・Marketplace 初回公開・production データ変更は別の明示的な判断。今回の作業では実行しない。
