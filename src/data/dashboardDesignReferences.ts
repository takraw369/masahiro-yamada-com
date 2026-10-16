import { type HomeDesignConfig } from './homeDesignCombinations';

// Original MASA arrangements inspired by public demos, not vendor code.
// Inspo MCP was unavailable during research; these came from public demos.
export const DASHBOARD_REFERENCE_STORAGE_KEY = 'masa.dashboard.design-references.v1';
export const dashboardDesignReferences = [
  { id:'shadcn', name:'Shadcn Admin', title:'整理された操作盤', tag:'おすすめ',
    url:'https://shadcn-admin.netlify.app/', summary:'指標・行動・詳細を、迷わず見渡す。',
    structure:'行動を主役に、補助情報を区画で整理。', spacing:'細い境界と24pxの余白。', navigation:'短いチップの導線。', mobile:'主要な一手を先に。詳細はその下へ。',
    config:{version:2,style:'orange',layout:'studio',buttons:'soft',cards:'soft',navigation:'chips',cta:'solid'} },
  { id:'catalyst', name:'Catalyst', title:'静かな集中', tag:'ミニマル',
    url:'https://catalyst-demo.tailwindui.com/', summary:'装飾を抑えて、今の行動に集中する。',
    structure:'一列の流れと控えめな操作。', spacing:'広めの余白でまとまりを作る。', navigation:'軽い横並びの導線。', mobile:'一列で読み進め、主要指標を優先。',
    config:{version:2,style:'orange',layout:'focus',buttons:'sharp',cards:'soft',navigation:'tabs',cta:'minimal'} },
  { id:'untitled', name:'Untitled UI', title:'流れから見渡す', tag:'全体像',
    url:'https://www.untitledui.com/react/iframe/dashboards-02/dashboard-01', summary:'活動の流れと、次の行動をつなぐ。',
    structure:'流れ・発信・行動の関係を広く見せる。', spacing:'大きな区画と小さな操作を分ける。', navigation:'ページ内の横並びタブ。', mobile:'複数列を一列に。長い説明は詳細へ。',
    config:{version:2,style:'orange',layout:'editorial',buttons:'soft',cards:'soft',navigation:'tabs',cta:'solid'} },
  { id:'tailadmin', name:'TailAdmin', title:'成果と一手', tag:'目標管理',
    url:'https://demo.tailadmin.com/', summary:'行動と成果を並べて、次を決める。',
    structure:'行動と収益を左右で比較する構成。', spacing:'角丸の面と控えめな奥行き。', navigation:'4つの導線を手元にまとめる。', mobile:'成果から行動へ。グラフは要点に絞る。',
    config:{version:2,style:'orange',layout:'split',buttons:'soft',cards:'float',navigation:'dock',cta:'solid'} },
  { id:'tabler', name:'Tabler', title:'届ける入口', tag:'運用',
    url:'https://preview.tabler.io/', summary:'小さな情報区画から、必要な操作へ。',
    structure:'発信の入口を先に、行動と成果を続ける。', spacing:'区画の境界を明確にして一覧性を保つ。', navigation:'短いチップで素早く移動。', mobile:'歓迎イラストより、操作の入口を優先。',
    config:{version:2,style:'orange',layout:'tiles',buttons:'sharp',cards:'outline',navigation:'chips',cta:'solid'} },
] as const satisfies ReadonlyArray<{
  id:string; name:string; title:string; tag:string; url:string; summary:string;
  structure:string; spacing:string; navigation:string; mobile:string; config:HomeDesignConfig;
}>;
export type DashboardReferenceId = (typeof dashboardDesignReferences)[number]['id'];
export type DashboardReferenceState = { version:1; previewId:DashboardReferenceId|null; favorites:DashboardReferenceId[]; notes:Partial<Record<DashboardReferenceId,string>> };
export const emptyDashboardReferenceState = ():DashboardReferenceState => ({version:1,previewId:null,favorites:[],notes:{}});
export const isDashboardReferenceId = (value:unknown):value is DashboardReferenceId =>
  typeof value === 'string' && dashboardDesignReferences.some(item=>item.id===value);

export function parseDashboardReferenceState(raw:string|null):DashboardReferenceState {
  const empty=emptyDashboardReferenceState();
  if (!raw || raw.length>20000) return empty;
  try {
    const value:unknown=JSON.parse(raw);
    if (!value || typeof value!=='object' || Array.isArray(value)) return empty;
    const item=value as Record<string,unknown>;
    if (item.version!==1) return empty;
    const notes:DashboardReferenceState['notes']={};
    if (item.notes && typeof item.notes==='object' && !Array.isArray(item.notes)) {
      for (const reference of dashboardDesignReferences) {
        const note=(item.notes as Record<string,unknown>)[reference.id];
        if (typeof note==='string') notes[reference.id]=note.slice(0,600);
      }
    }
    return {version:1,previewId:isDashboardReferenceId(item.previewId)?item.previewId:null,
      favorites:Array.isArray(item.favorites)?[...new Set(item.favorites.filter(isDashboardReferenceId))]:[],notes};
  } catch { return empty; }
}
export function writeDashboardReferenceState(storage:Pick<Storage,'setItem'>,state:DashboardReferenceState):void {
  storage.setItem(DASHBOARD_REFERENCE_STORAGE_KEY,JSON.stringify(parseDashboardReferenceState(JSON.stringify(state))));
}
