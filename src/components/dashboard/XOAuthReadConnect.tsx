import { useEffect, useState } from 'react';
import { X_ACCOUNT_PLAYBOOKS } from '../../lib/xAccountPlaybook';
import { parseNativeXReadResponse } from '../../lib/xNativeReadPolicy';

type Connection = { target: string; userId: string; username: string; connectedAt: string; verifiedAt: string; expiresAt: string; status: 'connected' | 'expired' | 'reauthorization_required' };
type Proof = { username: string; id: string; verifiedAt: string };
const results: Record<string, string> = {
  connected: '読み取り専用の接続を保存しました。',
  cancelled: 'Xで認可がキャンセルされました。',
  expired: '認可の確認期限が切れました。最初からやり直してください。',
  failed: '読み取りを確認できませんでした。接続設定を確認してやり直してください。',
  identity_mismatch: 'ブランドとXアカウントが一致しません。対象アカウントでXにログインし直してください。',
};
const statusLabels = { connected: '接続済み', expired: '期限切れ · 再認可が必要', reauthorization_required: '再認可が必要' };
const time = (value: string) => new Date(value).toLocaleString('ja-JP', { timeZone: 'Asia/Tokyo' });
const control = { minHeight: 44, padding: '8px 12px', font: 'inherit', maxWidth: '100%' };
export default function XOAuthReadConnect() {
  const [available, setAvailable] = useState(false);
  const [persist, setPersist] = useState(false);
  const [enabled, setEnabled] = useState<string[]>([]);
  const [connections, setConnections] = useState<Connection[]>([]);
  const [now, setNow] = useState(Date.now());
  const [checking, setChecking] = useState(true);
  const [busy, setBusy] = useState('');
  const [confirmDisconnect, setConfirmDisconnect] = useState('');
  const [notice, setNotice] = useState('');
  const [proof, setProof] = useState<Proof | null>(null);
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 30000);
    return () => clearInterval(timer);
  }, []);
  useEffect(() => {
    const controller = new AbortController();
    let disposed = false;
    const timer = setTimeout(() => controller.abort(), 12000);
    setChecking(true);
    fetch('/api/dashboard/x-oauth/status', { credentials: 'same-origin', cache: 'no-store', signal: controller.signal })
      .then(async response => {
        const raw = await response.json();
        if (disposed) return;
        setAvailable(response.ok && raw.available === true && Array.isArray(raw.connections));
        setPersist(raw.persistenceConfigured === true);
        setEnabled(Array.isArray(raw.enabledTargets) ? raw.enabledTargets : []);
        setConnections(response.ok && Array.isArray(raw.connections) ? raw.connections : []);
        const result = new URLSearchParams(window.location.search).get('x_oauth') || '';
        const receipt = response.ok ? parseNativeXReadResponse(raw.receipt) : null;
        if (receipt && raw.receipt.proof === 'oauth_callback' && raw.receipt.tokenStored === false && typeof raw.receipt.verifiedAt === 'string' && !results[result]) {
          setProof({ id: receipt.data[0].id, username: receipt.data[0].username, verifiedAt: raw.receipt.verifiedAt });
        }
        if (!attempt) setNotice(response.status === 401 ? 'Dashboardに再ログインしてください。' : results[result] || '');
      }).catch(() => { if (!disposed) { setAvailable(false); setNotice('接続状態を確認できませんでした。「状態を再取得」でやり直してください。'); } })
      .finally(() => { clearTimeout(timer); if (!disposed) setChecking(false); });
    return () => { disposed = true; clearTimeout(timer); controller.abort(); };
  }, [attempt]);
  async function begin(target: string) {
    if (busy || !available || !enabled.includes(target)) return;
    setBusy(target); setNotice(''); setProof(null); setConfirmDisconnect('');
    try {
      const response = await fetch('/api/dashboard/x-oauth/start', {
        method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ target }), signal: AbortSignal.timeout(12000),
      });
      const raw = await response.json();
      if (!response.ok || typeof raw.authorizeUrl !== 'string') throw new Error();
      const url = new URL(raw.authorizeUrl);
      if (url.origin !== 'https://x.com' || url.pathname !== '/i/oauth2/authorize') throw new Error();
      window.location.assign(url.href);
    } catch { setNotice('認可を開始できませんでした。接続設定を確認してからやり直してください。'); setBusy(''); }
  }
  async function action(target: string, operation: 'recheck' | 'disconnect') {
    if (busy) return;
    setBusy(target); setNotice(operation === 'disconnect' ? `@${target}の保存済み接続を解除中…` : `@${target}の読み取りを確認中…`);
    try {
      const response = await fetch(`/api/dashboard/x-oauth/${operation}`, { method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ target }), signal: AbortSignal.timeout(15000) });
      const raw = await response.json();
      if (!response.ok || raw.success !== true || !Array.isArray(raw.connections)) throw new Error();
      setConnections(raw.connections);
      setNotice(operation === 'disconnect' ? `@${target}の保存済み接続を解除しました。X側の連携許可は残ります。` : `@${target}の読み取り接続を再確認しました。`);
    } catch { setNotice(operation === 'disconnect' ? '接続を解除できませんでした。状態を再取得してからやり直してください。' : '読み取りを再確認できませんでした。期限切れの場合は再認可してください。'); setAttempt(value => value + 1); }
    finally { setBusy(''); setConfirmDisconnect(''); }
  }
  return (
    <section id="x-oauth-read" aria-labelledby="x-oauth-heading" style={{ border: '1px solid rgba(37,33,29,.15)', borderRadius: 14, padding: 16, background: '#fff', marginBottom: 16 }}>
      <h2 id="x-oauth-heading" style={{ fontSize: '1rem', margin: '0 0 8px' }}>Xアカウント接続</h2>
      <p style={{ margin: '0 0 16px', lineHeight: 1.7 }}>まず@MASAHIRO_501だけを読み取り専用で確認します。各ブランドは別々に認可します。</p>
      {checking && <p role="status">接続状態を確認中…</p>}
      {!checking && !available && <p role="status">運用設定の確認待ちです。設定とデプロイの承認後に接続できます。</p>}
      {!checking && available && !persist && <p role="status">現在は10分間の本人確認のみです。接続の保存にはCloudflare設定の承認が必要です。</p>}
      {notice && <p role="status" aria-live="polite" style={{ lineHeight: 1.7 }}>{notice}</p>}
      <div style={{ display: 'grid', gap: 16 }}>
        {X_ACCOUNT_PLAYBOOKS.map(item => {
          const connection = connections.find(row => row.target === item.username);
          const status = connection?.status === 'connected' && Date.parse(connection.expiresAt) <= now ? 'expired' : connection?.status;
          const active = status === 'connected';
          const allowed = enabled.includes(item.username);
          return <article key={item.username} aria-label={`@${item.username}の接続`} style={{ borderTop: '1px solid rgba(37,33,29,.15)', paddingTop: 16, minWidth: 0 }}>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px 16px', alignItems: 'baseline', justifyContent: 'space-between' }}>
              <h3 style={{ fontSize: '.95rem', margin: 0, fontWeight: 500 }}>{item.name} <span style={{ display: 'inline-block', overflowWrap: 'anywhere' }}>@{item.username}</span></h3>
              <span>{status ? statusLabels[status] : checking ? '確認中' : !available ? '状態未確認' : '未接続'}</span>
            </div>
            {connection && <p style={{ margin: '8px 0', lineHeight: 1.7, overflowWrap: 'anywhere' }}>XユーザーID：{connection.userId}<br />最終確認：{time(connection.verifiedAt)}（日本時間）<br />有効期限：{time(connection.expiresAt)}（日本時間）</p>}
            {!allowed && !checking && <p style={{ margin: '8px 0', color: '#615951' }}>@MASAHIRO_501の検証完了後に有効化します。</p>}
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 8 }}>
              {(!connection || !active) && <button type="button" onClick={() => void begin(item.username)} disabled={checking || !available || !allowed || !!busy} style={control} aria-label={`@${item.username} ${connection ? 'を再認可' : 'を接続'}`}>{busy === item.username ? '処理中…' : connection ? 'Xで再認可' : 'Xアカウントを接続'}</button>}
              {connection && <>
                {active && <button type="button" style={control} disabled={checking || !!busy} onClick={() => void action(item.username, 'recheck')}>読み取りを再確認</button>}
                <button type="button" style={control} disabled={checking || !!busy} onClick={() => setConfirmDisconnect(item.username)}>保存済み接続を解除</button>
              </>}
            </div>
            {confirmDisconnect === item.username && <div style={{ marginTop: 8 }}>
              <p style={{ lineHeight: 1.7 }}>Dashboard内の接続だけを解除します。X側の許可はXの「設定 → セキュリティとアカウントアクセス → アプリとセッション → 連携しているアプリ」で解除できます。</p>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}><button type="button" style={control} disabled={!!busy} onClick={() => void action(item.username, 'disconnect')}>この接続を解除する</button><button type="button" style={control} disabled={!!busy} onClick={() => setConfirmDisconnect('')}>キャンセル</button></div>
            </div>}
          </article>;
        })}
      </div>
      {proof && <p role="status">一時的な読み取りを確認：@{proof.username}／XユーザーID {proof.id}（{time(proof.verifiedAt)}）。接続は保存していません。</p>}
      <p style={{ lineHeight: 1.7, margin: '16px 0 8px', color: '#615951' }}>投稿・予約・ダイレクトメッセージの権限は要求しません。保存する場合、認証情報はCloudflare側で暗号化します。自動更新は行わず、有効期限後は再認可が必要です。</p>
      <button type="button" style={control} disabled={checking || !!busy} onClick={() => { setNotice(''); setAttempt(value => value + 1); }}>状態を再取得</button>
    </section>
  );
}
