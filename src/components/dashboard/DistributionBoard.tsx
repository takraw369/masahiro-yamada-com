import { useEffect, useMemo, useState, type CSSProperties } from 'react';

type DistributionRow = {
  asset_id: string;
  genre: string | null;
  current_title: string | null;
  sell_readiness: string | null;
  productization_status: string | null;
  product_format_candidate: string | null;
  target_audience: string | null;
  next_action: string | null;
  source_url: string | null;
  related_project: string | null;
  last_reviewed: string | null;
  source_updated_at: string | null;
};

type DistributionResponse = {
  ok: boolean;
  storage: string;
  content: DistributionRow[];
  error?: string;
};

function display(value: string | null | undefined, fallback = '—') {
  return value?.trim() || fallback;
}

function timestamp(value: string | null) {
  if (!value) return '未記録';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat('ja-JP', {
    timeZone: 'Asia/Tokyo',
    year: 'numeric',
    month: 'numeric',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
}

function stateTone(value: string | null) {
  const text = (value || '').toUpperCase();
  if (text.includes('HOLD')) return 'hold';
  if (text.includes('READY')) return 'ready';
  if (text.includes('PUBLISH')) return 'published';
  return 'neutral';
}

export default function DistributionBoard() {
  const [rows, setRows] = useState<DistributionRow[]>([]);
  const [storage, setStorage] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = () => {
    setLoading(true);
    setError('');
    fetch('/api/dashboard/distribution', { cache: 'no-store' })
      .then(async (response) => {
        const data = await response.json() as DistributionResponse;
        if (!response.ok || !data.ok) throw new Error(data.error || 'distribution_unavailable');
        setRows(Array.isArray(data.content) ? data.content : []);
        setStorage(data.storage || 'drive-supabase-read-model');
      })
      .catch(() => {
        setRows([]);
        setStorage('');
        setError('Distribution read-modelを取得できませんでした。静的データには切り替えていません。');
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  const newest = useMemo(() => {
    const times = rows
      .map((row) => row.source_updated_at ? new Date(row.source_updated_at).getTime() : NaN)
      .filter(Number.isFinite);
    if (!times.length) return null;
    return new Date(Math.max(...times)).toISOString();
  }, [rows]);

  return (
    <div style={shell}>
      <header style={hero}>
        <div>
          <div style={eyebrow}>DISTRIBUTION · READ MODEL</div>
          <h1 style={title}>What is ready to move?</h1>
          <p style={lead}>
            DriveのCONTENT_OSを正本として、既存のSheet Sync → Supabase read-modelから配信候補の事実だけを読む。
            この画面は原稿やアカウントを勝手に作らず、公開もしない。
          </p>
        </div>
        <div style={actions}>
          <a href="/dashboard/content-schedule" style={secondaryLink}>Content Schedule</a>
          <button type="button" onClick={load} disabled={loading} style={button}>{loading ? '読込中…' : '↻ 再読込'}</button>
        </div>
      </header>

      <section style={metrics} aria-label="Distribution status">
        <Metric label="SOURCE OF TRUTH" value="Drive CONTENT_OS" />
        <Metric label="READ PATH" value={storage || (loading ? 'loading…' : 'unavailable')} />
        <Metric label="VISIBLE ITEMS" value={loading ? '—' : String(rows.length)} />
        <Metric label="SOURCE UPDATED" value={newest ? timestamp(newest) : '未記録'} />
      </section>

      <section style={boundaryBox}>
        <strong>BOUNDARY</strong>
        <p>
          Content facts = LIVE。Account Selection / SNS_ACCOUNT_REGISTRY = まだ未接続。
          そのため、この画面では媒体アカウントの「正解」を固定値で表示しない。公開はHuman Gateのまま。
        </p>
      </section>

      {error && <div style={errorBox} role="alert">{error}</div>}

      {!loading && !error && rows.length === 0 && (
        <div style={emptyBox}>対象コンテンツがread-modelにありません。Drive / Sync側の事実を確認してください。</div>
      )}

      <div style={grid}>
        {rows.map((row) => (
          <article key={row.asset_id} style={card}>
            <div style={cardTop}>
              <div>
                <div style={assetId}>{row.asset_id}</div>
                <h2 style={cardTitle}>{display(row.current_title, 'Untitled')}</h2>
              </div>
              <State value={row.productization_status} />
            </div>

            <div style={fieldGrid}>
              <Field label="SELL READINESS" value={display(row.sell_readiness)} />
              <Field label="FORMAT" value={display(row.product_format_candidate)} />
              <Field label="AUDIENCE" value={display(row.target_audience)} />
              <Field label="PROJECT" value={display(row.related_project)} />
            </div>

            <div style={nextBox}>
              <span style={fieldLabel}>NEXT ACTION</span>
              <strong style={nextText}>{display(row.next_action, '次の行動は正本で未設定')}</strong>
            </div>

            <footer style={cardFooter}>
              <span>Reviewed: {display(row.last_reviewed, '—')}</span>
              <span>Source sync: {timestamp(row.source_updated_at)}</span>
              {row.source_url && (
                <a href={row.source_url} target="_blank" rel="noopener noreferrer" style={sourceLink}>正本を開く ↗</a>
              )}
            </footer>
          </article>
        ))}
      </div>

      <section style={flowRule}>
        <strong>FLOW RULE</strong>
        <p>Knowledge → Content fact → Distribution decision → Human Gate → Publish → Reaction / Evidence → Knowledge。</p>
        <p>次フェーズはSNS_ACCOUNT_REGISTRYを同じread-model水路へ載せ、Account Selectionを固定スナップショットから解放する。</p>
      </section>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return <div style={metric}><span style={metricLabel}>{label}</span><strong style={metricValue}>{value}</strong></div>;
}

function Field({ label, value }: { label: string; value: string }) {
  return <div><div style={fieldLabel}>{label}</div><div style={fieldValue}>{value}</div></div>;
}

function State({ value }: { value: string | null }) {
  const tone = stateTone(value);
  const styles: Record<string, CSSProperties> = {
    hold: { background: '#fff4e7', borderColor: '#e7c79d', color: '#995b17' },
    ready: { background: '#edf8f2', borderColor: '#b9ddca', color: '#187049' },
    published: { background: '#eef4fb', borderColor: '#bfd2e7', color: '#315d8b' },
    neutral: { background: 'var(--bg-elevated)', borderColor: 'var(--border-default)', color: 'var(--text-muted)' },
  };
  return <span style={{ ...state, ...styles[tone] }}>{display(value, 'UNSET')}</span>;
}

const shell: CSSProperties = { maxWidth: 1180, margin: '0 auto', paddingBottom: 60 };
const hero: CSSProperties = { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', gap: 24, flexWrap: 'wrap', paddingBottom: 24, borderBottom: '1px solid var(--border-default)' };
const eyebrow: CSSProperties = { color: 'var(--gold-muted)', fontSize: 11, letterSpacing: '.14em', fontWeight: 700 };
const title: CSSProperties = { marginTop: 6, fontFamily: "'Cormorant Garamond', serif", fontSize: 'clamp(2.4rem,5vw,4.5rem)', lineHeight: .95, fontWeight: 600 };
const lead: CSSProperties = { maxWidth: 760, marginTop: 14, color: 'var(--text-muted)', lineHeight: 1.8, fontSize: 13 };
const actions: CSSProperties = { display: 'flex', gap: 8, flexWrap: 'wrap' };
const button: CSSProperties = { minHeight: 42, padding: '0 14px', border: '1px solid var(--border-default)', background: 'var(--bg-surface)', color: 'var(--text-muted)', cursor: 'pointer' };
const secondaryLink: CSSProperties = { ...button, display: 'inline-flex', alignItems: 'center', textDecoration: 'none' };
const metrics: CSSProperties = { display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(180px,1fr))', gap: 10, marginTop: 18 };
const metric: CSSProperties = { padding: '14px 15px', border: '1px solid var(--border-default)', background: 'var(--bg-surface)' };
const metricLabel: CSSProperties = { display: 'block', color: 'var(--text-dim)', fontSize: 10, letterSpacing: '.1em', marginBottom: 6 };
const metricValue: CSSProperties = { fontSize: 13, overflowWrap: 'anywhere' };
const boundaryBox: CSSProperties = { marginTop: 14, padding: 15, border: '1px solid var(--border-accent)', background: 'var(--gold-glow)', color: 'var(--text-muted)', fontSize: 12, lineHeight: 1.75 };
const errorBox: CSSProperties = { marginTop: 16, padding: 16, border: '1px solid #e1b9b9', background: '#fff5f5', color: '#963737' };
const emptyBox: CSSProperties = { marginTop: 16, padding: 28, border: '1px dashed var(--border-default)', textAlign: 'center', color: 'var(--text-muted)' };
const grid: CSSProperties = { display: 'grid', gap: 12, marginTop: 18 };
const card: CSSProperties = { padding: 18, border: '1px solid var(--border-default)', background: 'var(--bg-surface)' };
const cardTop: CSSProperties = { display: 'flex', justifyContent: 'space-between', gap: 16, alignItems: 'flex-start' };
const assetId: CSSProperties = { color: 'var(--gold-muted)', fontSize: 11, letterSpacing: '.1em', fontWeight: 700 };
const cardTitle: CSSProperties = { marginTop: 5, fontSize: 18, lineHeight: 1.45 };
const state: CSSProperties = { flexShrink: 0, border: '1px solid', padding: '6px 8px', fontSize: 10, fontWeight: 700, letterSpacing: '.05em' };
const fieldGrid: CSSProperties = { display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(180px,1fr))', gap: 14, marginTop: 18, paddingTop: 16, borderTop: '1px solid var(--border-default)' };
const fieldLabel: CSSProperties = { color: 'var(--text-dim)', fontSize: 9, letterSpacing: '.1em', fontWeight: 700 };
const fieldValue: CSSProperties = { marginTop: 5, color: 'var(--text-muted)', fontSize: 12, lineHeight: 1.6 };
const nextBox: CSSProperties = { marginTop: 16, padding: 14, background: 'var(--bg-elevated)', border: '1px solid var(--border-default)' };
const nextText: CSSProperties = { display: 'block', marginTop: 5, fontSize: 13, lineHeight: 1.7 };
const cardFooter: CSSProperties = { display: 'flex', flexWrap: 'wrap', gap: '7px 16px', marginTop: 14, color: 'var(--text-dim)', fontSize: 10 };
const sourceLink: CSSProperties = { marginLeft: 'auto', color: 'var(--gold-muted)', fontWeight: 700, textDecoration: 'none' };
const flowRule: CSSProperties = { marginTop: 20, padding: 16, border: '1px solid var(--border-default)', background: 'var(--bg-elevated)', color: 'var(--text-muted)', fontSize: 12, lineHeight: 1.8 };
