/**
 * Price-strength observation for Capital Flow Lab.
 * This deliberately does NOT infer ETF creation/redemption flows or institutional positions.
 */
export type MarketGroup = 'world' | 'us' | 'sector' | 'defensive';
export type MomentumSignal = 'persistent' | 'emerging' | 'lagging' | 'mixed' | 'unknown';

export type MarketInstrument = {
  key: string;
  ticker: string;
  label: string;
  group: MarketGroup;
  detail: string;
};

export const MARKET_INSTRUMENTS: readonly MarketInstrument[] = [
  { key:'spy',ticker:'SPY',label:'米国大型株',group:'us',detail:'S&P 500 ETF・比較基準' },
  { key:'qqq',ticker:'QQQ',label:'米国大型グロース',group:'us',detail:'NASDAQ-100連動ETF' },
  { key:'iwm',ticker:'IWM',label:'米国小型株',group:'us',detail:'Russell 2000連動ETF' },
  { key:'ewj',ticker:'EWJ',label:'日本株（米ドル建て）',group:'world',detail:'為替ヘッジなしの米国上場日本株ETF' },
  { key:'eem',ticker:'EEM',label:'新興国株',group:'world',detail:'米ドル建て新興国株ETF' },
  { key:'tlt',ticker:'TLT',label:'米国長期国債',group:'defensive',detail:'長期米国債ETF（価格は金利に逆行しやすい）' },
  { key:'gld',ticker:'GLD',label:'金',group:'defensive',detail:'金価格に連動する米国上場ETF' },
  { key:'xle',ticker:'XLE',label:'米国エネルギー株',group:'sector',detail:'エネルギー株セクターETF' },
  { key:'xlf',ticker:'XLF',label:'米国金融株',group:'sector',detail:'金融株セクターETF' },
  { key:'xlk',ticker:'XLK',label:'米国テクノロジー株',group:'sector',detail:'情報技術株セクターETF' },
  { key:'xlv',ticker:'XLV',label:'米国ヘルスケア株',group:'sector',detail:'ヘルスケア株セクターETF' },
] as const;

export type PricePoint = { at: number; price: number };
export type MarketObservation = MarketInstrument & {
  asOf: string | null;
  close: number | null;
  oneMonthPct: number | null;
  threeMonthsPct: number | null;
  relativeOneMonthPp: number | null;
  relativeThreeMonthsPp: number | null;
  signal: MomentumSignal;
  priceBasis: 'adjusted' | 'raw' | 'unknown';
  sourceUrl: string;
  error: string | null;
};

export const BENCHMARK_KEY = 'spy';
const percentChange = (last:number,first:number) => (last / first - 1) * 100;
const round = (v: number) => Math.round(v * 100) / 100;

/** US exchange close timestamps can be up to 8 calendar days old before the indicator is invalidated. */
export function summarizePrices(points: readonly PricePoint[], nowMs = Date.now()) {
  const cleaned = points.filter(p => Number.isFinite(p.at) && Number.isFinite(p.price) && p.price > 0)
    .sort((a,b) => a.at - b.at)
    .filter((p,i,arr) => i === arr.length-1 || p.at !== arr[i+1].at);
  const last=cleaned.at(-1);
  if(!last) return {close:null,asOf:null,oneMonthPct:null,threeMonthsPct:null,reason:'価格履歴なし'};
  const asOf=new Date(last.at*1000).toISOString();
  const ageMs=nowMs-last.at*1000;
  if(ageMs > 8*86400000 || ageMs < -86400000)
    return {close:last.price,asOf,oneMonthPct:null,threeMonthsPct:null,reason:'観測値が古いか未来の日付'};
  // 21/63 market sessions apart: 22/64 observations are required, incl. latest.
  const oneMonthPct=cleaned.length >= 22 ? round(percentChange(last.price,cleaned.at(-22)!.price)) : null;
  const threeMonthsPct=cleaned.length >= 64 ? round(percentChange(last.price,cleaned.at(-64)!.price)) : null;
  return {close:last.price,asOf,oneMonthPct,threeMonthsPct,reason:oneMonthPct===null||threeMonthsPct===null?'比較期間の履歴不足':null};
}

/**
 * Qualitative screening labels only. Outperformance is percentage-point difference of returns.
 * No bullish/bearish prediction, buy/sell recommendation, or fund flow inference.
 */
export function momentumSignal(relativeOneMonthPp:number|null,relativeThreeMonthsPp:number|null):MomentumSignal {
  if(relativeOneMonthPp===null || relativeThreeMonthsPp===null) return 'unknown';
  if(relativeOneMonthPp>=3 && relativeThreeMonthsPp>=3) return 'persistent';
  if(relativeOneMonthPp>=3 && relativeThreeMonthsPp<3) return 'emerging';
  if(relativeOneMonthPp<=-3 && relativeThreeMonthsPp<=-3) return 'lagging';
  return 'mixed';
}

export function buildMarketObservations(
  samples: Record<string,{points:PricePoint[];priceBasis:'adjusted'|'raw'|'unknown';error?:string|null}>,
  nowMs=Date.now(),
): MarketObservation[] {
  const calculated = MARKET_INSTRUMENTS.map(instrument=>{
    const s=samples[instrument.key];
    const summary=summarizePrices(s?.points ?? [],nowMs);
    return {instrument,s,summary};
  });
  const base=calculated.find(x=>x.instrument.key===BENCHMARK_KEY)?.summary;
  return calculated.map(({instrument,s,summary})=>{
    // Prevent comparing unmatched trade dates as if synchronized.
    const inSync=base?.asOf && summary.asOf
      && Math.abs(Date.parse(base.asOf)-Date.parse(summary.asOf))<=3*86400000;
    const oneMonthRelative=inSync && base?.oneMonthPct!==null && base?.oneMonthPct!==undefined && summary.oneMonthPct!==null
      ? round(summary.oneMonthPct-base.oneMonthPct) : null;
    const threeMonthRelative=inSync && base?.threeMonthsPct!==null && base?.threeMonthsPct!==undefined && summary.threeMonthsPct!==null
      ? round(summary.threeMonthsPct-base.threeMonthsPct) : null;
    return {
      ...instrument,asOf:summary.asOf,close:summary.close,
      oneMonthPct:summary.oneMonthPct,threeMonthsPct:summary.threeMonthsPct,
      relativeOneMonthPp:oneMonthRelative,relativeThreeMonthsPp:threeMonthRelative,
      signal:momentumSignal(oneMonthRelative,threeMonthRelative),
      priceBasis:s?.priceBasis??'unknown',
      sourceUrl:'https://finance.yahoo.com/quote/'+encodeURIComponent(instrument.ticker)+'/',
      error:s?.error ?? summary.reason,
    };
  });
}

export function marketFlowCoverage(observations:readonly MarketObservation[]) {
  const valid=observations.filter(o=>o.oneMonthPct!==null && o.threeMonthsPct!==null).length;
  const relative=observations.filter(o=>o.relativeOneMonthPp!==null && o.relativeThreeMonthsPp!==null).length;
  return {valid,relative,total:observations.length};
}
