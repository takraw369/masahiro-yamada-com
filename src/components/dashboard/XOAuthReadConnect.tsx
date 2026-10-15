import { useEffect, useState } from 'react';
import { X_ACCOUNT_PLAYBOOKS } from '../../lib/xAccountPlaybook';
import { parseNativeXReadResponse } from '../../lib/xNativeReadPolicy';

type Proof = { username: string; id: string; verifiedAt: string };
const results: Record<string, string> = {
  cancelled: 'Xで認可がキャンセルされました。',
  expired: '認可の確認期限が切れました。最初からやり直してください。',
  failed: '読み取りを確認できませんでした。接続設定を確認してやり直してください。',
  identity_mismatch: '選んだブランドとXのアカウントが一致しません。正しいアカウントでやり直してください。',
};
export default function XOAuthReadConnect() {
  const [target, setTarget] = useState('MASAHIRO_501');
  const [available, setAvailable] = useState(false);
  const [checking, setChecking] = useState(true);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState('');
  const [proof, setProof] = useState<Proof | null>(null);
  useEffect(() => {
    const controller = new AbortController();
    fetch('/api/dashboard/x-oauth/status', { credentials: 'same-origin', cache: 'no-store', signal: controller.signal })
      .then(async response => {
        const raw = await response.json();
        if (controller.signal.aborted) return;
        setAvailable(response.ok && raw.available === true);
        const result = new URLSearchParams(window.location.search).get('x_oauth') || '';
        const receipt = response.ok ? parseNativeXReadResponse(raw.receipt) : null;
        if (receipt && raw.receipt.proof === 'oauth_callback' && raw.receipt.tokenStored === false && typeof raw.receipt.verifiedAt === 'string' && !results[result]) {
          setProof({ id: receipt.data[0].id, username: receipt.data[0].username, verifiedAt: raw.receipt.verifiedAt });
        }
        setNotice(response.status === 401 ? 'Dashboardに再ログインしてください。' : results[result] || '');
      }).catch(() => { if (!controller.signal.aborted) setNotice('認可の準備状態を確認できませんでした。'); })
      .finally(() => { if (!controller.signal.aborted) setChecking(false); });
    return () => controller.abort();
  }, []);
  async function begin() {
    if (busy || !available) return;
    setBusy(true); setNotice(''); setProof(null);
    try {
      const response = await fetch('/api/dashboard/x-oauth/start', {
        method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ target }),
      });
      const raw = await response.json();
      if (!response.ok || typeof raw.authorizeUrl !== 'string') throw new Error();
      const url = new URL(raw.authorizeUrl);
      if (url.origin !== 'https://x.com' || url.pathname !== '/i/oauth2/authorize') throw new Error();
      window.location.assign(url.href);
    } catch { setNotice('認可を開始できませんでした。接続設定を確認してください。'); setBusy(false); }
  }
  return (
    <section id="x-oauth-read" aria-label="Xの本人確認" style={{ border: '1px solid rgba(37,33,29,.15)', borderRadius: 14, padding: 16, background: '#fff', marginBottom: 16 }}>
      <h2 style={{ fontSize: '1rem', margin: '0 0 8px' }}>Xで読み取りを確認する</h2>
      <p>まず1アカウントだけを確認します。Xの画面で、選んだアカウントの読み取りを許可してください。</p>
      <label htmlFor="x-oauth-target">確認するブランド</label>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, margin: '8px 0' }}>
        <select id="x-oauth-target" value={target} disabled={busy} onChange={event => { setTarget(event.target.value); setProof(null); }} style={{ minHeight: 44, maxWidth: '100%', font: 'inherit' }}>
          {X_ACCOUNT_PLAYBOOKS.map(item => <option key={item.username} value={item.username}>{item.name} · @{item.username}</option>)}
        </select>
        <button type="button" onClick={() => void begin()} disabled={checking || !available || busy} style={{ minHeight: 44, padding: '8px 12px', font: 'inherit' }}>
          {busy ? 'Xへ移動中…' : 'Xで読み取りを許可'}
        </button>
      </div>
      {checking && <p role="status">認可の準備状態を確認中…</p>}
      {!checking && !available && <p role="status">運用設定の確認待ちです。設定とデプロイの承認後に利用できます。</p>}
      {notice && <p role="alert">{notice}</p>}
      {proof && <p role="status">認可時の読み取りを確認：@{proof.username}／XユーザーID {proof.id}（{new Date(proof.verifiedAt).toLocaleString('ja-JP')}）。</p>}
      <p>投稿・予約の権限は要求しません。認証トークンを保存しないため、継続接続にはなりません。確認結果は10分で消えます。</p>
    </section>
  );
}
