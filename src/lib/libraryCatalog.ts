export type LibraryItemStatus = 'preview' | 'live';
export type LibraryAccess = 'free' | 'one-time' | 'member' | 'pro';
export type LibraryCategory =
  | 'PERFORMANCE'
  | 'REVIEW'
  | 'BODY'
  | 'MIND'
  | 'CAREER'
  | 'OS'
  | 'AI'
  | 'EDUCATION';

export type LibraryMedia = {
  type: 'VIDEO' | 'AUDIO' | 'WORKSHEET' | 'QUEST';
  label: string;
  status: 'planned' | 'live';
  url?: string;
};

export type LibraryItem = {
  slug: string;
  title: string;
  subtitle: string;
  category: LibraryCategory;
  format: string;
  priceYen: number;
  status: LibraryItemStatus;
  access?: LibraryAccess;
  series?: string;
  releaseLabel: string;
  coverNo: string;
  description: string;
  takeaways: string[];
  bridge: string;
  lineKeyword: string;
  media?: LibraryMedia[];
  checkoutUrl?: string;
};

export const knowledgeShelfPlan = {
  name: 'Knowledge Shelf MEMBER',
  monthlyYen: 2980,
  status: 'preview' as const,
  description:
    '一度きりの情報販売ではなく、資料・テンプレ・動画・Questが育ち続ける会員棚。初期公開では価格と内容を市場反応で検証します。',
};

export const libraryItems: LibraryItem[] = [
  {
    slug: 'a3-decision-flow',
    title: 'A3 DECISION FLOW',
    subtitle: '散らかったメモを「一枚で決められる状態」へ変える',
    category: 'OS',
    format: 'A3 TEMPLATE / PROMPT',
    priceYen: 1980,
    status: 'preview',
    access: 'member',
    series: 'DECISION & FLOW',
    releaseLabel: '最優先で制作中',
    coverNo: '00',
    description:
      '稟議・報告・週次レビューのA3思考を、事業・AI・学習・プロジェクト判断へ拡張。雑な素材を8ブロックへ分け、抜けを見つけ、次の一手まで一枚に圧縮するMASA版の意思決定テンプレート。',
    takeaways: [
      '問題・現状・目標・要因を一枚でつかむ',
      '対策・実行・確認・標準化までつなぐ',
      '会話や調査を「流れる情報」から再利用できる資産へ変える',
    ],
    bridge:
      '完成後は実案件のA3、30秒解説、動画、実践Questへ段階的に増補し、同じ知識が育っていく設計にする。',
    lineKeyword: 'A3',
    media: [
      { type: 'WORKSHEET', label: 'A3横1枚テンプレート', status: 'planned' },
      { type: 'VIDEO', label: '10分解説｜一枚で意思決定する', status: 'planned' },
      { type: 'QUEST', label: '自分の案件をA3化する実践Quest', status: 'planned' },
    ],
  },
  {
    slug: '10sec-reset',
    title: '10秒RESET',
    subtitle: '本番で崩れた瞬間に、戻るための3ステップ',
    category: 'PERFORMANCE',
    format: 'MICRO GUIDE / PDF',
    priceYen: 980,
    status: 'preview',
    access: 'one-time',
    series: 'WIN PATH',
    releaseLabel: '先行案内受付中',
    coverNo: '01',
    description:
      '緊張、ミス、判定、相手の流れ。試合中に崩れたとき「考え直す」のではなく、身体から戻るための最小手順をまとめる実践ガイド。',
    takeaways: ['崩れの初期サインを見つける', '呼吸・視線・身体感覚から戻す', '次の1プレーへ注意を戻す'],
    bridge: 'RESETを使っても同じ崩れ方を繰り返すなら、個人固有のトリガーと勝ち筋を90分で実装する。',
    lineKeyword: 'RESET',
  },
  {
    slug: 'match-review',
    title: 'MATCH REVIEW',
    subtitle: '試合を「良かった・ダメだった」で終わらせない振り返り術',
    category: 'REVIEW',
    format: 'WORKBOOK / PDF',
    priceYen: 1480,
    status: 'preview',
    access: 'one-time',
    series: 'WIN PATH',
    releaseLabel: '先行案内受付中',
    coverNo: '02',
    description:
      '試合後の感情と事実を分け、次の練習で変える一点まで落とすレビュー型ワークブック。経験を再現可能な学習資産へ変える。',
    takeaways: ['事実・解釈・感情を分ける', '勝因と敗因を一つに絞る', '次の練習メニューへ変換する'],
    bridge: 'レビューしても何を変えるべきか決め切れない場合は、勝ち筋OSでMAP→SENSE→RESET→LEARNを本人仕様にする。',
    lineKeyword: 'REVIEW',
  },
  {
    slug: 'entry-toolkit',
    title: '勝ち筋 ENTRY TOOLKIT',
    subtitle: 'WIN PATH / RESET / MATCH REVIEW を自分で一度つくる',
    category: 'PERFORMANCE',
    format: 'TOOLKIT / PDF',
    priceYen: 3300,
    status: 'preview',
    access: 'member',
    series: 'WIN PATH',
    releaseLabel: '優先制作',
    coverNo: '03',
    description:
      '90分セッションの核を、自分で試せる入口に圧縮。勝つための道筋、崩れたときの戻し方、試合後の学習を一つの循環にする。',
    takeaways: ['WIN PATHを言語化する', 'RESET CARDを作る', 'MATCH REVIEWを次の一手へつなぐ'],
    bridge: '自分で書いてみたあと「これで合っているか」「自分の場合は？」が出たら、勝ち筋OS 90分へ進む。',
    lineKeyword: '勝ち筋',
  },
  {
    slug: 'read-the-stuck',
    title: '「詰まり」を読む',
    subtitle: '身体・感情・思考のズレから、動けない理由を見つける',
    category: 'BODY',
    format: 'SEMINAR NOTES',
    priceYen: 1480,
    status: 'preview',
    access: 'one-time',
    series: 'FLOW',
    releaseLabel: '企画公開',
    coverNo: '04',
    description:
      '動けないときに根性を足すのではなく、どこで流れが止まっているかを見る。身体知から「一つだけ直す場所」を探す観察ノート。',
    takeaways: ['身体・感情・思考を分けて観察する', '役割と配置のズレを見る', '一つの調整点に絞る'],
    bridge: 'セルフ観察では見えにくい詰まりは、対話と身体反応を使って外から読むと速い。',
    lineKeyword: 'FLOW',
  },
  {
    slug: 'anger-second-emotion',
    title: '怒りは第二感情',
    subtitle: '反応の奥にある「本当に守りたいもの」を読む',
    category: 'MIND',
    format: 'NOTEBOOK / PDF',
    priceYen: 980,
    status: 'preview',
    access: 'one-time',
    series: 'MIND',
    releaseLabel: '企画公開',
    coverNo: '05',
    description:
      '怒りを抑えることより、怒りの前にある期待・不安・悲しみ・境界線を読む。競技、人間関係、指導の現場で使える観察フォーマット。',
    takeaways: ['怒りの直前に起きたことを分解する', '守りたい価値・境界線を特定する', '次の行動を反応ではなく選択に変える'],
    bridge: '感情の理解だけで終わらず、役割・環境・行動設計まで変えるところが次の深さ。',
    lineKeyword: '怒り',
  },
  {
    slug: 'keep-evolving',
    title: '20年、日本代表で残ったもの',
    subtitle: '才能より先に見る「伸び続ける選手」の条件',
    category: 'CAREER',
    format: 'ESSAY / SEMINAR DECK',
    priceYen: 1980,
    status: 'preview',
    access: 'member',
    series: 'ATHLETE',
    releaseLabel: '企画公開',
    coverNo: '06',
    description:
      '長く競技を続け、環境・役割・身体の変化を越えていく中で残った判断軸を、若い選手・指導者・親に向けて体系化する。',
    takeaways: ['結果が出ない時期の見方', '役割が変わるときの適応', '身体知を経験で終わらせず学習に変える'],
    bridge: '知識として読むだけでなく、自分の競技人生の「今の勝ち筋」に落とすなら個別実装へ。',
    lineKeyword: '日本代表',
  },
];

export const libraryItemBySlug = (slug: string | undefined) =>
  libraryItems.find((item) => item.slug === slug);

export const accessLabel = (access: LibraryAccess | undefined) => {
  if (access === 'member') return 'MEMBER';
  if (access === 'pro') return 'PRO';
  if (access === 'free') return 'FREE';
  return 'ONE-TIME';
};

export const yen = (value: number) => `¥${value.toLocaleString('ja-JP')}`;
