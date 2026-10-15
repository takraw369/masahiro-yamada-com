import { useEffect, useState } from 'react';
import { parseNativeXReadResponse } from '../../lib/xNativeReadPolicy';
import { X_ACCOUNT_PLAYBOOKS } from '../../lib/xAccountPlaybook';

type Account = { id: string; username: string; displayName: string; isActive: true };
const messages = {
  checking: '読み取り接続を確認中…',
  disabled: '読み取り接続は無効です。有効化には設定とデプロイの承認が必要です。',
  login_required: 'Dashboardへの再ログインが必要です。',
  token_required: '読み取り用の認証が未設定です。Xアカウントの認可が必要です。',
  oauth_required: 'Xの認証が無効または期限切れです。アカウントの再認可が必要です。',
  permission_required: 'Xの読み取り権限を確認してください。',
  throttled: 'Xの利用制限に達しました。時間をおいて再確認してください。',
  timeout: '接続に時間がかかっています。時間をおいて再確認してください。',
  unavailable: '読み取り接続を確認できませんでした。時間をおいて再確認してください。',
  connected: '',
};
type Status = keyof typeof messages;

export default function XNativeConnectionPanel() {
  const [status, setStatus] = useState<Status>('checking');
  const [account, setAccount] = useState<Account | null>(null);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    let disposed = false;
    const timer = setTimeout(() => controller.abort(), 12000);
    setStatus('checking'); setAccount(null);
    fetch('/api/dashboard/x-native-accounts', {
      credentials: 'same-origin', cache: 'no-store', signal: controller.signal,
    }).then(async response => {
      const raw: unknown = await response.json().catch(() => null);
      if (disposed) return;
      const safe = response.ok ? parseNativeXReadResponse(raw) : null;
      const code = raw && typeof raw === 'object' && 'error' in raw ? raw.error : null;
      if (safe) { setAccount(safe.data[0]); setStatus('connected'); }
      else if (response.status === 401) setStatus('login_required');
      else if (code === 'native_x_read_disabled') setStatus('disabled');
      else if (code === 'missing_x_access_token') setStatus('token_required');
      else if (code === 'x_401') setStatus('oauth_required');
      else if (code === 'x_403') setStatus('permission_required');
      else if (code === 'x_429') setStatus('throttled');
      else if (code === 'x_timeout') setStatus('timeout');
      else setStatus('unavailable');
    }).catch(() => { if (!disposed) setStatus(controller.signal.aborted ? 'timeout' : 'unavailable'); })
      .finally(() => clearTimeout(timer));
    return () => { disposed = true; clearTimeout(timer); controller.abort(); };
  }, [attempt]);

  const matchingBrand = account && X_ACCOUNT_PLAYBOOKS.find(item => item.username.toLowerCase() === account.username.toLowerCase());
  return (
    <section aria-label="X公式API読み取り接続" style={{
      border: '1px solid rgba(37,33,29,.15)', borderRadius: 14,
      padding: '16px 18px', background: '#fff', marginBottom: 18,
    }}>
      <h2 style={{ fontSize: '1rem', margin: '0 0 8px' }}>X公式API · 読み取り接続</h2>
      <p style={{ margin: 0, lineHeight: 1.6, fontSize: '.86rem', color: '#615951' }} role="status">
        {status === 'connected' && account
          ? `読み取り認証を確認：@${account.username}（${account.displayName}）。投稿・予約は未接続です。`
          : messages[status]}
      </p>
      {account && !matchingBrand && <p role="alert">認証されたアカウントは4ブランドの対象外です。接続設定を確認してください。</p>}
      <p style={{ margin: '9px 0', fontSize: '.77rem', color: '#736b61' }}>
        対象：{X_ACCOUNT_PLAYBOOKS.map(item => `@${item.username}`).join(' / ')}。ブランド方針の確定とOAuth接続は別です。
      </p>
      <p style={{ margin: '9px 0', fontSize: '.77rem', color: '#736b61' }}>
        この欄は確認専用です。投稿先の変更・予約・公開は行いません。
      </p>
      <button type="button" disabled={status === 'checking'} onClick={() => setAttempt(value => value + 1)} style={{ minHeight: 44, padding: '8px 12px' }}>
        接続を再確認
      </button>
    </section>
  );
}
