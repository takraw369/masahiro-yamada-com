# X接続の復旧

投稿画面は本サイトの認証済みproxyから既存のX Harnessへ接続する。
接続障害時も本文の編集・コピーを利用できる。復旧確認では投稿や予約を実行しない。

## 設定の確認

- 本サイトWorker: `masahiro-yamada-com`
- URL設定: `X_HARNESS_URL`（正本は `wrangler.toml`）
- 本サイトのSecret名: `X_HARNESS_API_KEY`
- 上流Worker: `x-harness-worker`、既存Secret名: `API_KEY`

認証済みproxyが `503 upstream_unavailable` を返す場合、URLまたはキーが不足・無効。
HTTP 401の `unauthorized` は本サイトのセッションを確認する。
上流の `Unauthorized` はX Harnessの認証キーを確認する。
502/504は通信・応答・タイムアウトを確認する。503だけで原因を決めつけない。

Secret一覧は名前の確認に使えるが、登録済みの値は読み戻せない。
既存キーの保管元を確認し、値をチャット、ログ、Drive、Gitへ出力しない。
キーを見つけられない場合は保管場所をMASAに確認する。推測や上流キーの変更で代用しない。

## 既存キーの再登録

1. 保管元の既存キーで、設定先の `GET /api/x-accounts` と `GET /api/posts/scheduled` が成功することを確認する。値・Authorizationヘッダー・本文などの私的データをログに出さない。
2. 本サイトWorkerに、同じ既存キーを `X_HARNESS_API_KEY` として登録する。CloudflareのWorker設定「Variables and Secrets」または本リポジトリの認証済みWrangler対話入力を使う。

   ```sh
   npx wrangler secret put X_HARNESS_API_KEY --name masahiro-yamada-com
   ```

   値をコマンド引数やシェル履歴に入れない。Secret登録は本番の新バージョンを作成・デプロイするため、対象名と現在の本番リビジョンを先に確認する。
3. 認証済み `/dashboard/post` の「接続を確認」を押す。アカウントと予約一覧の両方が読み込めることを確認する。
4. 編集中の本文が残っていること、接続先が選べること、送信前の確認が利用可能になることを確認する。投稿・予約ボタンは押さない。
5. 名前のみのSecret確認、読み取りのHTTPステータス、確認した本番リビジョン、未検証項目を引継ぎに保存する。

上流の `API_KEY` を変更すると他の利用元も影響を受ける。変更が必要な場合は利用元を洗い出し、MASAの承認と切替手順を用意する。

公式手順: [Cloudflare Workers Secrets](https://developers.cloudflare.com/workers/configuration/secrets/)
