# Dashboard V2.1 — Daily Command Center / Human Gate

更新日: 2026-09-11 · Draft PR #79 · 隔離プレビュー: `/dashboard/ui-v2`

## Purpose

MASAがDashboardを開いて5秒以内に「今どこを動かすか」と実行先を判断できること。

Dashboardはリンク集ではなく、View → Decide → Act → Verify → Learn を短くする操作面とする。機能数を見せることではなく、判断コストを下げることを優先する。

本PRはHuman Review用の隔離プレビュー。canonical `/dashboard`、auth、middleware、Supabase、Cloudflare production、DNSは変更しない。merge / deploy / public publishは別のHuman Gate。

## V2.1で変えたこと

### 1. Todayは「正解」ではなく「候補」を出す

現行DashboardのSocial Growth Sprint方針から、`既存素材を1本、投稿文にする` をNext Move候補として表示する。

ただし現在の完了状況・期限・市場反応を自動判定していないため、画面上で `NEXT MOVE · PROPOSAL` / `CURRENT STATE 未連携` と明示する。固定文をライブ優先順位に見せない。

### 2. 前面を4ドアに限定

通常ナビで常時見せるのは以下のみ。

- Today — 今やること
- Capture — 残す
- Output — 出す
- Review — 見る

 specialized tools は `MORE TOOLS` の一段下へ置く。ユーザーが機能名を覚えるより、「今やりたいこと」から入れることを優先する。

### 3. HomeのQuick Startは3入口

- Capture — 思いつき・メモ・URLを残す
- Output — 投稿文をつくる
- Review — 保存した情報を読み返す

投稿予定やVoice、Graph、Evidence、Treasury等は重要だが、毎回同じ強さで前面には出さない。

### 4. Other candidatesは折り畳む

- Idea → Asset → Reuse
- ACE｜実利用 E2E

を「ほかの候補」に移動。複数のPROJECT説明を最初から読み込ませない。

### 5. Migrated MASA OSをExtendedへ接続

旧 `masa-os-dashboard.pages.dev` から救出した Wealth / Command 資産は canonical `/dashboard/os` に存在する。V2.1では `MORE TOOLS > ASSETS > MASA OS / Wealth` から到達可能にする。

旧Pagesは第二のDashboardとして復活させない。

## Information architecture

### Level 1 — Daily

1. Next Move candidate
2. Capture
3. Output
4. Review

### Level 2 — More Tools

- OPERATE — Voice / Content Schedule
- CREATE — Visual Prompt / Trinity Funnel
- THINK — Evidence / Graph
- BUILD — 0→9 Flow / Quest / Lian
- ASSETS — Treasury / Investment / Wish List / MASA OS

この分類はSource of Truthではなく、人間向けの操作入口。各データの正本は既存Drive / Supabase / Calendar等を維持する。

## Non-negotiables

- No fake live state.
- One dominant primary CTA per state.
- Existing Waterways First.
- One Role, One Primary.
- Active surfaceを小さく保ち、Extended / Labを通常UIから一段下げる。
- Mobileでも最初の画面から主操作へ届く。
- Black / warm-black / restrained gold / sharp geometryを維持する。

## Human Review

確認するのは主に次の5点。

1. 5秒で「候補」と「実行先」が分かるか。
2. 固定候補をライブ状態と誤認しないか。
3. Capture / Output / Review の3入口で日常利用の大半が足りるか。
4. MORE TOOLSへ下げた機能に迷わず到達できるか。
5. Desktop / Mobile / keyboardで操作が崩れないか。

## Next integration gate

Human ReviewでV2.1のIAを採用する場合のみ、最新masterへ同期し、Calendar / Distribution等の採用済みレーンを再確認してから canonical `/dashboard` への移植差分を作る。

NEXT ACTION / CURRENT STATEをライブ化する場合は、先に読み取り元・鮮度・失敗時fallbackを定義する。新しいDB/APIを先に増やさない。
