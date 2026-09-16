import type { APIContext } from 'astro';

type MarketConfig = { key:string; label:string; symbol:string; decimals:number; suffix?:string; group:'EQUITY'|'FX'|'RATES'|'HARD ASSETS'|'RISK' };
const MARKET: MarketConfig[] = [
  { key:'nikkei', label:'Nikkei 225', symbol:'^N225', decimals:2, group:'EQUITY' },
  { key:'sp500', label:'S&P 500', symbol:'^GSPC', decimals:2, group:'EQUITY' },
  { key:'nasdaq', label:'NASDAQ', symbol:'^IXIC', decimals:2, group:'EQUITY' },
  { key:'topix', label:'TOPIX', symbol:'^TOPX', decimals:2, group:'EQUITY' },
  { key:'usdjpy', label:'USD / JPY', symbol:'JPY=X', decimals:2, group:'FX' },
  { key:'dxy', label:'DXY', symbol:'DX-Y.NYB', decimals:2, group:'FX' },
  { key:'ust10', label:'US 10Y', symbol:'^TNX', decimals:3, suffix:'%', group:'RATES' },
  { key:'gold', label:'Gold', symbol:'GC=F', decimals:2, suffix:'$', group:'HARD ASSETS' },
  { key:'wti', label:'WTI Oil', symbol:'CL=F', decimals:2, suffix:'$', group:'HARD ASSETS' },
  { key:'copper', label:'Copper', symbol:'HG=F', decimals:3, suffix:'$', group:'HARD ASSETS' },
  { key:'vix', label:'VIX', symbol:'^VIX', decimals:2, group:'RISK' },
  { key:'btc', label:'BTC / USD', symbol:'BTC-USD', decimals:0, suffix:'$', group:'RISK' },
];

const json=(body:unknown,status=200)=>new Response(JSON.stringify(body),{status,headers:{'Content-Type':'application/json','Cache-Control':'private, max-age=60'}});
const finite=(v:unknown):number|null=>typeof v==='number'&&Number.isFinite(v)?v:null;

async function fetchChart(config:MarketConfig){
  try{
    const url=`https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(config.symbol)}?interval=1d&range=5d`;
    const response=await fetch(url,{headers:{'User-Agent':'Mozilla/5.0 MASA-OS-InvestmentDashboard/1.0',Accept:'application/json'}});
    if(!response.ok) throw new Error(`http_${response.status}`);
    const data:any=await response.json(); const meta=data?.chart?.result?.[0]?.meta||{};
    const price=finite(meta.regularMarketPrice); const previousClose=finite(meta.chartPreviousClose)??finite(meta.previousClose);
    const changePct=price!=null&&previousClose?((price-previousClose)/previousClose)*100:null; const marketTime=finite(meta.regularMarketTime);
    const formatted=price==null?'取得失敗':`${config.suffix==='$'?'$':''}${price.toLocaleString('ja-JP',{minimumFractionDigits:config.decimals,maximumFractionDigits:config.decimals})}${config.suffix&&config.suffix!=='$'?config.suffix:''}`;
    return {key:config.key,label:config.label,symbol:config.symbol,group:config.group,ok:price!=null,price,previousClose,changePct,formatted,observedAt:marketTime?new Date(marketTime*1000).toISOString():null,source:'Yahoo Finance chart API'};
  }catch(error){return {key:config.key,label:config.label,symbol:config.symbol,group:config.group,ok:false,price:null,previousClose:null,changePct:null,formatted:'取得失敗',observedAt:null,source:'Yahoo Finance chart API',error:String(error)}}
}

export const GET=async(_context:APIContext)=>{
  const signals=await Promise.all(MARKET.map(fetchChart));
  return json({ok:signals.some(s=>s.ok),asOf:new Date().toISOString(),signals,unknown:[{key:'jgb10',label:'Japan 10Y',reason:'approved machine-readable source not connected'}]});
};
