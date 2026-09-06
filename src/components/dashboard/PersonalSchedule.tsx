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

function syncAgeLabel(sync: SyncStatus | null) {
  if (!sync?.synced_at) return { label: '未同期', stale: true };
  const ageMinutes = Math.max(0, Math.round((Date.now() - new Date(sync.synced_at).getTime()) / 60000));
  if (ageMinutes < 2) return { label: 'たった今同期', stale: false };
  if (ageMinutes < 60) return { label: `${ageMinutes}分前に同期`, stale: false };
  const hours = Math.floor(ageMinutes / 60);
  return { label: `${hours}時間前に同期`, stale: true };
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
      .catch((err) => setError(String(err)))
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

  const syncState = syncAgeLabel(sync);

  return (
    <div style={{ maxWidth: 1040, margin: '0 auto', paddingBottom: 64 }}>
      <div style={{ display: 'flex', gap: 18, justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', marginBottom: 26 }}>
        <div>
          <div style={{ fontSize: 12, letterSpacing: '0.16em', color: '#8B7355', marginBottom: 8 }}>LIVE SCHEDULE</div>
          <h1 style={{ fontFamily: "'Cormorant Garamond', serif", fontWeight: 300, fontSize: 'clamp(2rem,5vw,3.4rem)', lineHeight: 1, color: '#C9A96E', margin: 0 }}>Google Calendar</h1>
          <p style={{ color: '#7A6F5F', marginTop: 10, lineHeight: 1.7 }}>実予定の正本はGoogle Calendar。Dashboardは「今、何があるか」を読むだけの表示レイヤーです。</p>
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
          <a href="https://calendar.google.com/calendar/u/0/r/agenda" target="_blank" rel="noreferrer" style={linkButton}>Google Calendar ↗</a>
          <a href="/dashboard/content-schedule" style={secondaryButton}>Content Schedule</a>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(210px,1fr))', gap: 12, marginBottom: 22 }}>
        <div style={metricCard}>
          <div style={metricLabel}>SOURCE OF TRUTH</div>
          <div style={metricValue}>Google Calendar</div>
        </div>
        <div style={metricCard}>
          <div style={metricLabel}>SYNC</div>
          <div style={{ ...metricValue, color: syncState.stale ? '#D79A67' : '#A7C7A0' }}>{syncState.label}</div>
        </div>
        <div style={metricCard}>
          <div style={metricLabel}>VISIBLE</div>
          <div style={metricValue}>{visibleEvents.length} events / {days} days</div>
        </div>
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'center', marginBottom: 16, flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', gap: 6 }}>
          {[7, 30].map((value) => (
            <button key={value} onClick={() => setDays(value as 7 | 30)} style={value === days ? activePill : pill}>{value}日</button>
          ))}
        </div>
        <button onClick={load} disabled={loading} style={refreshButton}>{loading ? '同期データ読込中…' : '↻ 再読込'}</button>
      </div>

      {syncState.stale && !loading && (
        <div style={warningBox}>同期データが古い可能性があります。Google Calendar自体が正本なので、重要な予定はGoogle Calendarで確認してください。</div>
      )}

      {error && (
        <div style={errorBox}>Calendarデータを読めませんでした：{error}</div>
      )}

      {!loading && !error && grouped.length === 0 && (
        <div style={emptyBox}>この期間に予定はありません。初回同期前の場合は、Calendar Syncの設定後にここへ表示されます。</div>
      )}

      <div style={{ display: 'grid', gap: 14 }}>
        {grouped.map(([key, dayEvents]) => (
          <section key={key} style={dayCard}>
            <div style={dayHeader}>{dayLabel(dayEvents[0].start_at)}</div>
            <div>
              {dayEvents.map((event, index) => (
                <div key={event.event_id} style={{ ...eventRow, borderTop: index ? '1px solid #2E2822' : 'none' }}>
                  <div style={timeCol}>{timeLabel(event)}</div>
                  <div style={{ minWidth: 0 }}>
                    <div style={eventTitle}>{event.title}</div>
                    {event.location && <div style={eventMeta}>📍 {event.location}</div>}
                  </div>
                </div>
              ))}
            </div>
          </section>
        ))}
      </div>

      <div style={{ marginTop: 26, padding: 18, border: '1px solid #2E2822', background: '#12100D', color: '#7A6F5F', fontSize: 13, lineHeight: 1.8 }}>
        <strong style={{ color: '#C9A96E', fontWeight: 500 }}>FLOW RULE</strong><br />
        Calendar = 事実。SCHEDULE OS / C071 = 観測と意思決定の補助線。Task = TASK_BOARD。3つを混ぜない。
      </div>
    </div>
  );
}

const metricCard: React.CSSProperties = { border: '1px solid #2E2822', background: '#1A1612', padding: '16px 18px' };
const metricLabel: React.CSSProperties = { fontSize: 10, letterSpacing: '0.14em', color: '#5A4D3A', marginBottom: 7 };
const metricValue: React.CSSProperties = { fontSize: 14, color: '#D4C5A9' };
const dayCard: React.CSSProperties = { border: '1px solid #2E2822', background: '#1A1612' };
const dayHeader: React.CSSProperties = { padding: '12px 16px', borderBottom: '1px solid #2E2822', color: '#C9A96E', fontSize: 14, fontWeight: 500 };
const eventRow: React.CSSProperties = { display: 'grid', gridTemplateColumns: '110px minmax(0,1fr)', gap: 14, padding: '14px 16px', alignItems: 'start' };
const timeCol: React.CSSProperties = { color: '#8B7355', fontSize: 13, fontVariantNumeric: 'tabular-nums' };
const eventTitle: React.CSSProperties = { color: '#D4C5A9', fontSize: 14, lineHeight: 1.55, overflowWrap: 'anywhere' };
const eventMeta: React.CSSProperties = { color: '#5A4D3A', fontSize: 12, marginTop: 5 };
const pill: React.CSSProperties = { border: '1px solid #2E2822', background: 'transparent', color: '#7A6F5F', padding: '7px 12px', cursor: 'pointer' };
const activePill: React.CSSProperties = { ...pill, borderColor: '#8B7355', color: '#C9A96E', background: 'rgba(201,169,110,0.06)' };
const refreshButton: React.CSSProperties = { border: '1px solid #2E2822', background: '#1A1612', color: '#8B7355', padding: '8px 12px', cursor: 'pointer' };
const linkButton: React.CSSProperties = { textDecoration: 'none', background: '#C9A96E', color: '#0D0B08', padding: '9px 13px', fontSize: 13, fontWeight: 600 };
const secondaryButton: React.CSSProperties = { ...linkButton, background: 'transparent', color: '#8B7355', border: '1px solid #2E2822' };
const warningBox: React.CSSProperties = { border: '1px solid rgba(215,154,103,0.3)', background: 'rgba(215,154,103,0.06)', color: '#D79A67', padding: 14, marginBottom: 16, fontSize: 13, lineHeight: 1.6 };
const errorBox: React.CSSProperties = { border: '1px solid rgba(220,100,100,0.35)', background: 'rgba(220,100,100,0.06)', color: '#D88', padding: 14, marginBottom: 16, fontSize: 13 };
const emptyBox: React.CSSProperties = { border: '1px dashed #2E2822', color: '#7A6F5F', padding: 30, textAlign: 'center', marginBottom: 16 };
