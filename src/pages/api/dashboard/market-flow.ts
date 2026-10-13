import type { APIContext } from 'astro';
import {
  MARKET_INSTRUMENTS, buildMarketObservations, marketFlowCoverage,
  type PricePoint, type MarketInstrument,
} from '../../../lib/marketFlowIntelligence';

type Sample = {
  points:PricePoint[];
  priceBasis:'adjusted'|'raw'|'unknown';
  error:string|null;
};

async function yahooHistory(asset:MarketInstrument):Promise<Sample> {
  try {
    const url='https://query1.finance.yahoo.com/v8/finance/chart/'
      + encodeURIComponent(asset.ticker) + '?interval=1d&range=6mo';
    const response=await fetch(url,{
      headers:{'User-Agent':'Mozilla/5.0 MASA-OS-MarketIntelligence/1.0',Accept:'application/json'},
      signal:AbortSignal.timeout(8000),
    });
    if(!response.ok) throw new Error('source_http_'+response.status);
    const json:any=await response.json();
    const result=json?.chart?.result?.[0];
    const timestamps:unknown[]=result?.timestamp??[];
    const raw:unknown[]=result?.indicators?.quote?.[0]?.close??[];
    const adjusted:unknown[]=result?.indicators?.adjclose?.[0]?.adjclose??[];
    const hasAdjusted=adjusted.length===timestamps.length
      && adjusted.length>=64
      && adjusted.every(p=>typeof p==='number'&&Number.isFinite(p)&&p>0);
    const prices=hasAdjusted?adjusted:raw;
    if(!Array.isArray(timestamps)||!Array.isArray(prices)||timestamps.length!==prices.length)
      throw new Error('invalid_chart');
    const points:PricePoint[]=timestamps.flatMap((t,i)=>{
      const p=prices[i];
      return typeof t==='number'&&Number.isFinite(t)&&typeof p==='number'&&Number.isFinite(p)&&p>0
        ? [{at:t,price:p}] : [];
    });
    if(!points.length) throw new Error('empty_history');
    return {points,priceBasis:hasAdjusted?'adjusted':'raw',error:null};
  } catch {
    return {points:[],priceBasis:'unknown',error:'市場データを取得できません。時間をおいて再試行してください。'};
  }
}

// Cache only briefly: the UI also shows each source observation time.
export const GET = async (_context:APIContext) => {
  const fetched=await Promise.all(MARKET_INSTRUMENTS.map(yahooHistory));
  const samples=Object.fromEntries(MARKET_INSTRUMENTS.map((asset,i)=>[asset.key,fetched[i]]));
  const observations=buildMarketObservations(samples);
  const coverage=marketFlowCoverage(observations);
  return new Response(JSON.stringify({
    ok:coverage.valid>0,
    checkedAt:new Date().toISOString(),
    benchmark:'SPY',
    metric:'ETFの調整後終値（利用可能な場合）の約21/63取引セッション騰落率',
    warning:'価格の相対的な強弱は実際の資金流入出・ETF設定解約・投資家ポジションを意味しません。',
    actualFundFlow:{connected:false,description:'公式または契約済みの純資金流入出データは未接続'},
    coverage,
    observations,
  }),{headers:{'Content-Type':'application/json; charset=utf-8','Cache-Control':'private, max-age=300'}});
};
