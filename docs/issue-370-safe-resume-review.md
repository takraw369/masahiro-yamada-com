# Creator-First UX：安全な再開の追加改善

対象: Issue #370 / Draft PR [#372](https://github.com/takraw369/masahiro-yamada-com/pull/372)。基準は最新master `9fc4a23`。制作優先のHome、Studio→Post、素材選択後のフォーカスは **#371でマージ済み** のため再実装していません。今回の画面ソースは `eaeea94`（ハッシュは [manifest](reviews/issue-370-resume/manifest.json)）。

## 調査と判断

- Issue #370、#371の実装・既存調査、現行Home/Studio/Flow/Post、開発・モバイル規約、CI契約を確認。repo内のAGENTS.mdはありません。
- #364は同じHome先頭を変更する未マージ案。#325/#345/#366の機能は取り込まず、新しいStudio・DB・生成サービスは追加していません。
- Drive正本のMASA DESIGN INTELLIGENCE、PUBLISHING_FLOW_OS、SELLABLE_BOXを再読。Design Studioのテーマ・構成・お気に入り・明示Applyを維持しています。
- 操作パターン比較は [前回調査の4事例](issue-370-creation-first-ux.md#four-interaction-references-principles-only)を再利用。出力目的から既存エディタへ進む入口、明示的な取り込み、既存構造の再利用、編集内容の保護を選択。新しいテンプレート基盤・自動公開・履歴DBは採用しません。
- Better Designの既存システム維持、hierarchy/accessibility/navigation/errors/formsを参照。公開URL抽出はログイン画面の情報であり、認証後のユーザー設定を上書きする根拠にはしません。SuperdesignはCLI・既存コード解析までで、課金生成は実行していません。

見つけた問題は、Homeに「つづきから」が明示されないこと、教材一覧より素材・空の編集フォームを先に読む構造、保存中に追記まで保存済みになる状態、本文が空なら設計欄や保存済み教材の出典が差し替わること、一覧から消えた出典IDが再保存時にnullになることです。書き出した後も新しい教材へ移れない行き止まりも確認しました。

## 実装

Homeは「つくる」「Drive素材から投稿」「つづきから・教材」の3入口。発信の選択内容は既存の「導線」から開きます。最初の4操作を指摘した文言レビューを受け、重複リンクを除きました。

教材の再開は `?view=drafts#saved-drafts` で保存済みの実データを先に表示し、素材一覧は閉じます。教材を明示選択するまで原稿を読み込みません。通常の新規制作では下書き一覧は折りたたみます。

保存リクエストにはその時点の原稿と版番号を固定。保存中も入力できますが、その後の変更は未保存として残し、次回保存には受信した新しい版番号を使います。連続送信・保存中の別教材/素材への切替を防ぎ、既存409/公開教材更新拒否を維持します。

設計欄や保存済み教材も出典変更ガードの対象にし、現在の一覧にない出典IDも保持。核の差替えと未保存内容を破棄する新規作成は明示確認が必要です。取得エラーには再読み込み、空状態には実際の素材選択ボタンがあります。

認証・既存API・保存先・投稿先選択・ユーザー設定・お気に入り・LINE・決済は変更していません。X編集本文には既存の永続保存がないため、保存済みX下書きとして再開できるとは表示しません。記事・動画・商品企画は既存の制作指示コピーまでで、直接生成やMP4出力を実装済みとは扱いません。

## 操作比較

数え方は前回調査と同じく、意図的なタップ/入力欄へのフォーカスを数え、文字入力・スクロールは別扱いです。今回は#371以降の安全性改善であり、既存の短縮を新規成果として数えていません。

| 作業 | #371以前 → 現行 | 今回の差分（最新master → PR） |
| --- | --- | --- |
| A. Drive素材→X下書き | モデル11→5タップ | 5→5を維持。素材・出典・権利の引継ぎと明示取り込みを実画面で再確認。公開なし。 |
| B. 素材→教材→プレビュー | モデル7→7タップ | 7→7を維持。選択→構成→Markdownプレビューを確認。保存中の追記を未保存として保護。 |
| C. 素材→商品企画→次工程 | モデル5→4タップ | 4→4を維持。素材ID・出典・相手・提供内容・次の一手を含む指示をコピー。商品生成はCodexへ引き継ぐ段階。 |
| 保存済み教材の再開 | — | 2→2タップを維持。保存一覧を前へ移し、390pxの同一合成データ実測で一覧先頭は画面y≈697→246px。初期素材一覧の展開と空フォームの読み飛ばしを不要に。 |
| 保存中に追記→別教材を選ぶ | — | 追記まで保存済みになり切替可能→未保存表示と切替ガード。再保存のexpectedVersionが3→4に進むことを確認。 |
| 下書き取得503 | — | 下書き欄で再試行先が不明→その場で再読み込み→空状態→素材選択へ復帰。 |

モデル値の根拠は [既存3作業ログ](issue-370-creation-first-ux.md#tiny-operator-task-log-390px)。今回の [実行receipt](reviews/issue-370-resume/receipts.json) と [保存/エラー/設定receipt](reviews/issue-370-resume/safety-receipts.json) は合成データによるスクリプト操作で、MASA本人のユーザーテストではありません。

## 表示・品質の確認

- 実際の隔離Astro WorkerをChrome 155/Playwrightで表示。APIデータと認証は合成データのみ。実サービスへの書込・公開なし。
- Home・教材再開を320/375/390/430/1440/1728pxで確認。18状態すべてページ横溢れ0。375/390pxでは「つくる」y≈194px、「つづきから」y≈314pxでスクロール不要。
- 測定した入口操作は44px以上、教材の再開ボタンは約47px。既存の編集入力16pxとIBM Plex Sans JPのロードを確認。キーボードEnterで制作入口を開閉、教材選択で編集見出しへフォーカス。reduced-motion環境で操作。
- 既存Night/Tiles/Soft/Chips/Solidとお気に入りが書き換わらないことを実画面で確認。
- Homeの「導線」を経由してPublishing Flowの素材・相手の選択が復元され、既存保存値が同一であることも確認。[Flow再開receipt](reviews/issue-370-resume/flow-resume.json) / [全幅の編集欄実測](reviews/issue-370-resume/editor-metrics.json)
- Better Design: 最終入口/再開エラーの文言チェックpass。変更範囲のDOM余白測定は390/1440/1728でcompleted、critical 0 / serious 0 / moderate 3。moderateは既存Studioの10/14/18pxと見出し標準余白。既存部品の余白を維持しています。[余白receipt](reviews/issue-370-resume/spacing-review.json)
- 全体の構造・全ウィジェットをBetter Designが承認したとは扱いません。公開HTTPS最終receiptはUNVERIFIED（デプロイ禁止を優先）。

## テストと境界

画面ソース `eaeea94` の [CI 38971578888](https://github.com/takraw369/masahiro-yamada-com/actions/runs/38971578888) 通過。全体533テスト、release-delta型チェック、ビルド、隔離Worker smoke、依存セキュリティ、gitleaksを実施。変更ファイルの型エラー0、既存のリポジトリ型エラー214は未解消です。

ローカルの関連29テスト・ビルド・変更ファイル型チェック・セキュリティも通過。全体ローカル実行は既存macOS Chromium CLIの起動/終了失敗があり、正式な全体結果はLinux CIを参照。UIの実画面確認は別のPlaywright起動で完了しています。依存セキュリティには既存のhttp-cache-semantics例外（期限2026-10-31）があり、新規例外は追加していません。

実機iPhone Safari、支援技術での手動操作、実アカウントのDrive/X/LINE/決済、3秒での理解・片手操作は **UNVERIFIED**。Human Gateはマージ・本番デプロイ・投稿公開・決済・一斉送信・課金APIの前に残します。

## MASAの判断と次フェーズ

- **KEEP**: 既存の4制作カテゴリ・素材引継ぎ・プレビュー・保存/公開の分離。
- **REFINE**: 今回の再開入口と編集保護をiPhone実機で評価。次はX本文の安全な保存・再開を既存保存基盤の範囲で検討。
- **DROP**: 別Studio/DB、未マージ機能の重複、KPI中心の拡張、生成済みと誤認する案内。

## 比較画像

| 状態 | Before（master #371） | After |
| --- | --- | --- |
| Home / 390 | [Before](reviews/issue-370-resume/before-home-390.png) | [After](reviews/issue-370-resume/after-home-390.png) |
| 教材の再開 / 390 | [Before](reviews/issue-370-resume/before-resume-390.png) | [After](reviews/issue-370-resume/after-resume-390.png) |
| 320px / Desktop | — | [Home 320](reviews/issue-370-resume/after-home-320.png) / [教材1440](reviews/issue-370-resume/after-resume-1440.png) |
| 保存中の追記 | — | [未保存を表示](reviews/issue-370-resume/after-concurrent-edit-390.png) |
| 再試行・空状態 | — | [503](reviews/issue-370-resume/after-resume-failure-390.png) / [空状態](reviews/issue-370-resume/after-resume-empty-390.png) |
| 既存のNight設定 | — | [制作入口](reviews/issue-370-resume/after-night-create-390.png) |

全幅・他状態の画像は [証拠フォルダ](reviews/issue-370-resume/)。再開点は [checkpoint](checkpoints/issue-370-safe-resume.md)。
