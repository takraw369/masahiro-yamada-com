import { useCallback, useEffect, useMemo, useState } from 'react';
import type { MarketGroup, MarketObservation, MomentumSignal } from '../../lib/marketFlowIntelligence';

type Payload={
  ok:boolean;
  checkedAt:string;
  benchmark:string;
  warning:string;
  metric:string;
  coverage:{valid:number;relative:number;total:number};
  actualFundFlow:{connected:boolean;description:string};
  observations:MarketObservation[];
};

type Filter='all'|MarketGroup;
type Window='1m'|'3m';

const groups:{key:Filter;label:string}[]=[
  {key:'all',label:'すべて'},
  {key:'world',label:'地域'},
  {key:'us',label:'米国株'},
  {key:'sector',label:'セクター'},
  {key:'defensive',label:'債券・金'},
];
const signals:Record<MomentumSignal,string>={
  persistent:'強さ継続',emerging:'短期優位',lagging:'相対的に弱い',mixed:'混在',unknown:'未判定',
};
const fmt=(n:number|null,suffix='%')=>n===null?'—':(n>0?'+':'')+n.toFixed(2)+suffix;
const stamp=(s:string|null)=>s&&Number.isFinite(Date.parse(s))
  ? new Date(s).toLocaleString('ja-JP',{timeZone:'Asia/Tokyo',year:'numeric',month:'numeric',day:'numeric',hour:'2-digit',minute:'2-digit'})
  : '日時不明';
const KEY='masa-capital-flow-watch-v1';

function brief(asset:MarketObservation, checkedAt:string):string {
  return [
    '【Capital Flow Lab｜調査ブリーフ】',
    asset.label+' ('+asset.ticker+')',
    '観測日時: '+stamp(asset.asOf)+' 日本時間 / 取得確認 '+stamp(checkedAt),
    'データ: Yahoo Finance 参考価格 / '+(asset.priceBasis==='adjusted'?'調整後終値':'終値'),
    '約1か月騰落率: '+fmt(asset.oneMonthPct),
    '約3か月騰落率: '+fmt(asset.threeMonthsPct),
    'SPYとの約1か月差: '+fmt(asset.relativeOneMonthPp,'pp'),
    'SPYとの約3か月差: '+fmt(asset.relativeThreeMonthsPp,'pp'),
    '相対強弱の分類: '+signals[asset.signal],
    '価格強弱から実際の資金流入出は推定できない。',
    '',
    '次に検証すること:',
    '1. 現象: 相対強弱は何によって生じたか（業績、金利、為替、需給）',
    '2. 反証: 逆方向のデータと一時的要因はないか',
    '3. 一次資料: ETF運用会社の資料、構成銘柄のIR、該当する公的統計',
    '4. 必要に応じて公式のETF純資金流入出を別途確認',
    '5. 継続条件と見直し条件を記録（売買は人が判断）',
    '価格出典: '+asset.sourceUrl,
  ].join('\n');
}

export default function MarketFlowIntelligence(){
  const [opened,setOpened]=useState(false);
  const [data,setData]=useState<Payload|null>(null);
  const [loading,setLoading]=useState(false);
  const [error,setError]=useState<string|null>(null);
  const [filter,setFilter]=useState<Filter>('all');
  const [window,setWindow]=useState<Window>('1m');
  const [watch,setWatch]=useState<string[]>([]);
  const [notice,setNotice]=useState<string|null>(null);
  const [watchOnly,setWatchOnly]=useState(false);

  useEffect(()=>{
    try {
      const stored=JSON.parse(localStorage.getItem(KEY)??'[]');
      if(Array.isArray(stored)) setWatch(stored.filter((v):v is string=>typeof v==='string').slice(0,30));
    } catch {}
  },[]);

  const load=useCallback(async()=>{
    setLoading(true);setError(null);setOpened(true);
    try{
      const response=await fetch('/api/dashboard/market-flow',{cache:'no-store'});
      if(!response.ok) throw new Error('http');
      const next:Payload=await response.json();
      if(!Array.isArray(next?.observations)||!next.coverage) throw new Error('invalid');
      setData(next);
    }catch{
      setError('データが取得できません。更新ボタンから再試行できます。');
      setData(null);
    }finally{setLoading(false);}
  },[]);

  const toggleWatch=(key:string)=>{
    setWatch(current=>{
      const next=current.includes(key)?current.filter(v=>v!==key):[...current,key].slice(0,30);
      try{localStorage.setItem(KEY,JSON.stringify(next));}catch{}
      return next;
    });
  };

  const sorted=useMemo(()=>{
    if(!data) return [];
    const score=(o:MarketObservation)=>window==='1m'?o.relativeOneMonthPp:o.relativeThreeMonthsPp;
    return data.observations
      .filter(o=>(filter==='all'||o.group===filter)&&(!watchOnly||watch.includes(o.key)))
      .sort((a,b)=>(score(b)??-999)-(score(a)??-999));
  },[data,filter,window,watchOnly,watch]);

  const copyBrief=async(o:MarketObservation)=>{
    if(!data) return;
    try{
      await navigator.clipboard.writeText(brief(o,data.checkedAt));
      setNotice(o.ticker+'の調査ブリーフをコピー');
    }catch{setNotice('コピーできません。ブラウザのクリップボード権限をご確認ください。');}
  };

  return <section className="mfi" aria-label="マーケット資金循環・調査候補">
    <style>{`
      .mfi{margin:0 0 26px;background:#0D0B08;border:1px solid #3A3023;color:#D4C5A9;padding:20px;font-family:'Zen Kaku Gothic New',sans-serif}
      .mfi *{box-sizing:border-box}.mfi-head{display:flex;justify-content:space-between;align-items:start;gap:14px}
      .mfi-kicker{font-size:.65rem;color:#8B7355;letter-spacing:.13em}.mfi h2{font-family:'Cormorant Garamond',serif;font-weight:400;color:#C9A96E;font-size:1.55rem;margin:5px 0}
      .mfi-lead{font-size:.78rem;line-height:1.7;color:#AD9B82;max-width:770px}
      .mfi button{background:transparent;border:1px solid #594A35;color:#D4C5A9;padding:9px 12px;cursor:pointer;min-height:44px;font-size:.73rem}
      .mfi button:disabled{opacity:.55;cursor:wait}.mfi button:focus-visible,.mfi button:hover{border-color:#C9A96E}
      .mfi .mfi-primary{border-color:#C9A96E;background:#332A1E;color:#E5CC9A;white-space:nowrap}
      .mfi-status{padding:12px 0 0;font-size:.74rem;color:#B2A186;line-height:1.65}
      .mfi-status b{color:#E8C78A}.mfi-error{color:#E59E90}.mfi-controls{margin:16px 0 12px;display:flex;gap:10px;flex-wrap:wrap;align-items:center}
      .mfi-segment{display:flex;gap:5px;flex-wrap:wrap}.mfi button[aria-pressed="true"]{border-color:#C9A96E;color:#F0DAB1;background:#30271C}
      .mfi-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:10px}
      .mfi-card{min-width:0;display:flex;flex-direction:column;gap:10px;background:#1A1612;border:1px solid #342B22;padding:14px}
      .mfi-card-head{display:flex;justify-content:space-between;gap:12px;align-items:start}
      .mfi-label{font-size:.79rem;color:#D8C5A7}.mfi-code{font-size:.66rem;color:#8B7355;margin-top:3px}
      .mfi-badge{font-size:.66rem;white-space:nowrap;color:#B8AA90}.mfi-badge[data-signal="persistent"]{color:#87B59B}.mfi-badge[data-signal="emerging"]{color:#EAC083}
      .mfi-values{display:grid;grid-template-columns:1fr 1fr;gap:8px}.mfi-small{font-size:.65rem;color:#988873}.mfi-value{font-size:1.1rem;font-variant-numeric:tabular-nums;color:#DCC7A4;margin-top:3px}
      .mfi-sub{color:#8E8172;font-size:.69rem;line-height:1.55}
      .mfi-actions{margin-top:auto;display:flex;flex-wrap:wrap;gap:6px}.mfi-actions button{min-height:40px;padding:7px 9px}
      .mfi a{color:#B7A079;text-underline-offset:3px}.mfi-foot{border-top:1px solid #332C23;margin-top:18px;padding-top:12px;font-size:.72rem;color:#988873;line-height:1.75}
      .mfi-foot summary{cursor:pointer;color:#BAA17B}.mfi-foot p{margin-top:8px}.mfi-flow-status{margin-top:12px;padding:10px;border:1px solid #433627;font-size:.72rem;color:#BDAB8F}
      .mfi-empty{grid-column:1/-1;padding:22px 10px;font-size:.75rem;color:#9D8C72}.mfi-notice{font-size:.72rem;color:#E6C38D}
      @media(max-width:1080px){.mfi-grid{grid-template-columns:repeat(2,minmax(0,1fr))}}
      @media(max-width:660px){.mfi{padding:14px}.mfi-head{display:block}.mfi-primary{margin-top:14px}.mfi-grid{grid-template-columns:1fr}.mfi-controls{align-items:flex-start}.mfi h2{font-size:1.3rem}}
    `}</style>
    <div className="mfi-head">
      <div><p className="mfi-kicker">CAPITAL FLOW LAB / RELATIVE STRENGTH & RESEARCH</p>
        <h2>世界市場の強弱と機会の探索</h2>
        <p className="mfi-lead">地域・米国株・セクター・金・債券を同じ基準で比較。価格の相対強弱から「次に調べる対象」を発見する。買いシグナルではない。</p>
      </div>
      <button type="button" className="mfi-primary" onClick={()=>void load()} disabled={loading}>{loading?'取得中…':data?'市場データ更新':'市場比較を開く'}</button>
    </div>
    <div className="mfi-flow-status"><strong>実際の資金流入出: 未接続</strong>　価格の上昇を「資金流入」とは判定しない。資金流入出は運用会社等の検証済み統計が接続できてから追加。</div>
    {opened && <div className="mfi-status" aria-live="polite">
      {error?<span className="mfi-error">{error}</span>:data
        ? <><b>取得できた比較: {data.coverage.relative} / {data.coverage.total}</b> ・ データ確認 {stamp(data.checkedAt)} 日本時間
          {data.coverage.relative<5?'　十分な比較データがないため順位の解釈に注意。':''}</>
        : 'データ取得中。未取得データを強気・弱気に分類しません。'}
    </div>}
    {data && <>
      <div className="mfi-controls">
        <div className="mfi-segment" aria-label="カテゴリ">{groups.map(g=><button key={g.key} type="button" aria-pressed={filter===g.key} onClick={()=>setFilter(g.key)}>{g.label}</button>)}</div>
        <div className="mfi-segment" aria-label="期間">
          <button type="button" aria-pressed={window==='1m'} onClick={()=>setWindow('1m')}>約1か月</button>
          <button type="button" aria-pressed={window==='3m'} onClick={()=>setWindow('3m')}>約3か月</button>
        </div>
        <button type="button" aria-pressed={watchOnly} onClick={()=>setWatchOnly(v=>!v)}>調査キューのみ ({watch.length})</button>
      </div>
      <div className="mfi-grid">
        {sorted.length===0 && <p className="mfi-empty">表示対象なし。カテゴリ・調査キューの条件を切り替えてください。</p>}
        {sorted.map(o=>{
          const absolute=window==='1m'?o.oneMonthPct:o.threeMonthsPct;
          const relative=window==='1m'?o.relativeOneMonthPp:o.relativeThreeMonthsPp;
          return <article className="mfi-card" key={o.key}>
            <div className="mfi-card-head"><div><div className="mfi-label">{o.label}</div><div className="mfi-code">{o.ticker} / {o.detail}</div></div>
              <span className="mfi-badge" data-signal={o.signal}>{signals[o.signal]}</span></div>
            <div className="mfi-values">
              <div><div className="mfi-small">{window==='1m'?'約1か月':'約3か月'}騰落率</div><div className="mfi-value">{fmt(absolute)}</div></div>
              <div><div className="mfi-small">SPY比（百分点）</div><div className="mfi-value">{fmt(relative,'pp')}</div></div>
            </div>
            <div className="mfi-sub">約1か月 {fmt(o.oneMonthPct)} ・ 約3か月 {fmt(o.threeMonthsPct)} / SPY比 {fmt(o.relativeOneMonthPp,'pp')}・{fmt(o.relativeThreeMonthsPp,'pp')}</div>
            <div className="mfi-sub">価格観測 {stamp(o.asOf)} / {o.priceBasis==='adjusted'?'調整後終値':o.priceBasis==='raw'?'配当未調整の終値':'データ未取得'}</div>
            {o.error && <div className="mfi-sub">{o.error}</div>}
            <div className="mfi-actions">
              <button type="button" aria-pressed={watch.includes(o.key)} onClick={()=>toggleWatch(o.key)}>{watch.includes(o.key)?'調査キューから外す':'調査キューに追加'}</button>
              <button type="button" onClick={()=>void copyBrief(o)}>検証ブリーフをコピー</button>
              <a href={o.sourceUrl} target="_blank" rel="noreferrer" style={{alignSelf:'center',fontSize:'.7rem'}}>出典 ↗</a>
            </div>
          </article>;
        })}
      </div>
      {notice&&<p className="mfi-notice" role="status">{notice}</p>}
      <div className="mfi-foot">
        <p>「強さ継続」はSPY比で1か月・3か月とも3pp以上、「短期優位」は1か月のみ3pp以上、「相対的に弱い」は両期間とも-3pp以下。その他は混在／未判定。調査キューはこのブラウザだけに保存され、既存の投資ポジションや投資仮説を自動変更しません。</p>
        <details><summary>価格と資金循環を混同しないための注意</summary>
          <p>米国上場ETFの約21/63取引セッションの騰落率を比較し、SPYとの差を百分点で表示。配当調整価格が取得できた場合は調整後終値を利用。比較期間・休日・為替・分配金・商品構造の違いに注意。EWJは円建て日経平均ではなく為替ヘッジなしの米ドル建て日本株ETF。</p>
          <p>実際の資金フローを知るにはETF設定解約データ、投資信託資金流入出統計や資金移動・ポジショニングを別途検証する必要がある。リターン上位だから買うという判断には使わず、反証と一次情報を優先する。</p>
        </details>
      </div>
    </>}
  </section>;
}
