export type XConnectionIssue = { message: string; retryLabel: string };

// Display only our own messages; upstream errors can contain private details.
export function getXConnectionIssue(status = 0, body: unknown = null): XConnectionIssue {
  const code = body && typeof body === 'object' && 'error' in body ? body.error : null;
  if (status === 503 && code === 'upstream_unavailable') {
    return { message: '接続設定が未完了です。本文は編集できます。', retryLabel: '接続を確認' };
  }
  if (status === 401 && code === 'unauthorized') {
    return { message: 'ログイン状態を確認してください。本文はコピーできます。', retryLabel: '再確認' };
  }
  if (status === 401) {
    return { message: 'X連携の認証を確認してください。本文は編集できます。', retryLabel: '接続を確認' };
  }
  if (status === 403) {
    return { message: '接続の利用権限を確認してください。本文は編集できます。', retryLabel: '再確認' };
  }
  if (status === 504) {
    return { message: '接続に時間がかかっています。本文は編集できます。', retryLabel: '再読み込み' };
  }
  return { message: '接続できませんでした。本文は編集できます。', retryLabel: '再読み込み' };
}
