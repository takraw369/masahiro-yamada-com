import { useEffect, useMemo, useState } from 'react';

type CalendarEvent = {
  event_id: string;
  title: string;
  start_at: string;
  end_at: string;
  all_day: boolean;
  location: string | null;
};

type SyncStatus = {
  synced_at: string;
  source_synced_at?: string | null;
  window_start: string | null;
  window_end: string | null;
  event_count: number;
};

type ApiResponse = {
  ok: boolean;
  events?: CalendarEvent[];
  sync?: SyncStatus | null;
  error?: string;
};

const TZ = 'Asia/Tokyo';

function dayKey(iso: string) {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: TZ,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date(iso));
}

function dayLabel(iso: string) {
  return new Intl.DateTimeFormat('ja-JP', {
    timeZone: TZ,
    month: 'numeric',
    day: 'numeric',
    weekday: 'short',
  }).format(new Date(iso));
}

function timeLabel(event: CalendarEvent) {
  if (event.all_day) return '終日';
  const fmt = new Intl.DateTimeFormat('ja-JP', {
    timeZone: TZ,
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
  return `${fmt.format(new Date(event.start_at))}–${fmt.format(new Date(event.end_at))}`;
}

function syncAge(sync: SyncStatus | null) {
  const source = sync?.source_synced_at || sync?.synced_at;
  if (!source) return { label: '未同期', stale: true };
  const ageMinutes = Math.max(0, Math.round((Date.now() - new Date(source).getTime()) / 60000));
  if (ageMinutes < 2) return { label: 'たった今同期', stale: false };
  if (ageMinutes < 60) return { label: `${ageMinutes}分前`, stale: false };
  const hours = Math.floor(ageMinutes / 60);
  return { label: `${hours}時間前`, stale: true };
}

export default function PersonalSchedule() {
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [sync, setSync] = useState<SyncStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [days, setDays] = useState<7 | 30>(7);

  const load = () => {
    setLoading(true);
    setError('');
    const now = new Date();
    const to = new Date(now.getTime() + 45 * 24 * 60 * 60 * 1000);
    fetch(`/api/dashboard/calendar?from=${encodeURIComponent(now.toISOString())}&to=${encodeURIComponent(to.toISOString())}`, {
      cache: 'no-store',
    })
      .then(async (response) => {
        const data = await response.json() as ApiResponse;
        if (!response.ok || !data.ok) throw new Error(data.error || 'calendar_load_failed');
        setEvents(data.events || []);
        setSync(data.sync || null);
      })
      .catch(() => setError('Calendarデータを取得できませんでした'))
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  const visibleEvents = useMemo(() => {
    const cutoff = Date.now() + days * 24 * 60 * 60 * 1000;
    return events.filter((event) => new Date(event.start_at).getTime() <= cutoff);
  }, [events, days]);

  const grouped = useMemo(() => {
    const map = new Map<string, CalendarEvent[]>();
    for (const event of visibleEvents) {
      const key = dayKey(event.start_at);
      const list = map.get(key) || [];
      list.push(event);
      map.set(key, list);
    }
    return Array.from(map.entries());
  }, [visibleEvents]);

  const syncState = syncAge(sync);

  return (
    <div style={{ maxWidth: 1080, margin: '0 auto', paddingBottom: 56 }}>
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 20, flexWrap: 'wrap', marginBottom: 24 }}>
        <div>
          <div style={eyebrow}>LIVE FACT</div>
          <h1 style={titleStyle}>Calendar</h1>
          <p style={lead}>実予定の正本はGoogle Calendar。ここは予定を作る場所ではなく、今ある事実を読む表示レイヤーです。</p>
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <a href="https://calendar.google.com/calendar/u/0/r/agenda" target="_blank" rel="noreferrer" style={primaryLink}>Google Calendar ↗</a>
          <a href="/dashboard/content-schedule" style={secondaryLink}>Content Schedule</a>
        </div>
      </header>

      <div style={metricGrid}>
        <Metric label="SOURCE OF TRUTH" value="Google Calendar" />
        <Metric label="SYNC" value={syncState.label} warning={syncState.stale} />
        <Metric label="VISIBLE" value={`${visibleEvents.length} events / ${days} days`} />
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap', margin: '20px 0 14px' }}>
        <div style={{ display: 'flex', gap: 6 }}>
          {([7, 30] as const).map((value) => (
            <button key={value} type="button" onClick={() => setDays(value)} style={value === days ? activePill : pill}>{value}日</button>
          ))}
        </div>
        <button type="button" onClick={load} disabled={loading} style={pill}>{loading ? '読込中…' : '↻ 再読込'}</button>
      </div>

      {syncState.stale && !loading && <div style={warningBox}>同期データが古い可能性があります。重要な予定はGoogle Calendarを確認してください。</div>}
      {error && <div style={errorBox}>{error}</div>}
      {!loading && !error && grouped.length === 0 && <div style={emptyBox}>この期間に予定はありません。初回同期前の場合は、Calendar Sync設定後に表示されます。</div>}

      <div style={{ display: 'grid', gap: 12 }}>
        {grouped.map(([key, dayEvents]) => (
          <section key={key} style={dayCard}>
            <div style={dayHeader}>{dayLabel(dayEvents[0].start_at)}</div>
            {dayEvents.map((event, index) => (
              <div key={event.event_id} style={{ ...eventRow, borderTop: index ? '1px solid var(--border-default)' : 'none' }}>
                <div style={timeCol}>{timeLabel(event)}</div>
                <div style={{ minWidth: 0 }}>
                  <div style={eventTitle}>{event.title}</div>
                  {event.location && <div style={eventMeta}>📍 {event.location}</div>}
                </div>
              </div>
            ))}
          </section>
        ))}
      </div>

      <div style={ruleBox}><strong>FLOW RULE</strong><br />Calendar = 事実。Content Schedule = 発信予定。Task = TASK BOARD。役割を混ぜない。</div>
    </div>
  );
}

function Metric({ label, value, warning = false }: { label: string; value: string; warning?: boolean }) {
  return <div style={metricCard}><div style={metricLabel}>{label}</div><div style={{ ...metricValue, color: warning ? '#a85d16' : 'var(--text-primary)' }}>{value}</div></div>;
}

const eyebrow: React.CSSProperties = { color: 'var(--gold-muted)', fontSize: 11, letterSpacing: '.14em', fontWeight: 700, marginBottom: 6 };
const titleStyle: React.CSSProperties = { margin: 0, fontFamily: "'Cormorant Garamond', serif", fontSize: 'clamp(2.2rem,5vw,3.6rem)', lineHeight: 1, color: 'var(--text-primary)' };
const lead: React.CSSProperties = { maxWidth: 690, marginTop: 10, color: 'var(--text-muted)', lineHeight: 1.75 };
const metricGrid: React.CSSProperties = { display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(210px,1fr))', gap: 10 };
const metricCard: React.CSSProperties = { border: '1px solid var(--border-default)', background: 'var(--bg-surface)', padding: '16px 18px' };
const metricLabel: React.CSSProperties = { fontSize: 10, letterSpacing: '.12em', color: 'var(--text-dim)', marginBottom: 7 };
const metricValue: React.CSSProperties = { fontSize: 14, fontWeight: 700 };
const dayCard: React.CSSProperties = { border: '1px solid var(--border-default)', background: 'var(--bg-surface)' };
const dayHeader: React.CSSProperties = { padding: '11px 16px', background: 'var(--bg-elevated)', borderBottom: '1px solid var(--border-default)', color: 'var(--gold-muted)', fontSize: 13, fontWeight: 700 };
const eventRow: React.CSSProperties = { display: 'grid', gridTemplateColumns: '105px minmax(0,1fr)', gap: 14, padding: '14px 16px', alignItems: 'start' };
const timeCol: React.CSSProperties = { color: 'var(--text-muted)', fontSize: 13, fontVariantNumeric: 'tabular-nums' };
const eventTitle: React.CSSProperties = { color: 'var(--text-primary)', fontSize: 14, lineHeight: 1.55, overflowWrap: 'anywhere' };
const eventMeta: React.CSSProperties = { color: 'var(--text-dim)', fontSize: 12, marginTop: 5 };
const pill: React.CSSProperties = { minHeight: 38, border: '1px solid var(--border-default)', background: 'var(--bg-surface)', color: 'var(--text-muted)', padding: '7px 12px', cursor: 'pointer' };
const activePill: React.CSSProperties = { ...pill, borderColor: 'var(--border-accent)', color: 'var(--gold-muted)', background: 'var(--gold-glow)' };
const primaryLink: React.CSSProperties = { minHeight: 40, display: 'inline-flex', alignItems: 'center', textDecoration: 'none', background: 'var(--gold-pure)', color: '#fff', padding: '0 13px', fontSize: 13, fontWeight: 700 };
const secondaryLink: React.CSSProperties = { ...primaryLink, background: 'var(--bg-surface)', color: 'var(--text-muted)', border: '1px solid var(--border-default)' };
const warningBox: React.CSSProperties = { border: '1px solid #e6c59f', background: '#fff8ee', color: '#8f5317', padding: 14, marginBottom: 14, fontSize: 13, lineHeight: 1.6 };
const errorBox: React.CSSProperties = { border: '1px solid #e7bcbc', background: '#fff5f5', color: '#9d3131', padding: 14, marginBottom: 14, fontSize: 13 };
const emptyBox: React.CSSProperties = { border: '1px dashed var(--border-default)', color: 'var(--text-muted)', padding: 30, textAlign: 'center', marginBottom: 14 };
const ruleBox: React.CSSProperties = { marginTop: 24, padding: 16, border: '1px solid var(--border-default)', background: 'var(--bg-elevated)', color: 'var(--text-muted)', fontSize: 13, lineHeight: 1.8 };
