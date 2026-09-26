export type SourceKind = 'primary' | 'structured' | 'research' | 'context';
export type SourceRegion = 'jp' | 'us' | 'eu' | 'global';
export type SourceIntegration = 'adapter' | 'manual' | 'restricted';
export type SourcePriority = 'core' | 'support' | 'optional';

export type InvestmentResearchSource = {
  id: string;
  name: string;
  url: string;
  original50: boolean;
  kind: SourceKind;
  region: SourceRegion;
  purpose: string;
  uses: string[];
  integration: SourceIntegration;
  priority: SourcePriority;
};

export type InvestmentResearchPack = {
  id: string;
  label: string;
  description: string;
  objective: string;
  sourceIds: string[];
};

export const investmentResearchSources: InvestmentResearchSource[] = [
  { id:'dataroma', name:'Dataroma', url:'https://www.dataroma.com/m/home.php', original50:true, kind:'structured', region:'global', purpose:'Superinvestor portfolios', uses:['institutional','tenbagger'], integration:'manual', priority:'support' },
  { id:'whalewisdom', name:'WhaleWisdom', url:'https://whalewisdom.com/', original50:true, kind:'structured', region:'us', purpose:'13F holdings and fund changes', uses:['institutional','tenbagger'], integration:'manual', priority:'support' },
  { id:'capitol-trades', name:'Capitol Trades', url:'https://www.capitoltrades.com/', original50:true, kind:'structured', region:'us', purpose:'US congressional transaction disclosures', uses:['policy','sentiment'], integration:'manual', priority:'support' },
  { id:'openinsider', name:'OpenInsider', url:'https://openinsider.com/', original50:true, kind:'structured', region:'us', purpose:'Insider transaction screening', uses:['insider','tenbagger'], integration:'manual', priority:'core' },
  { id:'13f-info', name:'13F.info', url:'https://13f.info/', original50:true, kind:'structured', region:'us', purpose:'Readable 13F filings', uses:['institutional','tenbagger'], integration:'manual', priority:'support' },
  { id:'sec-edgar', name:'SEC EDGAR', url:'https://www.sec.gov/edgar/search/', original50:true, kind:'primary', region:'us', purpose:'Official company filings', uses:['fundamentals','tenbagger','institutional'], integration:'adapter', priority:'core' },
  { id:'berkshire-letters', name:'Berkshire Hathaway Letters', url:'https://www.berkshirehathaway.com/letters/letters.html', original50:true, kind:'research', region:'global', purpose:'Warren Buffett shareholder letters', uses:['mental-models','valuation'], integration:'manual', priority:'support' },
  { id:'buffett-cnbc', name:'Warren Buffett Archive', url:'https://buffett.cnbc.com/', original50:true, kind:'research', region:'global', purpose:'Berkshire meeting video archive', uses:['mental-models','valuation'], integration:'manual', priority:'optional' },
  { id:'oaktree', name:'Oaktree Insights', url:'https://www.oaktreecapital.com/insights', original50:true, kind:'research', region:'global', purpose:'Howard Marks memos and market-cycle notes', uses:['macro','risk','mental-models'], integration:'manual', priority:'support' },
  { id:'bridgewater', name:'Bridgewater Research', url:'https://www.bridgewater.com/research-and-insights', original50:true, kind:'research', region:'global', purpose:'Macro research and regime thinking', uses:['macro','risk'], integration:'manual', priority:'support' },
  { id:'principles', name:'Principles', url:'https://www.principles.com/', original50:true, kind:'context', region:'global', purpose:'Ray Dalio principles and decision frameworks', uses:['mental-models'], integration:'manual', priority:'optional' },
  { id:'gmo', name:'GMO Research', url:'https://www.gmo.com/americas/research-library/', original50:true, kind:'research', region:'global', purpose:'Jeremy Grantham and GMO market research', uses:['macro','valuation'], integration:'manual', priority:'support' },
  { id:'aqr', name:'AQR Research', url:'https://www.aqr.com/Insights/Research', original50:true, kind:'research', region:'global', purpose:'Quant and factor research', uses:['quant','risk'], integration:'manual', priority:'support' },
  { id:'damodaran-data', name:'Damodaran Online', url:'https://pages.stern.nyu.edu/~adamodar/', original50:true, kind:'research', region:'global', purpose:'Valuation datasets and teaching material', uses:['valuation','fundamentals'], integration:'manual', priority:'core' },
  { id:'damodaran-blog', name:'Musings on Markets', url:'https://aswathdamodaran.blogspot.com/', original50:true, kind:'research', region:'global', purpose:'Aswath Damodaran valuation commentary', uses:['valuation'], integration:'manual', priority:'support' },
  { id:'collab-fund', name:'Collaborative Fund Blog', url:'https://collabfund.com/blog/', original50:true, kind:'research', region:'global', purpose:'Morgan Housel essays on money and behavior', uses:['mental-models','sentiment'], integration:'manual', priority:'optional' },
  { id:'farnam-street', name:'Farnam Street', url:'https://fs.blog/', original50:true, kind:'context', region:'global', purpose:'Mental models and decision-making', uses:['mental-models'], integration:'manual', priority:'optional' },
  { id:'jpm-guide', name:'J.P. Morgan Guide to the Markets', url:'https://am.jpmorgan.com/us/en/asset-management/adv/insights/market-insights/guide-to-the-markets/', original50:true, kind:'research', region:'global', purpose:'Market charts and macro context', uses:['macro','asset-allocation'], integration:'manual', priority:'support' },
  { id:'ark-research', name:'ARK Research', url:'https://www.ark-invest.com/research', original50:true, kind:'research', region:'global', purpose:'Innovation and thematic research', uses:['innovation','tenbagger'], integration:'manual', priority:'support' },
  { id:'a16z', name:'a16z', url:'https://a16z.com/', original50:true, kind:'research', region:'global', purpose:'Venture and technology research', uses:['innovation','industry'], integration:'manual', priority:'support' },
  { id:'csinvesting', name:'CSInvesting', url:'https://csinvesting.org/', original50:true, kind:'context', region:'global', purpose:'Value-investing study materials', uses:['valuation','education'], integration:'manual', priority:'optional' },
  { id:'columbia-value', name:'Columbia Value Investing', url:'https://business.columbia.edu/heilbrunn', original50:true, kind:'context', region:'global', purpose:'Value-investing archive and education', uses:['valuation','education'], integration:'manual', priority:'optional' },
  { id:'fred', name:'FRED', url:'https://fred.stlouisfed.org/', original50:true, kind:'primary', region:'us', purpose:'Federal Reserve economic time series', uses:['macro','rates','liquidity'], integration:'adapter', priority:'core' },
  { id:'federal-reserve', name:'Federal Reserve', url:'https://www.federalreserve.gov/', original50:true, kind:'primary', region:'us', purpose:'Policy decisions, releases and data', uses:['macro','rates','liquidity'], integration:'adapter', priority:'core' },
  { id:'ecb', name:'European Central Bank', url:'https://www.ecb.europa.eu/', original50:true, kind:'primary', region:'eu', purpose:'ECB policy and statistics', uses:['macro','rates'], integration:'adapter', priority:'support' },
  { id:'bis', name:'Bank for International Settlements', url:'https://www.bis.org/', original50:true, kind:'primary', region:'global', purpose:'Cross-border banking and central-bank research', uses:['macro','liquidity','risk'], integration:'adapter', priority:'support' },
  { id:'tradingeconomics', name:'Trading Economics', url:'https://tradingeconomics.com/', original50:true, kind:'structured', region:'global', purpose:'Country economic indicators', uses:['macro'], integration:'manual', priority:'support' },
  { id:'macrotrends', name:'Macrotrends', url:'https://www.macrotrends.net/', original50:true, kind:'structured', region:'global', purpose:'Long-run company and macro charts', uses:['fundamentals','macro'], integration:'manual', priority:'support' },
  { id:'stockanalysis', name:'StockAnalysis', url:'https://stockanalysis.com/', original50:true, kind:'structured', region:'us', purpose:'Company financials and ratios', uses:['fundamentals','tenbagger'], integration:'manual', priority:'core' },
  { id:'companiesmarketcap', name:'CompaniesMarketCap', url:'https://companiesmarketcap.com/', original50:true, kind:'structured', region:'global', purpose:'Market-cap rankings', uses:['screening','tenbagger'], integration:'manual', priority:'support' },
  { id:'finviz', name:'Finviz', url:'https://finviz.com/', original50:true, kind:'structured', region:'us', purpose:'Stock screener and heatmaps', uses:['screening','sentiment','tenbagger'], integration:'manual', priority:'core' },
  { id:'portfolio-visualizer', name:'Portfolio Visualizer', url:'https://www.portfoliovisualizer.com/', original50:true, kind:'structured', region:'global', purpose:'Portfolio backtesting and factor analysis', uses:['backtest','risk'], integration:'manual', priority:'support' },
  { id:'tradingview', name:'TradingView', url:'https://www.tradingview.com/', original50:true, kind:'structured', region:'global', purpose:'Charts and market analysis', uses:['price','technical'], integration:'manual', priority:'support' },
  { id:'koyfin', name:'Koyfin', url:'https://www.koyfin.com/', original50:true, kind:'structured', region:'global', purpose:'Professional market dashboard', uses:['macro','fundamentals','price'], integration:'restricted', priority:'support' },
  { id:'annualreports', name:'AnnualReports', url:'https://www.annualreports.com/', original50:true, kind:'structured', region:'global', purpose:'Annual report archive', uses:['fundamentals'], integration:'manual', priority:'support' },
  { id:'investor-gov', name:'Investor.gov', url:'https://www.investor.gov/', original50:true, kind:'primary', region:'us', purpose:'SEC investor education', uses:['education','risk'], integration:'manual', priority:'optional' },
  { id:'bogleheads', name:'Bogleheads Wiki', url:'https://www.bogleheads.org/wiki/Main_Page', original50:true, kind:'context', region:'global', purpose:'Passive-investing reference', uses:['education','asset-allocation'], integration:'manual', priority:'optional' },
  { id:'investopedia', name:'Investopedia', url:'https://www.investopedia.com/', original50:true, kind:'context', region:'global', purpose:'Finance terminology and explainers', uses:['education'], integration:'manual', priority:'optional' },
  { id:'cfi', name:'Corporate Finance Institute', url:'https://corporatefinanceinstitute.com/', original50:true, kind:'context', region:'global', purpose:'Corporate-finance guides', uses:['education','valuation'], integration:'manual', priority:'optional' },
  { id:'cfa', name:'CFA Institute Research', url:'https://rpc.cfainstitute.org/', original50:true, kind:'research', region:'global', purpose:'Professional investment research', uses:['research','risk'], integration:'manual', priority:'support' },
  { id:'morningstar', name:'Morningstar', url:'https://www.morningstar.com/', original50:true, kind:'structured', region:'global', purpose:'Fund and equity research', uses:['funds','valuation'], integration:'restricted', priority:'support' },
  { id:'simplywallst', name:'Simply Wall St', url:'https://simplywall.st/', original50:true, kind:'structured', region:'global', purpose:'Visual company analysis', uses:['fundamentals','screening'], integration:'restricted', priority:'support' },
  { id:'value-investors-club', name:'Value Investors Club', url:'https://www.valueinvestorsclub.com/', original50:true, kind:'research', region:'global', purpose:'Curated investment theses', uses:['thesis','counterevidence'], integration:'manual', priority:'support' },
  { id:'etfdb', name:'ETF Database', url:'https://etfdb.com/', original50:true, kind:'structured', region:'us', purpose:'ETF holdings and composition', uses:['funds','flow'], integration:'manual', priority:'support' },
  { id:'curvo', name:'Curvo Backtest', url:'https://curvo.eu/backtest/en', original50:true, kind:'structured', region:'eu', purpose:'European fund backtests', uses:['backtest','funds'], integration:'manual', priority:'optional' },
  { id:'ofdollarsanddata', name:'Of Dollars And Data', url:'https://ofdollarsanddata.com/', original50:true, kind:'research', region:'global', purpose:'Data-driven investing essays', uses:['research','mental-models'], integration:'manual', priority:'optional' },
  { id:'wealth-common-sense', name:'A Wealth of Common Sense', url:'https://awealthofcommonsense.com/', original50:true, kind:'research', region:'global', purpose:'Market-history and behavior notes', uses:['market-history','sentiment'], integration:'manual', priority:'optional' },
  { id:'irrelevant-investor', name:'The Irrelevant Investor', url:'https://theirrelevantinvestor.com/', original50:true, kind:'research', region:'global', purpose:'Investor psychology and market commentary', uses:['sentiment','mental-models'], integration:'manual', priority:'optional' },
  { id:'visual-capitalist', name:'Visual Capitalist', url:'https://www.visualcapitalist.com/', original50:true, kind:'context', region:'global', purpose:'Visual macro and industry context', uses:['macro','industry'], integration:'manual', priority:'optional' },
  { id:'our-finite-world', name:'Our Finite World', url:'https://ourfiniteworld.com/', original50:true, kind:'research', region:'global', purpose:'Energy-economy systems commentary', uses:['energy','macro','counterevidence'], integration:'manual', priority:'optional' },

  { id:'edinet', name:'EDINET', url:'https://disclosure2.edinet-fsa.go.jp/', original50:false, kind:'primary', region:'jp', purpose:'Official Japanese statutory filings', uses:['fundamentals','japan-flow','tenbagger'], integration:'adapter', priority:'core' },
  { id:'tdnet', name:'TDnet', url:'https://www.release.tdnet.info/inbs/I_main_00.html', original50:false, kind:'primary', region:'jp', purpose:'Timely disclosures by listed Japanese companies', uses:['fundamentals','events','tenbagger'], integration:'adapter', priority:'core' },
  { id:'jpx', name:'Japan Exchange Group', url:'https://www.jpx.co.jp/english/', original50:false, kind:'primary', region:'jp', purpose:'Listings, market structure and exchange statistics', uses:['japan-flow','market-structure','fundamentals'], integration:'adapter', priority:'core' },
  { id:'boj', name:'Bank of Japan', url:'https://www.boj.or.jp/en/statistics/', original50:false, kind:'primary', region:'jp', purpose:'BOJ policy and monetary/flow statistics', uses:['japan-flow','macro','rates','liquidity'], integration:'adapter', priority:'core' },
  { id:'mof-securities', name:'Japan MOF Securities Flows', url:'https://www.mof.go.jp/english/policy/international_policy/reference/itn_transactions_in_securities/', original50:false, kind:'primary', region:'jp', purpose:'Weekly/monthly cross-border securities transactions', uses:['japan-flow','flow','macro'], integration:'adapter', priority:'core' },
  { id:'mof-jgb', name:'Japan MOF JGB / Rates', url:'https://www.mof.go.jp/english/policy/jgbs/', original50:false, kind:'primary', region:'jp', purpose:'JGB issuance, auctions and rate data', uses:['japan-flow','rates','liquidity'], integration:'adapter', priority:'core' },
  { id:'estat', name:'e-Stat', url:'https://www.e-stat.go.jp/en', original50:false, kind:'primary', region:'jp', purpose:'Official Japanese government statistics', uses:['macro','demographics','industry'], integration:'adapter', priority:'support' },
  { id:'esri', name:'Cabinet Office ESRI', url:'https://www.esri.cao.go.jp/en/stat/', original50:false, kind:'primary', region:'jp', purpose:'GDP, business cycles and national accounts', uses:['macro','japan-flow'], integration:'adapter', priority:'support' },
  { id:'meti', name:'METI Statistics', url:'https://www.meti.go.jp/english/statistics/', original50:false, kind:'primary', region:'jp', purpose:'Industrial production, trade and sector statistics', uses:['industry','macro','demand'], integration:'adapter', priority:'support' },
  { id:'sec-data', name:'SEC Data APIs', url:'https://data.sec.gov/', original50:false, kind:'primary', region:'us', purpose:'Company submissions and XBRL CompanyFacts APIs', uses:['fundamentals','tenbagger'], integration:'adapter', priority:'core' },
  { id:'treasury-fiscaldata', name:'U.S. Treasury FiscalData', url:'https://fiscaldata.treasury.gov/', original50:false, kind:'primary', region:'us', purpose:'Debt, cash balance and fiscal data', uses:['macro','liquidity','rates'], integration:'adapter', priority:'core' },
  { id:'bls', name:'U.S. Bureau of Labor Statistics', url:'https://www.bls.gov/', original50:false, kind:'primary', region:'us', purpose:'Employment, CPI, PPI and productivity', uses:['macro','labor','inflation'], integration:'adapter', priority:'support' },
  { id:'bea', name:'U.S. Bureau of Economic Analysis', url:'https://www.bea.gov/', original50:false, kind:'primary', region:'us', purpose:'GDP, income and national accounts', uses:['macro','demand'], integration:'adapter', priority:'support' },
  { id:'cftc-cot', name:'CFTC Commitments of Traders', url:'https://www.cftc.gov/MarketReports/CommitmentsofTraders/index.htm', original50:false, kind:'primary', region:'us', purpose:'Futures positioning by trader class', uses:['positioning','macro','commodities'], integration:'adapter', priority:'core' },
  { id:'cboe', name:'Cboe Market Statistics', url:'https://www.cboe.com/us/options/market_statistics/', original50:false, kind:'primary', region:'us', purpose:'Options, VIX and market statistics', uses:['volatility','options','sentiment'], integration:'adapter', priority:'support' },
  { id:'eia', name:'U.S. EIA', url:'https://www.eia.gov/', original50:false, kind:'primary', region:'us', purpose:'Official energy supply/demand data', uses:['energy','commodities','macro'], integration:'adapter', priority:'support' },
  { id:'imf-data', name:'IMF Data', url:'https://www.imf.org/en/Data', original50:false, kind:'primary', region:'global', purpose:'Cross-country macro, balance-of-payments and financial data', uses:['macro','fx','risk'], integration:'adapter', priority:'support' },
  { id:'worldbank-data', name:'World Bank Data', url:'https://data.worldbank.org/', original50:false, kind:'primary', region:'global', purpose:'Development and long-run economic indicators', uses:['macro','demographics'], integration:'adapter', priority:'support' },
  { id:'oecd-data', name:'OECD Data Explorer', url:'https://data-explorer.oecd.org/', original50:false, kind:'primary', region:'global', purpose:'Comparable economic and policy indicators', uses:['macro','policy'], integration:'adapter', priority:'support' },
  { id:'google-trends', name:'Google Trends', url:'https://trends.google.com/trends/', original50:false, kind:'structured', region:'global', purpose:'Search-interest proxy for demand and attention', uses:['demand','sentiment','tenbagger'], integration:'manual', priority:'support' },
  { id:'google-patents', name:'Google Patents', url:'https://patents.google.com/', original50:false, kind:'structured', region:'global', purpose:'Patent search and citation context', uses:['innovation','tenbagger'], integration:'manual', priority:'support' },
  { id:'jplatpat', name:'J-PlatPat', url:'https://www.j-platpat.inpit.go.jp/', original50:false, kind:'primary', region:'jp', purpose:'Official Japanese patent/trademark search', uses:['innovation','tenbagger'], integration:'manual', priority:'support' },
  { id:'fintel', name:'Fintel', url:'https://fintel.io/', original50:false, kind:'structured', region:'us', purpose:'Ownership, short interest and institutional data', uses:['institutional','short-interest','tenbagger'], integration:'restricted', priority:'support' },
  { id:'tikr', name:'TIKR', url:'https://www.tikr.com/', original50:false, kind:'structured', region:'global', purpose:'Financials, estimates and transcripts', uses:['fundamentals','transcripts','tenbagger'], integration:'restricted', priority:'support' },
  { id:'quartr', name:'Quartr', url:'https://quartr.com/', original50:false, kind:'structured', region:'global', purpose:'Earnings calls, presentations and reports', uses:['transcripts','management-tone','tenbagger'], integration:'restricted', priority:'support' },
  { id:'prtimes', name:'PR TIMES', url:'https://prtimes.jp/', original50:false, kind:'structured', region:'jp', purpose:'Japanese company press releases', uses:['events','demand','tenbagger'], integration:'manual', priority:'support' },
  { id:'businesswire', name:'Business Wire', url:'https://www.businesswire.com/', original50:false, kind:'structured', region:'global', purpose:'Company press releases and announcements', uses:['events','fundamentals'], integration:'manual', priority:'support' },
  { id:'prnewswire', name:'PR Newswire', url:'https://www.prnewswire.com/', original50:false, kind:'structured', region:'global', purpose:'Company press releases and announcements', uses:['events','fundamentals'], integration:'manual', priority:'support' },
  { id:'usaspending', name:'USAspending.gov', url:'https://www.usaspending.gov/', original50:false, kind:'primary', region:'us', purpose:'Federal contracts and grants', uses:['government-demand','tenbagger','industry'], integration:'adapter', priority:'support' },
  { id:'opensecrets', name:'OpenSecrets', url:'https://www.opensecrets.org/', original50:false, kind:'structured', region:'us', purpose:'Lobbying and campaign-finance context', uses:['policy','industry'], integration:'manual', priority:'optional' },
  { id:'finra-short', name:'FINRA Short Interest', url:'https://www.finra.org/finra-data/browse-catalog/equity-short-interest/data', original50:false, kind:'primary', region:'us', purpose:'Official equity short-interest dataset', uses:['short-interest','risk','tenbagger'], integration:'adapter', priority:'support' },
];

export const investmentResearchPacks: InvestmentResearchPack[] = [
  { id:'tenbagger-us', label:'Tenbagger US', description:'米国小型〜中型株の静かな構造変化を、一次情報から先に検証する。', objective:'米国株のテンバガー候補を予兆ベースで探索し、反証可能な監視候補に絞る。', sourceIds:['sec-edgar','sec-data','stockanalysis','finviz','openinsider','13f-info','whalewisdom','quartr','google-trends','google-patents','finra-short','value-investors-club','ark-research','a16z'] },
  { id:'tenbagger-jp', label:'Tenbagger JP', description:'日本株の適時開示・法定開示・需要・知財をつないで初期シグナルを拾う。', objective:'日本株のテンバガー候補を予兆ベースで探索し、EDINET/TDnetを起点に検証する。', sourceIds:['edinet','tdnet','jpx','prtimes','google-trends','jplatpat','boj','mof-securities'] },
  { id:'japan-flow', label:'Japan Capital Flow', description:'日銀・財務省・金利・海外フローをつないで日本への資金還流を監視する。', objective:'日本への資金還流・円・金利・海外証券売買の構造変化を検証する。', sourceIds:['boj','mof-securities','mof-jgb','jpx','fred','federal-reserve','treasury-fiscaldata','bis','imf-data','tradingeconomics'] },
  { id:'smart-money', label:'Smart Money', description:'13F、インサイダー、議員、先物、ETFなど大口ポジショニングを横断する。', objective:'大口投資家・インサイダー・先物ポジショニングの変化を時差込みで比較する。', sourceIds:['sec-edgar','whalewisdom','dataroma','13f-info','openinsider','capitol-trades','cftc-cot','etfdb','fintel'] },
  { id:'macro-regime', label:'Macro Regime', description:'主要中銀、財政、雇用、インフレ、エネルギーを束ねてレジームを判定する。', objective:'金利・流動性・景気・インフレ・エネルギーから現在のマクロレジームを整理する。', sourceIds:['fred','federal-reserve','boj','ecb','bis','treasury-fiscaldata','bls','bea','eia','imf-data','oecd-data','jpm-guide','bridgewater','oaktree'] },
  { id:'valuation', label:'Valuation', description:'企業開示とDamodaran等を組み合わせ、前提と逆算値を分離して評価する。', objective:'企業価値評価を一次情報と明示的な前提に分け、弱点と感応度を示す。', sourceIds:['sec-edgar','edinet','damodaran-data','damodaran-blog','stockanalysis','annualreports','macrotrends','morningstar','cfa','gmo'] },
];

const sourceById = new Map(investmentResearchSources.map(source => [source.id, source]));

export function getInvestmentResearchPack(packId: string) {
  const pack = investmentResearchPacks.find(item => item.id === packId) ?? investmentResearchPacks[0];
  return { ...pack, sources: pack.sourceIds.map(id => sourceById.get(id)).filter(Boolean) as InvestmentResearchSource[] };
}

export function createInvestmentResearchBrief(packId: string, objective?: string) {
  const pack = getInvestmentResearchPack(packId);
  const sourceLines = pack.sources.map((source, index) => `${index + 1}. ${source.name} — ${source.purpose} — ${source.url}`);
  return [
    `【Research Pack】${pack.label}`,
    objective?.trim() || pack.objective,
    '',
    '【調査ルール】',
    '1. Primary（公式一次情報）を最優先し、集約サイトは発見・照合に使う。',
    '2. 数値には対象期間・更新日・出所を付ける。確認できないものは Unknown とする。',
    '3. 13F・議員取引・一部保有データには開示遅延があるため、リアルタイム売買シグナルとして扱わない。',
    '4. 強気材料だけでなく、反証・一過性要因・会計差・流動性・規制リスクを先に確認する。',
    '5. ログイン・有料・利用規約制限のあるソースは無理に自動取得せず、利用可能な範囲で参照する。',
    '6. 最終出力は Fact / Interpretation / Unknown / Next evidence に分ける。',
    '',
    '【優先ソース】',
    ...sourceLines,
  ].join('\n');
}
