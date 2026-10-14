# Task Pipeline｜Drag & Drop → TASK_BOARD 書き戻しRunbook
更新: 2026-10-14 · 状態: IMPLEMENTED IN PR / SECRET + SHEET EDITOR PERMISSION PENDING

## なぜ単純なドラッグ保存では足りないか
- Google Sheets `MASA_TASK_BOARD｜GPT主導` の `TASKS` タブがTask Statusの正本。
- `os_tasks` / `masa_task_execution_list_v1` / Dashboardは一方向同期の派生表示。
- Supabaseだけ変更すると次回のSheet同期で戻るため禁止。ブラウザ `localStorage` に疑似完了を書き込むことも禁止。
- 旧実装は read-only。Tendraの「ドラッグで列を変える」操作とデータの書き戻しは未実装だった。

## 新しいコード
- `src/pages/dashboard/pipeline.astro` : PCはカード dragstart/drop、スマホ・キーボードは詳細ダイアログの移動先セレクト。成功後にのみ状態変更。
- `src/pages/api/dashboard/task-move.ts` : Dashboard Session + same-origin + request size + status / ID / revision gate。
- `src/lib/taskBoardSheetWriter.ts` : Cloudflare内のSecretを使いGoogle Service Account JWTでGoogle Sheets APIへ直接書込。Task IDで行特定、Revision/Statusをfresh readして不一致なら409。A(Status)/J(Revision+1)/K(Updated at)/L(Updated by)を一括更新、DONE時だけH(Notes)に証跡追記、直後再読で検証。
- GET `/api/dashboard/task-move` は正本のStatus+Revisionを取得してSupabase read modelにオーバーレイ表示（保存元は変えない）。これにより数時間後のSheet→Supabase同期前でも画面で正本の状態を見せられる。
- 同時にSheetを複数ユーザーで編集した場合、Google Sheets自体にCompare-and-Swapがないため「read→write」間のごく短い競合を完全には防げない。厳密な原子性が必要ならApps Script LockServiceや専用Writer RPCが次段階。

## 有効化のためのHuman Gate（このPRだけでは有効化されない）
1. **新しい専用Google Service Account**を作成（既存Sheet Sync runnerのviewer秘密鍵は使い回さない）。Google Sheets APIを有効化し、JSON keyを安全に取得。
2. Google Sheets `MASA_TASK_BOARD｜GPT主導`（Spreadsheet ID: `12GCdg88OfKmyxP4HGikqfKmvxiQBXASvUkkyD4I2svk`）だけ、そのService Accountのメールアドレスへ **編集者** で共有。別のDrive / 他のSheetには権限を与えない。共有はファイル全体の権限なので機密性を考慮。
3. Cloudflare Dashboard → Workers & Pages → `masahiro-yamada-com` → Settings → Variables and Secrets → 新規 **Secret** `GOOGLE_TASK_BOARD_WRITER_JSON` にJSON全文を設定。リポジトリ・チャット・Drive Doc・スクショに private_key を貼らない。ブラウザへ露出させない。変更後はCloudflareの反映状況を確認。
4. `/dashboard/pipeline` にログイン、緑文字で「移動OK…Google Sheetsに保存」→ T####の `NEXT→NOW` など影響の小さいTaskでテスト → Google Sheetの `A/J/K/L` とボードが一致するか読み直す。故意に古いRevisionのPOSTを投げても409となることを確認。
5. `DONE` は完了証跡（12〜1200文字）を入力して保存。失敗時はUIの状態は動かさず、原因を表示。
6. 認証切れ/403/未設定/ネットワーク障害では read-only に退避。秘密鍵はWorkers Secretとして管理・ローテーション。誤って公開された場合は即無効化。

## 公開Gate
- CI / regression / Typecheck / Worker preview / Chromium5幅でPASS。
- Cloudflare Workers SecretとGoogle Sheets編集者権限の用意を確認。
- 認証後の本番データで1件のみ移動し、Google Sheet Task IDとRevisionの読戻しを検証。
- Safari / Brave Desktop / iPhoneでドラッグ、列間移動、詳細セレクト、DONE証跡、エラー表示を評価。
- 明示的なリリース承認と回復可能なリリースバージョン確認後にmasterへマージ。

Task statuses: NOW / NEXT / WAIT / REVIEW / DONE。INBOXは不明ステータスの表示列であり移動先にできない。Source statusが未知の場合は正本を確認する。
