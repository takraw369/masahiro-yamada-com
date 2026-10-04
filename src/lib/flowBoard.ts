// Shared initial canvas; product canonical content remains in Drive / MASA_OS.
export type BoardNode = {
  [key: string]: unknown;
  id: string;
  label: string;
  note?: string;
  kind?: string;
  x: number;
  y: number;
  w?: number;
  h?: number;
  knowledgeId?: string | null;
  provenance?: string;
};
export type BoardEdge = { [key: string]: unknown; id: string; source: string; target: string; relation: string; state?: string };
export type BoardSnapshot = { [key: string]: unknown; nodes: BoardNode[]; edges: BoardEdge[]; viewport: { x: number; y: number; zoom: number } };

const seed: BoardSnapshot = {
  viewport: { x: 80, y: 60, zoom: .78 },
  nodes: [
    { id:'N025', label:'MASTER DASHBOARD', kind:'CONTROL', note:'MASA OS全体の現在地・優先順位・次Actionを俯瞰する操作面。', x:1450, y:150 },
    { id:'N026', label:'DRIVE INDEX', kind:'CONTROL', note:'Drive全体を発見・分類し、正本と処理対象を見つける索引。', x:880, y:120 },
    { id:'N017', label:'KNOWLEDGE FACTORY', kind:'KNOWLEDGE', note:'SourceをNodeへ分解し、既存Canonと接続して再利用可能な知識へ変換する。', x:1180, y:400 },
    { id:'N018', label:'HUMAN FLOW GRAPH', kind:'HUMAN', note:'人・状態・学び・縁・行動を意味付きEdgeで接続するHuman OS。', x:1650, y:470 },
    { id:'N019', label:'ACE BRAIN', kind:'HUMAN', note:'過去の知識・状態・関係から、今の次の良い経験へ進める認知OS。', x:1900, y:720 },
    { id:'N020', label:'CONTENT OS', kind:'OUTPUT', note:'KnowledgeをSNS・note・Quest・Productへ届く表現へ変換する。', x:980, y:760 },
    { id:'N021', label:'PRODUCT OS', kind:'BUSINESS', note:'Sellable資産をOffer・Naming・Priceへ変換する。', x:1140, y:1030 },
    { id:'N022', label:'QUEST MASTER', kind:'ACTION', note:'Knowledgeを問い・実践へ変換し、Evidenceを残す。', x:1700, y:1030 },
    { id:'N023', label:'DISTRIBUTION OS', kind:'OUTPUT', note:'Contentを市場へ出し、反応をEvidenceとして戻す。', x:700, y:1030 },
    { id:'N024', label:'CRM OS', kind:'BUSINESS', note:'顧客・見込み客との接点、反応、CaseをKnowledgeとProductへ戻す。', x:700, y:1370 },
    { id:'N027', label:'ASSET FLOW', kind:'OUTPUT', note:'RAW→SIGNAL→IP→CONTENT→OFFER→REVENUEへ価値変換する流れ。', x:420, y:650 },
    { id:'N028', label:'WANT TO', kind:'LIFE', note:'Want toとPurposeをProject・Taskへ接続し、実践Evidenceで更新する。', x:2100, y:320 },
    { id:'N029', label:'CAPITAL OS', kind:'BUSINESS', note:'RevenueをRunway・自由・資本形成へ接続する。', x:1250, y:1380 },
    { id:'N030', label:'REVENUE IDEAS', kind:'BUSINESS', note:'収益候補を資産性・反復性・波及で比較する。', x:1600, y:1380 },
  ],
  edges: [
    { id:'E1', source:'N026', target:'N017', relation:'feeds', state:'CONFIRMED' },
    { id:'E2', source:'N017', target:'N020', relation:'produces', state:'CONFIRMED' },
    { id:'E3', source:'N017', target:'N018', relation:'feeds', state:'CONFIRMED' },
    { id:'E4', source:'N018', target:'N022', relation:'routes_to', state:'CONFIRMED' },
    { id:'E5', source:'N020', target:'N021', relation:'feeds', state:'CONFIRMED' },
    { id:'E6', source:'N020', target:'N023', relation:'distributed_by', state:'CONFIRMED' },
    { id:'E7', source:'N024', target:'N021', relation:'informs', state:'CONFIRMED' },
    { id:'E8', source:'N021', target:'N029', relation:'feeds', state:'CONFIRMED' },
    { id:'E9', source:'N030', target:'N021', relation:'informs', state:'CONFIRMED' },
    { id:'E10', source:'N028', target:'N018', relation:'informs', state:'CONFIRMED' },
  ],
};


export function createFlowBoardSnapshot(): BoardSnapshot {
  return structuredClone(seed);
}
