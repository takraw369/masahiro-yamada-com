import { useCallback, useEffect, useState } from 'react';
import type { RiskLevel, RiskSignal } from '../../lib/financialRisk';

type RiskResponse = {
  ok: boolean;
  asOf: string;
  summary: {
    level: RiskLevel;
    coverage: number;
    expected: number;
    description: string;
    counts: { severe: number; elevated: number; warning: number };
  };
  signals: RiskSignal[];
  methodology: string;
};

const levels: Record<RiskLevel, string> = {
  normal:'平常',watch:'注意',elevated:'警戒',severe:'危機水準',unknown:'判定保留',
};
const dateLabel = (iso: string | null) => {
  if (!iso || Number.isNaN(Date.parse(iso))) return '日時不明';
  return new Date(iso).toLocaleString('ja-JP',{timeZone:'Asia/Tokyo',month:'numeric',day:'numeric',hour:'2-digit',minute:'2-digit'});
};
const changeLabel = (signal: RiskSignal) => {
  if (signal.monthChange === null || signal.monthChangeUnit === null) return '1か月比較: データ不足';
  const v = signal.monthChange;
  return '約1か月: '+(v>0?'+':'')+v.toFixed(2)+(signal.monthChangeUnit === 'bp'?'bp':signal.monthChangeUnit === 'pp'?'pt':'%');
};

export default function FinancialRiskMonitor() {
  const [data,setData] = useState<RiskResponse | null>(null);
  const [loading,setLoading] = useState(true);
  const [error,setError] = useState(false);

  const refresh=useCallback(async(signal?:AbortSignal)=>{
    setLoading(true);setError(false);
    try {
      const r=await fetch('/api/dashboard/financial-risk',{cache:'no-store',signal});
      if(!r.ok) throw new Error('request_failed');
      const result:RiskResponse=await r.json();
      if(!Array.isArray(result?.signals) || !result?.summary) throw new Error('invalid_response');
      if(!signal?.aborted) setData(result);
    } catch {
      if(!signal?.aborted) {setData(null);setError(true);}
    } finally {
      if(!signal?.aborted) setLoading(false);
    }
  },[]);

  useEffect(()=>{
    const controller=new AbortController();
    void refresh(controller.signal);
    return ()=>controller.abort();
  },[refresh]);

  const level=data?.summary?.level ?? 'unknown';
  return <section className="frm" aria-label="世界金融リスク監視">
    <style>{`
      .frm{background:#0D0B08;border:1px solid #3A3023;color:#D4C5A9;padding:20px;margin:0 0 24px;font-family:'Zen Kaku Gothic New',sans-serif}
      .frm *{box-sizing:border-box}.frm-head{display:flex;align-items:flex-start;justify-content:space-between;gap:16px}
      .frm-kicker{font-size:.64rem;letter-spacing:.17em;color:#8B7355}.frm h2{font-family:'Cormorant Garamond',serif;font-weight:400;font-size:1.55rem;margin:6px 0;color:#C9A96E}
      .frm-sub{font-size:.75rem;color:#9E8D76;line-height:1.75;max-width:760px}
      .frm button{border:1px solid #594A35;background:transparent;color:#D4C5A9;font-size:.75rem;cursor:pointer;padding:9px 13px;min-height:44px}
      .frm button:hover,.frm button:focus-visible{border-color:#C9A96E}
      .frm button:disabled{cursor:wait;opacity:.6}.frm-summary{margin-top:18px;display:flex;align-items:center;gap:16px;border:1px solid #383029;background:#1A1612;padding:15px}
      .frm-level{font-size:.9rem;font-weight:600;white-space:nowrap;color:#C9A96E}.frm-level[data-level="normal"]{color:#80B592}.frm-level[data-level="watch"]{color:#DDBD78}.frm-level[data-level="elevated"]{color:#EA9B63}.frm-level[data-level="severe"]{color:#E85D4A}
      .frm-context{font-size:.76rem;line-height:1.65;color:#B8AA95}.frm-context small{display:block;color:#8B7355;margin-top:4px}
      .frm-grid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:10px;margin-top:14px}
      .frm-card{min-width:0;border:1px solid #322A22;background:#1A1612;padding:14px;display:flex;flex-direction:column;gap:6px}
      .frm-top{display:flex;align-items:start;justify-content:space-between;gap:6px}
      .frm-card-title{font-size:.71rem;color:#BAA98E;overflow-wrap:anywhere}.frm-indicator{font-size:.64rem;color:#9A8F7E;white-space:nowrap}
      .frm-price{font-family:'Cormorant Garamond',serif;font-size:1.37rem;color:#E0CFB0;font-variant-numeric:tabular-nums;overflow-wrap:anywhere}
      .frm-change{font-size:.74rem;color:#B6A38A}.frm-note{font-size:.67rem;line-height:1.5;color:#897C6C;min-height:2.5em}
      .frm-origin{margin-top:auto;padding-top:7px;border-top:1px solid #2F2820;font-size:.64rem;color:#807463;display:flex;gap:6px;justify-content:space-between;align-items:center;flex-wrap:wrap}
      .frm a{color:#A68B62;text-underline-offset:3px}.frm a:hover{color:#C9A96E}
      .frm-bottom{margin-top:14px;font-size:.7rem;color:#978976;line-height:1.7}.frm-details{margin-top:8px}
      .frm-details summary{cursor:pointer;color:#BDA57E}.frm-details p{margin-top:7px}.frm-error{color:#E8A396}
      @media(max-width:960px){.frm-grid{grid-template-columns:repeat(2,minmax(0,1fr))}}
      @media(max-width:530px){.frm{padding:14px}.frm-head{align-items:start}.frm h2{font-size:1.28rem}.frm-grid{grid-template-columns:1fr}.frm-summary{display:block}.frm-context{margin-top:9px}.frm-card{padding:13px}.frm button{padding:7px 9px}}
    `}</style>
    <div className="frm-head">
      <div><div className="frm-kicker">CAPITAL FLOW LAB / GLOBAL STRESS WATCH</div><h2>世界金融リスク監視</h2>
        <p className="frm-sub">金利・為替・原油・金・信用・変動率・株式を横断観測。1指標だけで「暴落開始」と決めない。</p>
      </div>
      <button type="button" disabled={loading} onClick={()=>void refresh()}>{loading?'取得中…':'更新'}</button>
    </div>
    <div className="frm-summary" aria-live="polite">
      <div className="frm-level" data-level={level}>{loading&&!data?'判定準備中':levels[level]}</div>
      <div className="frm-context">{error?'市場データを取得できませんでした。更新をお試しください。':data?.summary.description??'各市場データを読み込んでいます。'}
        <small>{data ? `判定できた指標 ${data.summary.coverage} / ${data.summary.expected} · 取得確認 ${dateLabel(data.asOf)}（日本時間）` : '未取得の指標を平常として扱いません。'}</small>
      </div>
    </div>
    <div className="frm-grid">
      {data?.signals.map(s=><article key={s.key} className="frm-card">
        <div className="frm-top"><h3 className="frm-card-title">{s.label}</h3><span className="frm-indicator">{levels[s.level]}</span></div>
        <div className="frm-price">{s.formatted}</div>
        <div className="frm-change">{changeLabel(s)}</div>
        <p className="frm-note">{s.note}</p>
        <div className="frm-origin"><span>{dateLabel(s.observedAt)} JST</span><a href={s.sourceUrl} target="_blank" rel="noopener noreferrer" aria-label={s.label+' のデータ提供元を開く'}>{s.source} ↗</a></div>
      </article>)}
      {!data && !error && <p className="frm-sub">市場データを取得しています…</p>}
    </div>
    <div className="frm-bottom">
      <span className={error?'frm-error':''}>参考リスク分類であり、金融危機の確定判定や投資助言ではありません。取引判断・発注は手動。</span>
      <details className="frm-details"><summary>判定基準とデータの注意点</summary>
        <p>米10年債: 約1か月の利回り上昇40/75/125bp。原油: 100/120/150ドルまたは月間上昇15/25/40%。ドル円: 月間変化の絶対値5/8/12%。金: 月間上昇8/14/22%。信用スプレッド: 4.5/6/8%または月間拡大1/2/3ポイント。VIX: 20/30/45。NASDAQ: 約1か月の終値高値から8/13/20%下落。左から注意/警戒/危機水準の閾値。</p>
        <p>集計は取得済み5指標以上で実施。複数指標の同時悪化を重視。日本国債は公式系列の接続まで未評価。Yahoo Financeは参考値、FRED/ICE BofAのOASは公表の遅れがあり得ます。表示日時は必ず確認してください。</p>
      </details>
    </div>
  </section>;
}
