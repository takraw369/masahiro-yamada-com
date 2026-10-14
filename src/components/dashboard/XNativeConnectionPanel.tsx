import { useEffect, useState } from 'react';

type Account = { id: string; username: string; displayName: string; isActive: true };
type Status = 'checking' | 'disabled' | 'connected' | 'unavailable' | 'login_required';

export default function XNativeConnectionPanel() {
  const [status, setStatus] = useState<Status>('checking');
  const [account, setAccount] = useState<Account | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    fetch('/api/dashboard/x-native-accounts', {
      credentials: 'same-origin',
      cache: 'no-store',
      signal: controller.signal,
    })
      .then(async (response) => {
        const body = await response.json().catch(() => null) as {
          success?: boolean; error?: string;
          provider?: string; mode?: string; postingEnabled?: boolean;
          schedulingEnabled?: boolean; data?: Account[];
        } | null;
        if (response.status === 423 && body?.error === 'native_x_read_disabled') {
          setStatus('disabled');
        } else if (response.status === 401) {
          setStatus('login_required');
        } else if (response.ok && body?.success && body.provider === 'x-official'
          && body.mode === 'read_only' && body.postingEnabled === false
          && body.schedulingEnabled === false && Array.isArray(body.data)
          && body.data.length === 1) {
          setAccount(body.data[0]);
          setStatus('connected');
        } else {
          setStatus('unavailable');
        }
      })
      .catch(() => { if (!controller.signal.aborted) setStatus('unavailable'); });
    return () => controller.abort();
  }, []);

  return (
    <section aria-label="X公式API読み取り接続" style={{
      border: '1px solid rgba(37,33,29,.15)', borderRadius: 14,
      padding: '16px 18px', background: '#fff', marginBottom: 18,
    }}>
      <h2 style={{ fontSize: '1rem', margin: '0 0 8px' }}>
        X公式API · 読み取り接続
      </h2>
      <p style={{ margin: 0, lineHeight: 1.6, fontSize: '.86rem', color: '#615951' }} role="status">
        {status === 'checking' && '接続の準備状態を確認中…'}
        {status === 'disabled' && '新接続は準備中です。既存の投稿画面は切り替えていません。'}
        {status === 'login_required' && 'Dashboardへの再ログインが必要です。'}
        {status === 'unavailable' && '読み取り接続を確認できませんでした。既存の投稿画面には影響しません。'}
        {status === 'connected' && account && `読み取り認証を確認：@${account.username}（${account.displayName}）。投稿・予約は未接続です。`}
      </p>
      <p style={{ margin: '9px 0 0', fontSize: '.77rem', color: '#736b61' }}>
        この欄は確認専用です。投稿先の変更・予約・公開は行いません。
      </p>
    </section>
  );
}
