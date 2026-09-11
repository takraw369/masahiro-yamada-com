# Dashboard V2 — Daily Command Center / Human Gate

更新日: 2026-09-11 · Draft PR #79 · 隔離プレビュー: `/dashboard/ui-v2`

目的は、MASAが開いて5秒以内に「今、何をすればいいか」と実行先を判断できること。
本PRはレビュー用のUI改善であり、canonical `/dashboard` の置換、merge、deploy、公開を行わない。

UX判断とHuman Reviewの引き継ぎ正本は、MASA_OS / 20_PROJECTS / PJT-037の[Drive資料](https://docs.google.com/document/d/15XSoehxura2FvJIHA4jybWDxM5OLfKL3XRwkBGA3uAY/edit)。ChatGPTは判断・レビュー整理を、Codexは実装・実ブラウザー検証・PR更新を担当する。本ファイルはPRに対応する技術記録。

## 1. Before → After

| 項目 | Before | After |
| --- | --- | --- |
| 最初の判断 | 大きな問いかけと、公開・会話・提案の3段階を同時表示 | 「既存素材を1本、投稿文にする」と1つのCTA |
| CTA | 「X Postを開く」。到着後の作業を読み解く必要がある | 「投稿画面を開く」。直前に要点を1つ選ぶと示す |
| Capture | 「声で残す」が顧客Voiceの管理画面へ遷移 | メモ・URLをIntelligenceの既存入力欄へ直接案内 |
| Active Loops | 上部と重なるSocial、ACE、Ideaを常時展開しNOW等を表示 | Socialは上部に集約。再利用候補を1つ示し、ACEの背景は折り畳む |
| Quick Start | 同じ強さの4枚がモバイルで縦に連なる | 控えめな4入口。CaptureとThinkは入力欄・一覧に分ける |
| 詳細 | Workspacesと設計思想を常時表示 | 理由・Capture補足・他の仕事を必要時だけ開く |
| 導線の意味 | Calendar、Voice、Questの名称から機能を誤認し得る | 投稿予定、顧客の声、学習テーマとして実装に合わせる |

この提案は現行Dashboardにある固定方針を参照したUI上の提案であり、当日の進捗から計算した優先順位ではない。
出典と自動更新されないことを画面に示し、未接続の状態を実績として表示しない。

## 2. Fresh Readで見つかったUX上の問題点

- 最初の画面に戦略の説明と複数の仕事が入り、着手する1操作が埋もれていた。
- Socialの手順がNEXT ACTIONとACTIVE LOOPSに重複し、同じ判断を繰り返していた。
- Voice Inboxは顧客フィードバックの閲覧・分類・更新画面。「声で残す」は録音・新規登録を期待させる。
- `/dashboard/quest` は固定学習テーマとブラウザー内進捗。My ACEの実利用E2Eへの導線ではない。
- このブランチの `/dashboard/schedule` は投稿用ContentScheduler。「Calendar」は個人予定との接続を誤認させる。
- 固定のNOW / ALWAYSバッジは最新状態に見えるが、進捗・期限・実行履歴の連携がない。
- 目的別ナビ、Quick Start、Workspaces、Quick Jumpが重なり、名称だけでは違いが伝わりにくかった。
- 狭い画面でCTAが初期画面から外れ、薄い小文字のコントラスト不足があった。Mobileの非表示ナビはTabで到達でき、Escape・フォーカス復帰の制御がなかった。

導線の確認元:

| 確認した実装 | 確認できた契約 |
| --- | --- |
| `src/pages/dashboard/index.astro` | Social / ACE / Ideaの方針は固定テキスト |
| `src/pages/dashboard/intelligence.astro` | `#intel-form` に入力、`#intel-list` に一覧。タイトルのみ必須 |
| `src/pages/api/dashboard/intelligence.ts` | 既存の作成処理と、SNS / AI種・Evidenceへの操作 |
| `src/pages/dashboard/voice.astro` / `src/pages/api/dashboard/voice.ts` | 顧客Voiceの一覧・既存IDを指定した更新 |
| `src/components/dashboard/QuestBoard.tsx` | 固定学習テーマ、`quest-done` のlocalStorage保存 |
| `src/components/dashboard/XCommandCenter.tsx` | 投稿文の入力と明示的な投稿操作。下書き保存機能はない |
| `src/pages/dashboard/schedule.astro` | ContentSchedulerを表示。Calendar統合ではない |

## 3. 今回直したもの

NEXT ACTIONの主語を具体的な作業にし、強いCTAを1つに絞った。公開後の会話・提案は「理由・その先」へ移した。
黒・金と角のある形を保ち、本文の読みやすさ、操作対象の大きさ、キーボードでの見つけやすさを優先する。
Workspacesを閉じて初期画面を短くし、モバイルでも主操作を先に見せる。

### Capture / Quick Startの契約

| 入口 | 作業 | 既存の行き先 |
| --- | --- | --- |
| CAPTURE | メモ・URLを残す | `/dashboard/intelligence#intel-form` |
| THINK | 保存した情報を読む | `/dashboard/intelligence#intel-list` |
| CREATE | 投稿文を作る | `/dashboard/post` |
| TIME | 投稿予定を見る | `/dashboard/schedule` |

トップバーのCaptureは、Quick StartのCAPTUREと同じ入力欄への近道。別の保存先や5つ目の仕事を作らない。
CAPTUREとTHINKは同じIntelligenceでも、追加と閲覧という異なる作業を既存アンカーで分ける。
CREATEとNEXT ACTIONは同じ投稿画面へ進む。CREATEは自分で仕事を選ぶ際の汎用入口として静かに残し、主CTAと競わせない。
Quick Jumpでは同じ行き先の重複を除く。

Captureの保存先はIntelligence Feedの既存手動入力。汎用録音Inboxや架空のAPIを追加していない。
タイトルだけで追加でき、URL・メモは任意。音声は端末側の音声入力で文字にする使い方を案内する。
録音ファイルの取り込み、文字起こしAPI、自動AI処理は未対応。後から既存のSNS / AI種・Evidence化へつなげる。
今回の作業では、入力送信・公開操作・canonicalデータの書き込みは行わない。

### Active Loopsと情報構造の判断

Active Loopsは固定の再開候補として扱う。SocialはNEXT ACTIONに集約し、Idea → Asset → Reuseから「使える素材を1つ選ぶ」を示す。
期限・完了状況による自動選定やライブのバッジは付けない。ACEの方針は保持し、実利用先が未接続であることを詳細に示す。

NOW / CREATE / THINK / BUILD / ASSETSの5分類は維持する。日々の着手、発信、情報、成長・事業、資産という目的は分けられるため、分類自体の変更より末端の意味を正す。
NOWの「Voice Inbox」は顧客の声、「Calendar」は投稿予定として案内する。Questは学習テーマとして扱う。
NOW以外のナビ群は初期状態で折り畳む。Mobileナビをnative dialogにし、閉じたリンクをTab順から外す。Escape・フォーカス復帰・背景スクロール抑止・画面幅切替時の復帰を確認する。
この変更はV2の表示上の整理。canonicalナビや既存ページの機能・所属は変更しない。

## 4. あえて直さなかったもの

- canonical `/dashboard` と `DashboardLayout.astro` の置換、auth / middleware、production deploy config。
- Calendar / Distribution integration、Supabase migration、secrets、DNS、public publish。
- PR #44 / #66 / #76が扱う共有部分。採用が確定していない導線は先取りしない。
- 現在の進捗・期限・ブロッカーからNEXT ACTIONを決める仕組み。信頼できる読み取り元と選定ルールが必要。
- ACE実利用への接続。学習用Questを代用せず、正しいMy ACE / Action / progressの接続先を別途確認する。
- 汎用Capture Inbox、録音アップロード、自動AI処理、件数・アラート・公開済み表示。
- 既存の遷移先画面のフォーム、保存方式、エラー処理の改修。今回の検証は導線の確認まで。

## 5. Human Reviewで見るべき5項目

1. **5秒で着手できるか。** 初回表示で「既存素材を1本、投稿文にする」とCTAを言い当てられるか。Desktop / Mobileの双方で確認する。
2. **Captureが期待どおりか。** トップバーとCAPTUREが同じ既存入力欄に着き、THINKは一覧に着くか。録音保存や自動AI処理を期待させないか。実データを送信せず確認する。
3. **候補を状態と誤認しないか。** 固定の提案・再利用候補と分かるか。ACEの詳細が学習Questへの誤った誘導になっていないか。
4. **4入口とナビが迷わせないか。** CREATEの控えめな重複は役立つか。TIMEは投稿予定、Voiceは顧客の声と理解でき、必要な詳細だけ開けるか。
5. **操作と可読性が保たれるか。** 狭い画面と拡大表示、Tab / Shift+Tab / Enter / Escape、メニュー・行き先ダイアログのフォーカス復帰、reduced-motion設定を確認する。

## 6. canonical Dashboardへ昇格する場合の次ステップ

1. このDraftのHuman Reviewを完了し、主操作・Captureの保存先・ナビの意味を合意する。レビュー後も本PRを自動でmergeしない。
2. PR #44 / #66 / #76の採用済み変更を基準に差分を再確認する。Calendar / Distribution / releaseの実際の契約と競合範囲を確認してから統合案を作る。
3. NEXT ACTIONとACTIVE LOOPSの読み取り元を定義する。canonicalデータから次に触る項目を選ぶ条件、更新時刻、空・失敗・古いデータ時の表示を決め、偽の状態を作らない。
4. ACE実利用の正しい接続先とCaptureの保存・人間の確認・AI処理の責任範囲を確認する。汎用Inboxが必要なら別の変更として設計する。
5. 採用済みの基準上でcanonical移植の具体的な差分を作り、回帰確認を行う。canonical昇格・merge・deployは別途明示的な承認を得て実施する。

## 検証記録

認証付きlocalhostの隔離Workerで検証。実サービスの資格情報を使わず、合成テスト用セッションのみ使用した。既存の起動スクリプト・auth・middlewareは変更していない。

| 検証 | 結果・証跡 |
| --- | --- |
| Desktop / Mobile | Chromium: 1440×1000 / 1024×768 / 768×1024 / 390×844 / 320×568。すべて横はみ出しなし、主CTAとCaptureが初期表示内 |
| CTA位置 Before → After | 390px幅: 上端795px → 379px。320px幅: 上端855px → 403px（下端451px、568pxの画面内） |
| 初期ページ高さ Before → After | 1440px幅: 2156px → 1138px。390px幅: 3843px → 1403px。情報を追加せず開示を段階化 |
| キーボード / dialogs | Skip link、Tab / Shift+Tab、Enter / Space、Escape、⌘K / Ctrl+K、focus復帰、閉じたナビのTab除外、幅切替時の閉鎖、modal多重起動防止が通過 |
| アクセシビリティ | axe WCAG 2 A/AA・2.1 AA・2.2 AA: 5幅とも違反0。Mobileナビ・Quick Jump・詳細展開時も0。変更前は各幅でcontrast違反9ノード |
| reduced-motion / reflow | 動画・transitionのdurationが0。720pxのCSS viewport（1440px表示の200%相当）＋詳細展開で横はみ出しなし。実機Safari/VoiceOverはHuman Reviewで確認 |
| 既存アンカー | Captureは実在する `#intel-form` と必須title欄、Thinkは `#intel-list` に到達。入力送信・公開・非GETリクエストなし。ブラウザーのpageerrorなし |
| `npm test` | 63 / 63 PASS |
| `npm run typecheck:release` | Before / AfterともPASS。全体の既存エラー368件 → 368件、V2変更ファイルのエラー0件。全体typecheckがcleanになったという意味ではない |
| `npm run build` | PASS。Production Worker artifact configのroutes / compatibility / ASSETS / DB確認もPASS |
| `npm run test:preview` | ローカルで2回とも既定のreadiness待ち時間を超過。起動後の独立した認証付きブラウザー検証12項目はPASS。PR CIの結果はPRに記録する |
| 変更範囲 | PR全体はV2 shell / V2 route / 本docの3ファイルのみ。#44 `4d116e7` / #66 `71d0fa6` / #76 `f897c83` の変更パスと直接重複なし |

依存インストールはディスク空き容量不足（ENOSPC）で中断。今回作った未完了node_modulesだけを除去し、package-lock.jsonが一致する既存環境をローカル検証に再利用した。依存・lockfile・設定の変更なし。PR CIは独立した `npm ci` で確認する。

5秒で理解できるかはHuman Reviewの判定事項。自動検査の合格を、実ユーザーでの確認済みとは扱わない。

最終受け渡し: DraftのままHuman Gateへ。merge / deploy / public publishは行わない。
