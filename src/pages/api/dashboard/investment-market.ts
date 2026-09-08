import type { APIContext } from 'astro';

type MarketConfig = { key: string; label: string; symbol: string; decimals: number; suffix?: string };
const MARKET: MarketConfig[] = [
  { key: 'usdjpy', label: 'USD / JPY', symbol: 'JPY=X', decimals: 2 },
  { key: 'topix', label: 'TOPIX', symbol: '^TOPX', decimals: 2 },
  { key: 'banks', label: 'Banks ETF 1615', symbol: '1615.T', decimals: 1, suffix: '円' },
  { key: 'topixetf', label: 'TOPIX ETF 1475', symbol: '1475.T', decimals: 1, suffix: '円' },
  { key: 'ust10', label: 'US 10Y', symbol: '^TNX', decimals: 3, suffix: '%' },
  { key: 'nasdaq', label: 'NASDAQ', symbol: '^IXIC', decimals: 2 },
  { key: 'btc', label: 'BTC / USD', symbol: 'BTC-USD', decimals: 0, suffix: '$' },
];

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: { 'Content-Type': 'application/json', 'Cache-Control': 'private, max-age=60' },
});
const finite = (v: unknown): number | null => typeof v === 'number' && Number.isFinite(v) ? v : null;

async function fetchChart(config: MarketConfig) {
  try {
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(config.symbol)}?interval=1d&range=5d`;
    const response = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0 MASA-OS-InvestmentDashboard/1.0', Accept: 'application/json' } });
    if (!response.ok) throw new Error(`http_${response.status}`);
    const data: any = await response.json();
    const meta = data?.chart?.result?.[0]?.meta || {};
    const price = finite(meta.regularMarketPrice);
    const previousClose = finite(meta.chartPreviousClose) ?? finite(meta.previousClose);
    const changePct = price != null && previousClose ? ((price - previousClose) / previousClose) * 100 : null;
    const marketTime = finite(meta.regularMarketTime);
    const formatted = price == null ? '取得失敗' : `${config.suffix === '$' ? '$' : ''}${price.toLocaleString('ja-JP', { minimumFractionDigits: config.decimals, maximumFractionDigits: config.decimals })}${config.suffix && config.suffix !== '$' ? config.suffix : ''}`;
    return { key: config.key, label: config.label, symbol: config.symbol, ok: price != null, price, previousClose, changePct, formatted, observedAt: marketTime ? new Date(marketTime * 1000).toISOString() : null, source: 'Yahoo Finance chart API' };
  } catch (error) {
    return { key: config.key, label: config.label, symbol: config.symbol, ok: false, price: null, previousClose: null, changePct: null, formatted: '取得失敗', observedAt: null, source: 'Yahoo Finance chart API', error: String(error) };
  }
}

export const GET = async (_context: APIContext) => {
  const signals = await Promise.all(MARKET.map(fetchChart));
  return json({ ok: signals.some(s => s.ok), asOf: new Date().toISOString(), signals });
};
