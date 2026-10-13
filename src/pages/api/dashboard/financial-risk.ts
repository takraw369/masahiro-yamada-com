import type { APIContext } from 'astro';
import { classifyFinancialRisk, summarizeFinancialRisk, type RiskSignal } from '../../../lib/financialRisk';

type YahooConfig = {
  key: string; label: string; ticker: string; decimals: number;
  prefix?: string; suffix?: string; note: string;
};
const YAHOO: YahooConfig[] = [
  { key:'ust10', label:'米国10年債利回り', ticker:'^TNX', decimals:2, suffix:'%', note:'1か月の利回り上昇幅をbpで判定' },
  { key:'oil', label:'WTI原油先物', ticker:'CL=F', decimals:2, prefix:'$', note:'価格水準と1か月の上昇率を判定' },
  { key:'usdjpy', label:'ドル円', ticker:'JPY=X', decimals:2, suffix:'円', note:'1か月の変化率の絶対値を判定（方向問わず）' },
  { key:'gold', label:'金先物', ticker:'GC=F', decimals:2, prefix:'$', note:'1か月の上昇率を観測。上昇だけで危機とは断定しない' },
  { key:'vix', label:'VIX指数', ticker:'^VIX', decimals:2, note:'20 / 30 / 45の閾値で市場の変動率を観測' },
  { key:'nasdaq', label:'NASDAQ総合', ticker:'^IXIC', decimals:0, note:'直近およそ1か月の終値高値からの下落率' },
];
const FRED_URL = 'https://fred.stlouisfed.org/graph/fredgraph.csv?id=BAMLH0A0HYM2';

const finite = (v: unknown): number | null => typeof v === 'number' && Number.isFinite(v) ? v : null;
const isFresh = (iso: string | null, days: number): boolean =>
  iso !== null && Number.isFinite(Date.parse(iso)) && Date.now() - Date.parse(iso) <= days * 86400000
    && Date.now() - Date.parse(iso) >= -86400000;
const percent = (now: number, then: number | null): number | null => then != null && then !== 0 ? (now / then - 1) * 100 : null;
const fmt = (v: number, decimals: number) => v.toLocaleString('ja-JP', { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
const blank = (key:string, label:string, source:string, sourceUrl:string, note:string): RiskSignal =>
  ({key,label,value:null,formatted:'取得不可',monthChange:null,monthChangeUnit:null,observedAt:null,source,sourceUrl,level:'unknown',note});

async function yahoo(config: YahooConfig): Promise<RiskSignal> {
  const sourceUrl = 'https://finance.yahoo.com/quote/' + encodeURIComponent(config.ticker) + '/';
  const source = 'Yahoo Finance（参考値）';
  const fallback = blank(config.key,config.label,source,sourceUrl,'データを取得できません。自動的に平常とは判定しません。');
  try {
    const url = 'https://query1.finance.yahoo.com/v8/finance/chart/' + encodeURIComponent(config.ticker) + '?interval=1d&range=3mo';
    const r = await fetch(url,{ headers:{'User-Agent':'Mozilla/5.0 MASA-OS/1.0',Accept:'application/json'}, signal:AbortSignal.timeout(8000) });
    if (!r.ok) return fallback;
    const result:any = (await r.json())?.chart?.result?.[0];
    const close: unknown[] = result?.indicators?.quote?.[0]?.close ?? [];
    const stamps: unknown[] = result?.timestamp ?? [];
    const bars = close.map((v,i)=>({price:finite(v),time:finite(stamps[i])})).filter((v):v is {price:number;time:number}=>v.price!==null && v.time!==null);
    if (!bars.length) return fallback;
    const recent = bars.at(-1)!;
    const meta = result?.meta ?? {};
    const metaPrice = finite(meta.regularMarketPrice);
    const metaTime = finite(meta.regularMarketTime);
    const useMeta = metaPrice !== null && metaTime !== null && metaTime >= recent.time && metaTime < Date.now()/1000 + 3600;
    const current = useMeta ? metaPrice! : recent.price;
    const observedAt = new Date((useMeta ? metaTime! : recent.time) * 1000).toISOString();
    const compare = bars.length >= 21 ? bars.at(-21)!.price : null;
    const change = percent(current,compare);
    const latestHigh = bars.length >= 15 ? Math.max(current,...bars.slice(-21).map(v=>v.price)) : null;
    const drawdownPct = latestHigh ? (current/latestHigh - 1)*100 : null;
    const monthChange = config.key === 'ust10' ? (compare === null ? null : current-compare) : change;
    const unit = config.key === 'ust10' ? 'bp' : '%';
    const displayChange = config.key === 'ust10' && monthChange !== null ? monthChange*100 : monthChange;
    const fresh = isFresh(observedAt,8);
    const enoughHistory = config.key !== 'nasdaq' || drawdownPct !== null;
    const level = fresh && enoughHistory ? classifyFinancialRisk(config.key,current,monthChange,drawdownPct) : 'unknown';
    return {
      key:config.key,label:config.label,value:current,
      formatted:(config.prefix??'')+fmt(current,config.decimals)+(config.suffix??''),
      monthChange:displayChange,monthChangeUnit:unit,observedAt,source,sourceUrl,level,
      note: !fresh?'更新日時が古いため評価対象外':!enoughHistory?'判定に必要な過去データ不足':config.note,
    };
  } catch { return fallback; }
}

async function creditSpread(): Promise<RiskSignal> {
  const key='credit',label='米ハイイールド債 OAS',source='FRED / ICE BofA';
  const sourceUrl='https://fred.stlouisfed.org/series/BAMLH0A0HYM2';
  const fallback=blank(key,label,source,sourceUrl,'FRED系列の取得失敗。信用ストレスは未判定。');
  try {
    const r=await fetch(FRED_URL,{headers:{Accept:'text/csv'},signal:AbortSignal.timeout(8000)});
    if (!r.ok) return fallback;
    const lines=(await r.text()).trim().split(/\\r?\\n/);
    const rows=lines.slice(1).map(line=>{
      const [date,val]=line.replace(/"/g,'').split(',');
      const value=Number(val);
      return {date,value};
    }).filter(row=>/^\\d{4}-\\d{2}-\\d{2}$/.test(row.date)&&Number.isFinite(row.value)&&row.value>0);
    if (!rows.length) return fallback;
    const last=rows.at(-1)!;
    const observedAt=last.date+'T00:00:00.000Z';
    const compare=rows.length>=21?rows.at(-21)!.value:null;
    const monthChange=compare === null ? null : last.value-compare;
    const fresh=isFresh(observedAt,10);
    return {
      key,label,value:last.value,formatted:fmt(last.value,2)+'%',monthChange,monthChangeUnit:'pp',
      observedAt,source,sourceUrl,
      level:fresh?classifyFinancialRisk(key,last.value,monthChange):'unknown',
      note:fresh?'ICE BofA米国HY債のオプション調整後スプレッド（%）':'更新日時が古いため評価対象外',
    };
  } catch { return fallback; }
}

export const GET = async (_context: APIContext) => {
  const results=await Promise.all([yahoo(YAHOO[0]), creditSpread(), ...YAHOO.slice(1).map(yahoo)]);
  const jgb: RiskSignal = {
    key:'jgb10',label:'日本10年国債',value:null,formatted:'未接続',
    monthChange:null,monthChangeUnit:null,observedAt:null,source:'日本国債（要公式データ接続）',
    sourceUrl:'https://www.mof.go.jp/jgbs/reference/interest_rate/index.htm',
    level:'unknown',note:'正確な公式系列の接続まで推測値を使わない',
  };
  const signals=[results[0],jgb,...results.slice(2,4),results[4],results[1],...results.slice(5)];
  return new Response(JSON.stringify({
    ok: signals.some(s=>s.level!=='unknown'),asOf:new Date().toISOString(),
    summary:summarizeFinancialRisk(signals),signals,
    methodology:'閾値に基づく参考警戒指標。金融危機発生や将来価格を予測しない。',
  }),{status:200,headers:{'Content-Type':'application/json; charset=utf-8','Cache-Control':'private, max-age=300'}});
};
