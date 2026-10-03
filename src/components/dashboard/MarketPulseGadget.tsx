import { useEffect, useState } from 'react';

type Signal = {
  key: string;
  label: string;
  formatted: string;
  changePct: number | null;
  ok: boolean;
};

export default function MarketPulseGadget() {
  const [signals, setSignals] = useState<Signal[]>([]);
  const [asOf, setAsOf] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const controller = new AbortController();

    void fetch('/api/dashboard/investment-market', {
      cache: 'no-store',
      signal: controller.signal,
    })
      .then((response) => {
        if (!response.ok) throw new Error('market_snapshot_failed');
        return response.json();
      })
      .then((data) => {
        setSignals(Array.isArray(data?.signals) ? data.signals.slice(0, 5) : []);
        setAsOf(typeof data?.asOf === 'string' ? data.asOf : null);
      })
      .catch((error) => {
        if (error instanceof Error && error.name === 'AbortError') return;
        setSignals([]);
        setAsOf(null);
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });

    return () => controller.abort();
  }, []);

  return (
    <a className="market-pulse" href="/dashboard/investment" aria-label="Market PulseからInvestment Dashboardを開く">
      <style>{`
        .market-pulse{display:block;margin-top:18px;padding:16px 18px;border:1px solid var(--border-default);border-radius:16px;background:rgba(255,255,255,.72);color:inherit;text-decoration:none;transition:border-color .15s ease,box-shadow .15s ease}.market-pulse:hover{border-color:#b58a53;box-shadow:0 8px 24px rgba(55,45,32,.05)}.market-pulse:focus-visible{outline:3px solid rgba(181,138,83,.35);outline-offset:3px}.market-pulse__head{display:flex;align-items:flex-start;justify-content:space-between;gap:16px}.market-pulse__title{display:flex;align-items:baseline;gap:10px}.market-pulse__title span{color:var(--gold-muted);font-size:.68rem;letter-spacing:.11em;font-weight:800}.market-pulse__title strong{font-size:.92rem}.market-pulse__open{color:var(--gold-pure);font-size:.74rem}.market-pulse__grid{display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:7px;margin-top:12px}.market-pulse__signal{min-width:0;padding:9px 10px;border:1px solid var(--border-default);border-radius:10px;background:#fff}.market-pulse__label{overflow:hidden;color:var(--text-muted);font-size:.64rem;text-overflow:ellipsis;white-space:nowrap}.market-pulse__value{margin-top:3px;overflow:hidden;font-size:.83rem;font-weight:700;text-overflow:ellipsis;white-space:nowrap}.market-pulse__change{margin-top:2px;color:var(--gold-muted);font-size:.66rem}.market-pulse__foot{display:flex;justify-content:space-between;gap:12px;margin-top:9px;color:var(--text-dim);font-size:.64rem}.market-pulse__empty{grid-column:1/-1;padding:11px;color:var(--text-muted);font-size:.74rem;border:1px solid var(--border-default);border-radius:10px;background:#fff}@media(max-width:760px){.market-pulse__grid{grid-template-columns:repeat(3,minmax(0,1fr))}}@media(max-width:520px){.market-pulse__grid{grid-template-columns:repeat(2,minmax(0,1fr))}.market-pulse__head{align-items:flex-start}.market-pulse__title{display:grid;gap:2px}}@media(prefers-reduced-motion:reduce){.market-pulse{transition:none}}
      `}</style>
      <div className="market-pulse__head">
        <div className="market-pulse__title"><span>WORLD FLOW</span><strong>Market Pulse</strong></div>
        <span className="market-pulse__open">詳しく見る →</span>
      </div>
      <div className="market-pulse__grid" aria-live="polite">
        {loading ? (
          <div className="market-pulse__empty">市場スナップショットを取得中…</div>
        ) : signals.length ? (
          signals.map((signal) => (
            <div className="market-pulse__signal" key={signal.key}>
              <div className="market-pulse__label">{signal.label}</div>
              <div className="market-pulse__value">{signal.ok ? signal.formatted : '—'}</div>
              <div className="market-pulse__change">
                {signal.changePct == null ? '変化率 —' : `${signal.changePct >= 0 ? '+' : ''}${signal.changePct.toFixed(2)}%`}
              </div>
            </div>
          ))
        ) : (
          <div className="market-pulse__empty">市場データ未取得 · Investment Dashboardで再確認</div>
        )}
      </div>
      <div className="market-pulse__foot">
        <span>価格スナップショット。実測資金フローや投資判断ではありません。</span>
        <span>{asOf ? `as of ${new Date(asOf).toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' })}` : 'as-of pending'}</span>
      </div>
    </a>
  );
}
