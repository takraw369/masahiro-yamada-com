import { useEffect, useMemo, useState } from 'react';
import {
  parseXUnderTheHoodReport,
  xHealthLabelRate,
  type ParsedXHealthReport,
  type XHealthLabelStat,
} from '../../lib/xHealth';

interface XAccount {
  id: string;
  username: string;
  isActive: boolean;
}

interface StoredXHealthReport {
  accountId: string;
  username: string;
  reportMonth: string;
  postCount: number;
  postLabelCount: number;
  accountLabelDays: number;
  legalRestrictionCount: number;
  labels: XHealthLabelStat[];
  rawReport: Record<string, unknown>;
  importedAt: string;
  updatedAt: string;
}

const previousMonth = () => {
  const now = new Date();
  const date = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1));
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}`;
};

const percent = (value: number) => `${(value * 100).toFixed(value * 100 < 10 ? 2 : 1)}%`;

export default function XHealthPanel() {
  const [accounts, setAccounts] = useState<XAccount[]>([]);
  const [selectedAccountId, setSelectedAccountId] = useState('');
  const [reportMonth, setReportMonth] = useState(previousMonth());
  const [rawJson, setRawJson] = useState('');
  const [parsed, setParsed] = useState<ParsedXHealthReport | null>(null);
  const [reports, setReports] = useState<StoredXHealthReport[]>([]);
  const [status, setStatus] = useState('');
  const [busy, setBusy] = useState(false);

  const loadReports = async () => {
    try {
      const response = await fetch('/api/dashboard/x-health');
      const body = await response.json() as { ok?: boolean; reports?: StoredXHealthReport[] };
      if (response.ok && body.ok) setReports(body.reports ?? []);
    } catch {
      // The import form remains useful even if history is temporarily unavailable.
    }
  };

  useEffect(() => {
    fetch('/api/x-harness/x-accounts')
      .then((response) => response.json() as Promise<{ data?: XAccount[] }>)
      .then((body) => {
        const active = (body.data ?? []).filter((account) => account.isActive);
        setAccounts(active);
        if (active.length > 0) setSelectedAccountId(active[0].id);
      })
      .catch(() => setStatus('Xアカウント一覧を取得できませんでした。'));
    loadReports();
  }, []);

  const selectedAccount = accounts.find((account) => account.id === selectedAccountId);

  const latestByAccount = useMemo(() => {
    const map = new Map<string, StoredXHealthReport>();
    const ordered = [...reports].sort((a, b) => b.reportMonth.localeCompare(a.reportMonth));
    for (const report of ordered) {
      if (!map.has(report.accountId)) map.set(report.accountId, report);
    }
    return accounts.map((account) => ({ account, report: map.get(account.id) ?? null }));
  }, [accounts, reports]);

  const handleParse = () => {
    setStatus('');
    try {
      const json = JSON.parse(rawJson);
      const next = parseXUnderTheHoodReport(json);
      setParsed(next);
      setReportMonth(next.reportMonth!);
      setStatus('JSONを解析しました。内容を確認して保存できます。');
    } catch (error) {
      setParsed(null);
      setStatus(error instanceof Error ? error.message : 'JSONを解析できませんでした。');
    }
  };

  const handleSave = async () => {
    if (!parsed || !selectedAccountId || reportMonth !== parsed.reportMonth) {
      setStatus('アカウント・対象月・解析済みJSONを確認してください。');
      return;
    }

    setBusy(true);
    setStatus('');
    try {
      const response = await fetch('/api/dashboard/x-health', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          accountId: selectedAccountId,
          username: selectedAccount?.username ?? '',
          reportMonth,
          postCount: parsed.postCount,
          postLabelCount: parsed.postLabelCount,
          accountLabelDays: parsed.accountLabelDays,
          legalRestrictionCount: parsed.legalRestrictionCount,
          labels: parsed.labels,
          rawReport: parsed.rawReport,
        }),
      });
      const body = await response.json() as { ok?: boolean; error?: string };
      if (!response.ok || !body.ok) throw new Error(body.error ?? '保存に失敗しました。');
      setStatus(`${reportMonth} の @${selectedAccount?.username ?? 'account'} レポートを保存しました。`);
      await loadReports();
    } catch (error) {
      setStatus(error instanceof Error ? error.message : '保存に失敗しました。');
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="x-health">
      <style>{`
        .x-health { color:#25211d; padding-bottom:40px; }
        .xh-hero { padding:18px 20px; border:1px solid rgba(37,33,29,.13); border-radius:16px; background:linear-gradient(135deg,#fff 0%,#faf7f0 100%); margin-bottom:18px; }
        .xh-kicker { color:#9a6d24; font-size:.74rem; letter-spacing:.12em; font-weight:800; text-transform:uppercase; }
        .xh-title { margin:5px 0 6px; font-size:1.35rem; line-height:1.25; }
        .xh-copy { color:#736b61; margin:0; line-height:1.7; font-size:.9rem; }
        .xh-actions { display:flex; gap:9px; flex-wrap:wrap; margin-top:14px; }
        .xh-link,.xh-btn { border-radius:10px; padding:9px 13px; font:inherit; font-size:.86rem; font-weight:800; cursor:pointer; text-decoration:none; }
        .xh-link { background:#25211d; color:#fff; border:1px solid #25211d; }
        .xh-btn { background:#fff; color:#4e473f; border:1px solid rgba(37,33,29,.16); }
        .xh-btn.primary { background:#b4863b; border-color:#9a6d24; color:#1f1a14; }
        .xh-btn:disabled { opacity:.45; cursor:not-allowed; }
        .xh-grid { display:grid; grid-template-columns:repeat(2,minmax(0,1fr)); gap:12px; }
        .xh-field { display:flex; flex-direction:column; gap:6px; }
        .xh-field label { color:#736b61; font-size:.74rem; font-weight:800; letter-spacing:.07em; text-transform:uppercase; }
        .xh-field select,.xh-field input,.xh-json { width:100%; box-sizing:border-box; border:1px solid rgba(37,33,29,.14); border-radius:10px; background:#fff; color:#25211d; font:inherit; padding:10px 12px; outline:none; }
        .xh-json { min-height:190px; resize:vertical; line-height:1.55; font-family:ui-monospace,SFMono-Regular,Menlo,monospace; font-size:.78rem; margin-top:12px; }
        .xh-status { margin:11px 0 0; color:#5e554b; font-size:.84rem; line-height:1.5; }
        .xh-metrics { display:grid; grid-template-columns:repeat(4,minmax(0,1fr)); gap:9px; margin:18px 0; }
        .xh-metric { border:1px solid rgba(37,33,29,.11); border-radius:13px; background:#fff; padding:13px; }
        .xh-metric span { display:block; color:#7a7167; font-size:.72rem; font-weight:700; margin-bottom:5px; }
        .xh-metric strong { font-size:1.35rem; line-height:1; }
        .xh-section { margin-top:22px; }
        .xh-section h3 { font-size:.95rem; margin:0 0 10px; }
        .xh-table-wrap { overflow:auto; border:1px solid rgba(37,33,29,.11); border-radius:12px; background:#fff; }
        .xh-table { width:100%; border-collapse:collapse; min-width:640px; font-size:.8rem; }
        .xh-table th,.xh-table td { padding:10px 11px; text-align:left; border-bottom:1px solid rgba(37,33,29,.08); white-space:nowrap; }
        .xh-table th { background:#faf8f4; color:#736b61; font-size:.7rem; letter-spacing:.04em; text-transform:uppercase; }
        .xh-table tr:last-child td { border-bottom:0; }
        .xh-labels { display:grid; gap:8px; }
        .xh-label { border:1px solid rgba(37,33,29,.11); border-radius:11px; padding:11px 13px; background:#fff; }
        .xh-label-top { display:flex; justify-content:space-between; gap:12px; align-items:center; }
        .xh-label-name { font-weight:800; font-size:.86rem; overflow-wrap:anywhere; }
        .xh-label-count { color:#9a6d24; font-weight:800; white-space:nowrap; }
        .xh-label-meta { margin-top:5px; color:#736b61; font-size:.75rem; line-height:1.5; }
        .xh-legal { display:inline-block; margin-left:7px; padding:2px 6px; border-radius:99px; background:#fff1f0; color:#a43b32; font-size:.65rem; vertical-align:1px; }
        .xh-empty { color:#8a8177; font-size:.84rem; padding:13px 0; }
        @media (max-width:720px) { .xh-grid{grid-template-columns:1fr}.xh-metrics{grid-template-columns:repeat(2,minmax(0,1fr))}.xh-hero{padding:16px} }
      `}</style>

      <div className="xh-hero">
        <div className="xh-kicker">X Health · Under the Hood</div>
        <h2 className="xh-title">リーチ低下を「感覚」ではなく月次データで見る</h2>
        <p className="xh-copy">
          X公式のUnder the Hoodから書き出したJSONを保存し、アカウント別にラベル件数・アカウントラベル日数・法的表示制限を追跡します。
        </p>
        <div className="xh-actions">
          <a className="xh-link" href="https://x.com/i/under_the_hood" target="_blank" rel="noreferrer">X公式を開く ↗</a>
        </div>
      </div>

      <div className="xh-grid">
        <div className="xh-field">
          <label>アカウント</label>
          <select value={selectedAccountId} onChange={(event) => setSelectedAccountId(event.target.value)}>
            {accounts.length === 0 && <option value="">取得中 / 未接続</option>}
            {accounts.map((account) => <option key={account.id} value={account.id}>@{account.username}</option>)}
          </select>
        </div>
        <div className="xh-field">
          <label>対象月</label>
          <input type="month" value={reportMonth} onChange={(event) => setReportMonth(event.target.value)} />
        </div>
      </div>

      <textarea
        className="xh-json"
        value={rawJson}
        onChange={(event) => { setRawJson(event.target.value); setParsed(null); setStatus(''); }}
        placeholder={'Under the Hoodから取得したJSONをそのまま貼り付け\n{\n  "period": { "startDate": "2026-08-01", ... },\n  "postCount": "...",\n  "postLabels": [...],\n  "accountLabels": [...]\n}'}
      />
      <div className="xh-actions">
        <button className="xh-btn" onClick={handleParse} disabled={!rawJson.trim()}>JSONを解析</button>
        <button className="xh-btn primary" onClick={handleSave} disabled={!parsed || busy || !selectedAccountId}>{busy ? '保存中…' : '月次レポートを保存'}</button>
      </div>
      {status && <p className="xh-status">{status}</p>}

      {parsed && (
        <>
          <div className="xh-metrics">
            <div className="xh-metric"><span>POSTS</span><strong>{parsed.postCount}</strong></div>
            <div className="xh-metric"><span>POST LABELS</span><strong>{parsed.postLabelCount}</strong></div>
            <div className="xh-metric"><span>LABEL RATE</span><strong>{percent(xHealthLabelRate(parsed))}</strong></div>
            <div className="xh-metric"><span>LEGAL ROWS</span><strong>{parsed.legalRestrictionCount}</strong></div>
          </div>

          <div className="xh-section">
            <h3>今回のラベル</h3>
            {parsed.labels.length === 0 ? <div className="xh-empty">表示制限ラベルはありません。</div> : (
              <div className="xh-labels">
                {parsed.labels.map((label, index) => (
                  <div className="xh-label" key={`${label.level}-${label.label}-${index}`}>
                    <div className="xh-label-top">
                      <div className="xh-label-name">
                        {label.level === 'post' ? '投稿' : 'アカウント'} · {label.label}
                        {label.legal && <span className="xh-legal">LEGAL</span>}
                      </div>
                      <div className="xh-label-count">{label.count}{label.level === 'post' ? ' posts' : ' days'}</div>
                    </div>
                    {(label.percentage || label.effect || label.about) && (
                      <div className="xh-label-meta">
                        {[label.percentage, label.effect, label.about].filter(Boolean).join(' · ')}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      )}

      <div className="xh-section">
        <h3>4アカウント最新スナップショット</h3>
        <div className="xh-table-wrap">
          <table className="xh-table">
            <thead><tr><th>Account</th><th>Month</th><th>Posts</th><th>Post labels</th><th>Rate</th><th>Account days</th><th>Legal</th></tr></thead>
            <tbody>
              {latestByAccount.length === 0 && <tr><td colSpan={7}>アカウントデータなし</td></tr>}
              {latestByAccount.map(({ account, report }) => (
                <tr key={account.id}>
                  <td>@{account.username}</td>
                  <td>{report?.reportMonth ?? '—'}</td>
                  <td>{report?.postCount ?? '—'}</td>
                  <td>{report?.postLabelCount ?? '—'}</td>
                  <td>{report ? percent(report.postCount > 0 ? report.postLabelCount / report.postCount : 0) : '—'}</td>
                  <td>{report?.accountLabelDays ?? '—'}</td>
                  <td>{report?.legalRestrictionCount ?? '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="xh-section">
        <h3>月次履歴</h3>
        <div className="xh-table-wrap">
          <table className="xh-table">
            <thead><tr><th>Month</th><th>Account</th><th>Posts</th><th>Post labels</th><th>Rate</th><th>Account days</th><th>Legal</th></tr></thead>
            <tbody>
              {reports.length === 0 && <tr><td colSpan={7}>まだ保存されたレポートはありません。</td></tr>}
              {reports.map((report) => (
                <tr key={`${report.accountId}-${report.reportMonth}`}>
                  <td>{report.reportMonth}</td>
                  <td>@{report.username || report.accountId}</td>
                  <td>{report.postCount}</td>
                  <td>{report.postLabelCount}</td>
                  <td>{percent(report.postCount > 0 ? report.postLabelCount / report.postCount : 0)}</td>
                  <td>{report.accountLabelDays}</td>
                  <td>{report.legalRestrictionCount}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}
