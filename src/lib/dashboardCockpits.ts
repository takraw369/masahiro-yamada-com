export type DashboardCockpit = {
  see: string;
  decide: string;
  act: string;
};

const today: DashboardCockpit = {
  see: '今日の優先・詰まり・変化',
  decide: 'いま最も波及する一手',
  act: '1つ進めて証拠を残す',
};

const fallback: DashboardCockpit = {
  see: 'このページの現在地',
  decide: '次に変える一点',
  act: '1つ進めて記録する',
};

const routes: Array<{ route: string; cockpit: DashboardCockpit }> = [
  { route: '/mind', cockpit: { see: '素材・再会候補・つながり', decide: '残す・つなぐ・育てる', act: '次の資産へ送る' } },
  { route: '/dashboard/intelligence', cockpit: { see: '外部シグナルと変化', decide: '信頼・再利用する価値', act: 'EvidenceかOutputへ送る' } },
  { route: '/dashboard/evidence', cockpit: { see: '根拠・反証・確度', decide: '何を採用するか', act: '判断へ反映する' } },
  { route: '/dashboard/graph', cockpit: { see: 'つながり・孤立点・密度', decide: '育てる関係', act: '接続を1つ確定する' } },
  { route: '/dashboard/choice-lab', cockpit: { see: '選択肢・条件・代償', decide: '何を選ぶか', act: '判断と理由を残す' } },
  { route: '/dashboard/design-lab', cockpit: { see: '画面・導線・違和感', decide: '残す・変える一点', act: '試作を1つ進める' } },
  { route: '/dashboard/question-lab', cockpit: { see: '問い・前提・未確定', decide: '次に検証する問い', act: '調査か実験へ送る' } },
  { route: '/dashboard/knowledge', cockpit: { see: 'Inbox・Library・接続', decide: '残す・つなぐ・昇格する', act: '次の資産へ送る' } },
  { route: '/dashboard/line', cockpit: { see: '導線・滞留・反応', decide: 'どこを直すか', act: '1箇所更新して確認する' } },
  { route: '/dashboard/voice', cockpit: { see: '未処理の音声・意味', decide: '捨てる・残す・育てる', act: '資産へ振り分ける' } },
  { route: '/dashboard/schedule', cockpit: { see: '予定・制約・空白', decide: '時間をどこへ配るか', act: '次の予定を確定する' } },
  { route: '/dashboard/post', cockpit: { see: '素材・目的・CTA', decide: '今出す1本', act: '下書きからHuman Gateへ' } },
  { route: '/dashboard/visual-prompt', cockpit: { see: '用途・画・感情', decide: '伝える構図', act: '生成用Promptを確定する' } },
  { route: '/dashboard/funnel', cockpit: { see: '流入・CTA・反応', decide: '最大の漏れ', act: '1点修正して再計測する' } },
  { route: '/dashboard/distribution', cockpit: { see: 'Content Readyと配信状態', decide: 'どこで何を出すか', act: 'Human Gateへ送る' } },
  { route: '/dashboard/content-schedule', cockpit: { see: '配信予定・空き・制約', decide: '次にいつ何を出すか', act: '予定を1つ確定する' } },
  { route: '/dashboard/flow-09', cockpit: { see: '0→9の現在地', decide: '次に越えるフェーズ', act: '次の1アクションへ進む' } },
  { route: '/dashboard/quest', cockpit: { see: 'Quest進捗・証拠', decide: '次に進めるQuest', act: '行動して証拠を残す' } },
  { route: '/dashboard/lian', cockpit: { see: '関係・状態・次の接点', decide: '今つなぐべき相手と目的', act: '次の接点を1つ作る' } },
  { route: '/dashboard/treasury', cockpit: { see: '現金・入出金・期限', decide: '守る・回す・投じる', act: '次の資金行動を確定する' } },
  { route: '/dashboard/investment', cockpit: { see: '保有・仮説・変化', decide: '維持・検証・見直し', act: '判断記録を更新する' } },
  { route: '/dashboard/wishlist', cockpit: { see: 'Want・理由・期限', decide: '今育てるWant', act: 'ProjectかQuestへ変える' } },
  { route: '/dashboard/os', cockpit: { see: 'OS全体の詰まり・重複', decide: '最も波及する修正', act: '正本か仕組みを更新する' } },
];

export function getDashboardCockpit(pathname: string): DashboardCockpit {
  if (pathname === '/dashboard' || pathname === '/dashboard/') return today;

  const match = routes.find(({ route }) => pathname === route || pathname.startsWith(`${route}/`));
  return match?.cockpit ?? fallback;
}
