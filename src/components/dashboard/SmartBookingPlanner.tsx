import { useEffect, useMemo, useState } from 'react';
import {
  CLIENT_AREAS, LOCATION_CHOICES,
  suggestBookingCandidates,
  type CalendarBusyEvent, type CalendarSync, type ClientArea, type SessionMode,
} from '../../lib/smartBooking';

type CalendarResponse = {
  ok: boolean;
  events?: CalendarBusyEvent[];
  sync?: CalendarSync | null;
  error?: string;
};
const formatLabels: Record<SessionMode, string> = {
  online: 'オンライン（個室）',
  premium: 'プレミアム対面（ホテルラウンジ）',
  in_person: '通常対面（会議室）',
};
const formatter = new Intl.DateTimeFormat('ja-JP', {
  timeZone: 'Asia/Tokyo', month: 'numeric', day: 'numeric',
  weekday: 'short', hour: '2-digit', minute: '2-digit', hour12: false,
});
const hm = new Intl.DateTimeFormat('ja-JP', { timeZone: 'Asia/Tokyo', hour: '2-digit', minute: '2-digit', hour12: false });

export default function SmartBookingPlanner() {
  const [mode, setMode] = useState<SessionMode>('online');
  const [clientArea, setClientArea] = useState<ClientArea>('kunitachi');
  const [events, setEvents] = useState<CalendarBusyEvent[]>([]);
  const [sync, setSync] = useState<CalendarSync | null>(null);
  const [asOf, setAsOf] = useState(new Date().toISOString());
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState('');
  const [verifying, setVerifying] = useState('');
  const [checked, setChecked] = useState<Record<string, string>>({});

  async function refresh() {
    setBusy(true);
    setError('');
    const now = new Date();
    const end = new Date(now.getTime() + 15 * 24 * 60 * 60 * 1000);
    try {
      const response = await fetch('/api/dashboard/calendar?from=' + encodeURIComponent(now.toISOString())
        + '&to=' + encodeURIComponent(end.toISOString()), { cache: 'no-store' });
      const data = await response.json() as CalendarResponse;
      if (!response.ok || !data.ok || !Array.isArray(data.events)) throw new Error(data.error || 'calendar_unavailable');
      setEvents(data.events);
      setSync(data.sync || null);
      setAsOf(now.toISOString());
    } catch {
      setError('予定を確認できません。Googleカレンダー同期・ログインを確認してください。');
      setEvents([]);
      setSync(null);
    } finally {
      setBusy(false);
    }
  }
  async function liveCheck(start: string, end: string, locationId: string) {
    const key = start + locationId;
    setVerifying(key);
    setChecked(prev => ({ ...prev, [key]: '照合中…' }));
    const venue = LOCATION_CHOICES.find(x => x.id === locationId);
    const route = mode !== 'online' && clientArea !== 'other' && venue?.area !== 'other';
    try {
      const response = await fetch('/api/dashboard/booking/verify', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          start, end,
          fromArea: route ? clientArea : undefined,
          toArea: route ? venue?.area : undefined,
        }),
        cache: 'no-store',
      });
      const result = await response.json() as {
        ok?: boolean; free?: boolean; calendarCount?: number; transit?: { durationMinutes: number } | null;
      };
      const message = !response.ok || !result.ok ? '確認不可：連携設定・権限の確認が必要'
        : !result.free ? '予定が重複：この枠は使えません'
        : 'Google Calendar ' + (result.calendarCount || 0) + '件を照合：時間上は候補'
          + (result.transit ? '／駅間の公共交通 ' + result.transit.durationMinutes + '分（参考）' : '')
          + '。会場未確認のため予約確約不可';
      setChecked(prev => ({ ...prev, [key]: message }));
    } catch {
      setChecked(prev => ({ ...prev, [key]: '照合に失敗しました。予約不可' }));
    } finally { setVerifying(''); }
  }
  useEffect(() => { void refresh(); }, []);
  const result = useMemo(() => suggestBookingCandidates({
    events, sync, mode, clientArea, now: asOf, days: 14, maxResults: 30,
    allCalendarsVerified: false,
  }), [events, sync, mode, clientArea, asOf]);

  return (
    <main style={{ maxWidth: 1080, margin: '0 auto', padding: '20px 0 70px', lineHeight: 1.7 }}>
      <div style={{ color: 'var(--gold-muted)', fontSize: 12, letterSpacing: '0.13em', fontWeight: 700 }}>BOOKING LAB · OWNER ONLY</div>
      <h1 style={{ fontSize: 'clamp(1.65rem,4vw,2.6rem)', marginTop: 8, color: 'var(--text-primary)' }}>Smart Booking OS</h1>
      <p style={{ maxWidth: 760, color: 'var(--text-muted)', marginTop: 12 }}>
        予定・クライアント希望地から候補を計算する安全な試作画面。予定・移動・個室・ラウンジの確認を終えるまでは販売枠として公開しません。
      </p>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(240px,1fr))', gap: 16, marginTop: 24 }}>
        <label style={labelStyle}>セッション形式
          <select value={mode} onChange={e => setMode(e.target.value as SessionMode)} style={selectStyle}>
            {(Object.keys(formatLabels) as SessionMode[]).map(x => <option key={x} value={x}>{formatLabels[x]}</option>)}
          </select>
        </label>
        <label style={labelStyle}>クライアント希望エリア
          <select value={clientArea} onChange={e => setClientArea(e.target.value as ClientArea)} style={selectStyle}>
            {(Object.keys(CLIENT_AREAS) as ClientArea[]).map(x => <option key={x} value={x}>{CLIENT_AREAS[x]}</option>)}
          </select>
        </label>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 10, margin: '24px 0' }}>
        <button type="button" onClick={() => void refresh()} disabled={busy} style={buttonStyle}>{busy ? '確認中…' : 'カレンダー再確認'}</button>
        <a href="/dashboard/schedule" style={{ color: 'var(--gold-muted)' }}>予定一覧へ ↗</a>
        <a href="https://calendar.google.com/calendar/u/0/r/agenda" target="_blank" rel="noreferrer" style={{ color: 'var(--gold-muted)' }}>Googleカレンダー ↗</a>
      </div>
      <section style={{ padding: 18, background: 'var(--bg-elevated)', border: '1px solid var(--border-default)', marginBottom: 24 }}>
        <strong style={{ color: 'var(--text-primary)' }}>公開前の確認事項</strong>
        <p style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 6 }}>
          候補の算出には90分＋前後20分の余裕を設定。Googleカレンダー同期は最大60分以内の新しさを要求。
          ただし現行スナップショットは複数カレンダーの完全網羅と交通・施設予約を保証しません。
          実際に販売するには、最新のGoogle Calendar FreeBusy再照合、交通API、会場利用許諾、決済と予約の原子的な確定処理が必要です。
        </p>
        <p style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 8 }}>
          既存商品：「勝ち筋OS｜90分パフォーマンス実装セッション」19,800円。プレミアム形式の価格は未設定です。
        </p>
      </section>
      {error && <div role="alert" style={alertStyle}>{error}</div>}
      {!busy && result.reason && <div role="status" style={alertStyle}>
        {result.reason === 'calendar_not_fresh_or_incomplete'
          ? 'カレンダー同期が古い・期間不足のため、候補枠を停止しました。Googleカレンダーを再確認してください。'
          : '予定データの検証に失敗したため、安全のため候補枠を停止しました。'}
      </div>}
      <h2 style={{ fontSize: 18, marginBottom: 14 }}>検討用の候補枠（公開・確約なし）</h2>
      {!busy && !error && !result.reason && result.candidates.length === 0 && <p>指定条件では候補がありません。</p>}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(285px,1fr))', gap: 12 }}>
        {!busy && !error && result.candidates.map(item => (
          <article key={item.startsAt + item.locationId} style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-default)', padding: 17 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--gold-muted)' }}>要確認 · {item.clientAreaMatch ? '希望エリア一致' : '別エリア'}</div>
            <h3 style={{ color: 'var(--text-primary)', fontSize: 17, marginTop: 8 }}>
              {formatter.format(new Date(item.startsAt))}–{hm.format(new Date(item.endsAt))}
            </h3>
            <p style={{ fontSize: 13, marginTop: 8, color: 'var(--text-muted)' }}>{item.locationLabel}</p>
            <p style={{ fontSize: 12, marginTop: 10, color: 'var(--text-muted)' }}>
              {item.estimatedTravelMinutes === null ? '移動時間：未確認' : '移動時間（確認済入力）：' + item.estimatedTravelMinutes + '分'}
            </p>
            <button type="button" disabled={Boolean(verifying)} onClick={() => void liveCheck(item.startsAt, item.endsAt, item.locationId)}
              style={{ ...buttonStyle, marginTop: 12, background: 'var(--text-primary)', fontSize: 12, width: '100%' }}>
              {verifying === item.startsAt + item.locationId ? '照合中…' : 'Google Calendar・移動を実測照合'}
            </button>
            {checked[item.startsAt + item.locationId] && <p role="status"
              style={{ marginTop: 8, color: 'var(--text-muted)', fontSize: 12 }}>
              {checked[item.startsAt + item.locationId]}
            </p>}
            <details style={{ fontSize: 12, marginTop: 8 }}>
              <summary style={{ cursor: 'pointer' }}>必要な確認 ({item.checks.length})</summary>
              <ul style={{ paddingLeft: 18, marginTop: 6 }}>{item.checks.map(check => <li key={check}>{check}</li>)}</ul>
            </details>
          </article>
        ))}
      </div>
    </main>
  );
}
const labelStyle: React.CSSProperties = { display: 'grid', gap: 7, color: 'var(--text-primary)', fontWeight: 600, fontSize: 13 };
const selectStyle: React.CSSProperties = { padding: '12px 14px', minHeight: 48, background: 'var(--bg-surface)', color: 'var(--text-primary)', border: '1px solid var(--border-default)', fontSize: 15, width: '100%' };
const buttonStyle: React.CSSProperties = { background: 'var(--gold-pure)', border: 0, padding: '11px 16px', cursor: 'pointer', color: '#fff', fontWeight: 700 };
const alertStyle: React.CSSProperties = { border: '1px solid #dc9d64', background: '#fff7ed', color: '#904719', padding: 16, margin: '16px 0' };
