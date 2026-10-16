// This is a closed vocabulary. Never put a provider error/body or exception in a URL or notice.
export const xOAuthReadNotices = {
  connected: '読み取り専用の接続を保存しました。',
  cancelled: 'Xで認可がキャンセルされました。',
  expired: '認可の確認期限が切れました。接続ボタンからやり直してください。',
  failed: '読み取りを確認できませんでした。表示された文言を管理者に伝えてください。',
  identity_mismatch: 'ブランドとXアカウントが一致しません。対象アカウントでXにログインし直してください。',
  configuration_required: '接続設定を確認する必要があります。管理者の確認後に接続ボタンからやり直してください。',
  exchange_failed: 'Xが認可の確認を受け付けませんでした。接続ボタンからやり直し、再発する場合は管理者に伝えてください。',
  exchange_unavailable: 'Xとの認可の確認に接続できませんでした。しばらく待って接続ボタンからやり直してください。',
  exchange_timeout: 'Xとの認可の確認が時間切れになりました。接続ボタンからやり直してください。',
  token_invalid: 'Xからの認可の応答を確認できませんでした。管理者の確認が必要です。',
  scope_mismatch: '読み取り専用として認可を確認できなかったため、接続を止めました。管理者の確認が必要です。',
  account_unauthorized: '認可後にXアカウントを読み取れませんでした。接続ボタンから再認可してください。',
  account_payment_required: 'Xがアカウントの読み取りに利用料金の確認を求めています。管理者がX Developerの利用状況を確認してください。',
  account_forbidden: 'Xがアカウントの読み取りを許可していません。管理者がX Developerのアカウント情報の利用設定を確認してください。',
  rate_limited: 'Xの利用制限で接続を確認できませんでした。しばらく待って接続ボタンからやり直してください。',
  account_timeout: 'Xアカウントの読み取りが時間切れになりました。しばらく待って接続ボタンからやり直してください。',
  account_read_failed: '認可後のXアカウントの読み取りを確認できませんでした。管理者の確認が必要です。',
  storage_failed: '接続情報の保存を確認できませんでした。管理者が保存先を確認してから再認可してください。',
  service_unavailable: '接続処理から応答を受け取れませんでした。管理者の確認後に接続ボタンからやり直してください。',
  verification_failed: '接続の確認結果が一致しなかったため、完了にしていません。管理者の確認が必要です。',
} as const;

export type XOAuthReadNotice = keyof typeof xOAuthReadNotices;
export function xOAuthReadNotice(value: string): string {
  return Object.hasOwn(xOAuthReadNotices, value) ? xOAuthReadNotices[value as XOAuthReadNotice] : '';
}

const failures: Record<string, XOAuthReadNotice> = {
  x_oauth_identity_mismatch: 'identity_mismatch',
  x_oauth_disabled: 'configuration_required',
  x_oauth_configuration_required: 'configuration_required',
  x_oauth_storage_configuration_required: 'configuration_required',
  x_oauth_target_not_enabled: 'configuration_required',
  x_oauth_invalid_request: 'configuration_required',
  x_oauth_exchange_failed: 'exchange_failed',
  x_oauth_exchange_unavailable: 'exchange_unavailable',
  x_oauth_exchange_timeout: 'exchange_timeout',
  x_oauth_token_invalid: 'token_invalid',
  x_oauth_scope_mismatch: 'scope_mismatch',
  x_401: 'account_unauthorized',
  x_402: 'account_payment_required',
  x_403: 'account_forbidden',
  x_429: 'rate_limited',
  x_oauth_rate_limited: 'rate_limited',
  x_timeout: 'account_timeout',
  x_native_account_invalid: 'account_read_failed',
  x_oauth_account_read_failed: 'account_read_failed',
  x_oauth_storage_failed: 'storage_failed',
  x_oauth_connection_conflict: 'storage_failed',
};
export function xOAuthReadFailure(raw: unknown): XOAuthReadNotice {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return 'failed';
  const result = raw as Record<string, unknown>;
  return result.success === false && typeof result.error === 'string' && Object.hasOwn(failures, result.error)
    ? failures[result.error] : 'failed';
}
