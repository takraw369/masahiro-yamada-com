import { useMemo, useState } from 'react';

const TZ = 'Asia/Tokyo';

function tokyoDate() {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: TZ,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());
}

function compactLocalDateTime(date: string, time: string) {
  return `${date.replaceAll('-', '')}T${time.replace(':', '')}00`;
}

function nextHour(time: string) {
  const [hour, minute] = time.split(':').map(Number);
  const total = (hour * 60 + minute + 60) % (24 * 60);
  return `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`;
}

export default function CalendarQuickAdd() {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState('');
  const [date, setDate] = useState(tokyoDate());
  const [start, setStart] = useState('09:00');
  const [end, setEnd] = useState('10:00');
  const [location, setLocation] = useState('');
  const [details, setDetails] = useState('');

  const createUrl = useMemo(() => {
    const params = new URLSearchParams({
      action: 'TEMPLATE',
      text: title.trim(),
      dates: `${compactLocalDateTime(date, start)}/${compactLocalDateTime(date, end)}`,
      ctz: TZ,
    });
    if (location.trim()) params.set('location', location.trim());
    if (details.trim()) params.set('details', details.trim());
    return `https://calendar.google.com/calendar/render?${params.toString()}`;
  }, [date, details, end, location, start, title]);

  const changeStart = (value: string) => {
    setStart(value);
    setEnd(nextHour(value));
  };

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    if (!title.trim() || !date || !start || !end || end <= start) return;
    window.open(createUrl, '_blank', 'noopener,noreferrer');
  };

  return (
    <section style={card} aria-label="Calendar quick add">
      <div style={headerRow}>
        <div>
          <div style={eyebrow}>QUICK ADD</div>
          <h2 style={heading}>予定を追加</h2>
          <p style={lead}>Dashboardで入力して、最後の保存だけGoogle Calendarで確定します。</p>
        </div>
        <button type="button" onClick={() => setOpen((value) => !value)} style={toggleButton} aria-expanded={open}>
          {open ? '閉じる' : '+ 予定を作る'}
        </button>
      </div>

      {open && (
        <form onSubmit={submit} style={form}>
          <label style={wideField}>
            <span style={label}>予定名</span>
            <input
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              placeholder="例：乙6 勉強 / 家族Day / コーチング"
              maxLength={300}
              required
              style={input}
            />
          </label>

          <label style={field}>
            <span style={label}>日付</span>
            <input type="date" value={date} onChange={(event) => setDate(event.target.value)} required style={input} />
          </label>

          <label style={field}>
            <span style={label}>開始</span>
            <input type="time" value={start} onChange={(event) => changeStart(event.target.value)} required style={input} />
          </label>

          <label style={field}>
            <span style={label}>終了</span>
            <input type="time" value={end} onChange={(event) => setEnd(event.target.value)} required style={input} />
          </label>

          <label style={field}>
            <span style={label}>場所</span>
            <input value={location} onChange={(event) => setLocation(event.target.value)} placeholder="任意" maxLength={500} style={input} />
          </label>

          <label style={wideField}>
            <span style={label}>メモ</span>
            <textarea value={details} onChange={(event) => setDetails(event.target.value)} placeholder="目的・持ち物・URLなど（任意）" maxLength={4000} rows={3} style={textarea} />
          </label>

          {end <= start && <div style={warning}>終了時刻は開始時刻より後にしてください。</div>}

          <div style={actions}>
            <button type="submit" disabled={!title.trim() || end <= start} style={primaryButton}>
              Google Calendarで確認 →
            </button>
            <span style={note}>自動登録はしません。Google側の「保存」が最終Human Gateです。</span>
          </div>
        </form>
      )}
    </section>
  );
}

const card: React.CSSProperties = {
  maxWidth: 1080,
  margin: '0 auto 20px',
  border: '1px solid var(--border-default)',
  background: 'var(--bg-surface)',
  padding: '18px 20px',
};
const headerRow: React.CSSProperties = { display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 18, flexWrap: 'wrap' };
const eyebrow: React.CSSProperties = { color: 'var(--gold-muted)', fontSize: 10, letterSpacing: '.14em', fontWeight: 700, marginBottom: 5 };
const heading: React.CSSProperties = { margin: 0, fontSize: 18, color: 'var(--text-primary)' };
const lead: React.CSSProperties = { marginTop: 5, color: 'var(--text-muted)', fontSize: 13, lineHeight: 1.6 };
const toggleButton: React.CSSProperties = { minHeight: 40, border: '1px solid var(--border-accent)', background: 'var(--gold-glow)', color: 'var(--gold-muted)', padding: '0 14px', cursor: 'pointer', fontWeight: 700 };
const form: React.CSSProperties = { display: 'grid', gridTemplateColumns: 'repeat(4,minmax(0,1fr))', gap: 12, marginTop: 18, paddingTop: 18, borderTop: '1px solid var(--border-default)' };
const field: React.CSSProperties = { display: 'grid', gap: 6, minWidth: 0 };
const wideField: React.CSSProperties = { ...field, gridColumn: '1 / -1' };
const label: React.CSSProperties = { color: 'var(--text-dim)', fontSize: 11, fontWeight: 700, letterSpacing: '.04em' };
const input: React.CSSProperties = { width: '100%', minHeight: 42, border: '1px solid var(--border-default)', background: 'var(--bg-elevated)', color: 'var(--text-primary)', padding: '8px 10px', font: 'inherit' };
const textarea: React.CSSProperties = { ...input, minHeight: 88, resize: 'vertical' };
const warning: React.CSSProperties = { gridColumn: '1 / -1', color: '#9d3131', fontSize: 12 };
const actions: React.CSSProperties = { gridColumn: '1 / -1', display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' };
const primaryButton: React.CSSProperties = { minHeight: 42, border: 0, background: 'var(--gold-pure)', color: '#fff', padding: '0 15px', cursor: 'pointer', fontWeight: 700 };
const note: React.CSSProperties = { color: 'var(--text-dim)', fontSize: 11, lineHeight: 1.5 };
