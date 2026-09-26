# Coconala Revenue Agent v1

Updated: 2026-09-21
Mission: T0087 / AI Venture Studio / AI-only first revenue

## Purpose

「AIが作業を代行する」ではなく、人間の継続対応を増やさずに最初の売上を作る。

Mission 001 のボトルネックは商品制作ではなく、通常のスキルマーケットが公開後も問い合わせ・個別対応・納品を要求しやすいこと。v1では、既存のサービス4「AI言語化・行動設計セッション」を自己完結型コンテンツに変換し、Coconala Contents Marketを主レーンにする。

## First Product

Working title:

> 考えすぎて動けない人のための AI言語化→7日行動設計ワークブック

商品は診断ではなく、本人が自分の情報をAIとの対話で整理し、仮説と次の行動を作るためのセルフワーク。

Package:

- 7ステップ質問
- 強み・関心・価値観の仮説整理シート
- 仕事・活動候補を広げるAIプロンプト
- 自己紹介・キャッチコピー生成プロンプト
- 7日間アクションプラン
- AI出力検証チェックリスト
- 商品説明文
- サンプル
- 表紙コピー

## Closed Loop

1. SOURCE — Driveの既存資産から商品候補を抽出 / AI_RUN
2. PACKAGE — 商品本文・テンプレ・プロンプト・画像指示を組む / AI_RUN
3. QA — 誇大表現・矛盾・不足・規約リスクをチェック / AI_RUN
4. PUBLISH — Preview確認後に公開 / MASA_GATE
5. SELL — 決済とコンテンツ受け渡し / PLATFORM_AUTO
6. SIGNAL — 販売通知・売上記録をEvidenceへ戻す / AI_RUN
7. LEARN — Copy / Price / Productの順で改善仮説を作る / AI_RUN
8. MATERIAL CHANGE — 価格・公開状態・規約例外だけMASA_GATE

## Human Gate Budget

通常運用の目標は「売れるたびに人間が動かない」。

Human Gateは以下のみ:

- 初回公開
- 大幅な価格変更
- 公開停止/再開
- 規約解釈に不確実性がある変更

問い合わせ対応・個別ヒアリング・個別制作・手動納品は商品仕様から除外する。

## Signal Strategy

Coconalaからの通知メールを最初のEvent Sensor候補とする。ただし、現時点のGmailには購入通知の実例がないため、件名を固定実装しない。

First sale時:

1. 通知メールをEvidence化
2. 実際の件名・送信元・本文パターンを保存
3. Transactional / Promotion / Unknown の分類ルールを更新
4. 2件以上で安定したら自動分類へ昇格

## Optimizer

観測順は以下。

- 露出なし → Title / Category / Thumbnail hypothesis
- 閲覧あり・販売なし → Promise / Preview / Price hypothesis
- 販売あり → Productを維持し、関連する別資産を商品化候補へ
- 返金・低評価Signal → 自動拡張停止、品質レビューへ

変更は一度に1変数。48–168時間のSignal windowを残す。

## Guardrails

- 外部連絡・外部決済へ誘導しない
- 適職・性格・健康等を断定診断しない
- 成果保証をしない
- 存在しない実績や統計値を生成しない
- 同一商品の重複出品で露出を水増ししない
- 購入者情報を商品改善以外の目的へ流用しない
- 公式導線がない状態でCoconala UIを破壊的に自動操作しない

## Success Metrics

Phase 0: Package READY
Phase 1: 1 product LIVE
Phase 2: first unattended sale > ¥0
Phase 3: 3 unattended sales
Phase 4: gross profit > monthly agent/tool cost
Phase 5: second product generated from existing assets

Primary KPI: unattended gross profit
Secondary KPI: Human minutes / sale
Safety KPI: policy exception count = 0

## Architecture Principle

Browser automationを主役にしない。売り場側で自動販売できる商品形式を選ぶことで、UI操作そのものを減らす。

AI = Source / Package / QA / Learn
Coconala = Checkout / Delivery
MASA = Publish / Exception
Drive = Canonical asset
Dashboard = Control / Evidence

これにより「自動化率を上げるためにBotを増やす」のではなく、「人間が必要な工程そのものを削除する」。
