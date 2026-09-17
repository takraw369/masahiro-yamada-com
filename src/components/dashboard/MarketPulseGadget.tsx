import { useEffect, useState } from 'react';

type Signal = { key:string; label:string; formatted:string; changePct:number|null; ok:boolean; source:string };

export default function MarketPulseGadget() {
  const [signals,setSignals] = useState<Signal[]>([]);
  const [asOf,setAsOf] = useState<string|null>(null);
  const [loading,setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    try {
      const r = await fetch('/api/dashboard/investment-market',{cache:'no-store'});
      const d = await r.json();
      setSignals(Array.isArray(d?.signals) ? d.signals.slice(0,5) : []);
      setAsOf(d?.asOf || new Date().toISOString());
    } catch { setSignals([]); }
    finally { setLoading(false); }
  };
  useEffect(()=>{ load(); },[]);

  return <a className="market-gadget" href="/dashboard/investment" aria-label="WORLD FLOW Market OSを開く">
    <style>{`
      .market-gadget{display:block;margin-top:18px;padding:16px 18px;border:1px solid var(--border-default);background:var(--bg-surface);text-decoration:none;color:inherit;transition:border-color .15s ease,box-shadow .15s ease}.market-gadget:hover{border-color:#b58a53;box-shadow:0 8px 24px rgba(55,45,32,.05)}.mg-head{display:flex;align-items:center;justify-content:space-between;gap:16px}.mg-title{display:flex;align-items:baseline;gap:10px}.mg-title span{color:var(--gold-muted);font-size:.68rem;letter-spacing:.11em;font-weight:700}.mg-title strong{font-size:.92rem}.mg-open{color:var(--gold-pure);font-size:.74rem}.mg-grid{display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:7px;margin-top:12px}.mg-signal{min-width:0;padding:9px 10px;background:#faf9f6;border:1px solid var(--border-default)}.mg-label{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:var(--text-muted);font-size:.64rem}.mg-value{margin-top:3px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:.83rem;font-weight:700}.mg-change{margin-top:2px;color:var(--gold-muted);font-size:.66rem}.mg-foot{display:flex;justify-content:space-between;gap:12px;margin-top:9px;color:var(--text-dim);font-size:.64rem}.mg-empty{grid-column:1/-1;padding:11px;color:var(--text-muted);font-size:.74rem;background:#faf9f6;border:1px solid var(--border-default)}@media(max-width:760px){.mg-grid{grid-template-columns:repeat(3,minmax(0,1fr))}}@media(max-width:520px){.mg-grid{grid-template-columns:repeat(2,minmax(0,1fr))}.mg-head{align-items:flex-start}.mg-title{display:grid;gap:2px}}
    `}</style>
    <div className="mg-head"><div className="mg-title"><span>WORLD FLOW</span><strong>Market Pulse</strong></div><span className="mg-open">詳しく見る →</span></div>
    <div className="mg-grid">
      {loading ? <div className="mg-empty">世界の市場を取得中…</div> : signals.length ? signals.map(s => <div className="mg-signal" key={s.key}><div className="mg-label">{s.label}</div><div className="mg-value">{s.ok?s.formatted:'—'}</div><div className="mg-change">{s.changePct==null?'変化率 —':`${s.changePct>=0?'+':''}${s.changePct.toFixed(2)}%`}</div></div>) : <div className="mg-empty">市場データ未取得 · Market OSで確認</div>}
    </div>
    <div className="mg-foot"><span>GLANCE → NOTICE → OPEN</span><span>{asOf ? `as of ${new Date(asOf).toLocaleTimeString('ja-JP',{hour:'2-digit',minute:'2-digit'})}` : 'as-of pending'}</span></div>
  </a>;
}
