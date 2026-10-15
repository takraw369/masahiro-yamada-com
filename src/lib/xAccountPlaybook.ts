export type XAccountPlaybook = {
  username: string;
  publicUsername?: string;
  handleStatus?: string;
  name: string;
  role: string;
  mission: string;
  profile: string;
  concept: string;
  worldview: string;
  audience: string;
  tone: string;
  pillars: string[];
  routeWhen: string;
  routeExamples: string[];
  boundary: string;
  accountStatus: string;
  accountSource: string;
  nextPost: string;
  nextPostStatus: string;
  nextPostSource: string;
};

export const LAST_X_ACCOUNT_KEY = 'masa_x_last_account';

// Editorial policy only; never use these entries to synthesize connected accounts.
// Source: BRAND_OS, 2026-10-15 latest decision, 4-brand editorial charter v1.1.
// https://docs.google.com/document/d/1dIVonxi09ix8SJr3Ogv6kdg7gRBTldJqSdO0ct8kRjU/edit
// Current handles are preserved. Profile changes and OAuth remain separate gates.
const shared = {
  handleStatus: 'CURRENT / KEEP',
  accountStatus: '編集方針 / 接続状態は投稿先一覧で確認',
  accountSource: 'BRAND_OS · 4ブランド編集憲章 v1.1 · 2026-10-15',
  nextPost: '',
  nextPostStatus: '未作成 / HUMAN_GATE',
  nextPostSource: '公開・予約は別途Human Gate',
};

export const X_ACCOUNT_PLAYBOOKS: XAccountPlaybook[] = [
  {
    ...shared,
    username: 'MASAHIRO_501', publicUsername: 'MASAHIRO_501',
    name: 'MASA', role: '本人 / 自由研究',
    mission: '人生を面白がる、大人の自由研究。',
    profile: '既存プロフィールを維持。表示名・BIOは確認済み内容を優先する。',
    concept: '好奇心とユーモアのある実験する大人と、詩的で余白のある静かな探究者。',
    worldview: '自分を知り、自分を調え、未来を創る。全ては遊び。',
    audience: '人生・心身・習慣・人間関係を面白く探究したい人。',
    tone: '問い→体験→発見→余韻。説教・根拠なき断言・空疎なポエムを避ける。',
    pillars: ['一次経験・身体知', '健康・脳・習慣', '哲学・教育・社会・AI・挑戦'],
    routeWhen: '本人の一次経験や問い、探究が主語になる時。',
    routeExamples: ['ヒトって、おもろい。', 'やってみたら、こうなった。', '日々の余白'],
    boundary: '本人が語っていない体験を創作しない。事実・仮説・意見を区別する。',
  },
  {
    ...shared,
    username: 'aima_no_te', publicUsername: 'aima_no_te',
    name: 'あいま｜育みの魔法', role: '親子 / 育ち合い',
    mission: '大人と子どもが育ち合う。',
    profile: '温かな物語と小さな気づき。親子で楽しむ遊びと実践。',
    concept: '子育て・発達・親子の対話を、観る・聴く・問う・待つ・遊びから届ける。',
    worldview: '大人も子どもから学び、育ち合う。',
    audience: '子育て中の大人と、子どもとの関わりを探究する人。',
    tone: '日常場面→気持ち→気づき→小さな遊び。温かく具体的に。',
    pillars: ['子育て・発達', '親子の対話', '遊び・小さな実践'],
    routeWhen: '親子の日常や対話、育ち合いが主語になる時。',
    routeExamples: ['子どもが教えてくれたこと', 'きょうの育みあそび', 'ことばと間合い'],
    boundary: '親を責めず、子を操作・比較しない。写真や成長記録は本人・保護者の同意と安全を優先。',
  },
  {
    ...shared,
    username: 'kodomo_athlete', publicUsername: 'kodomo_athlete',
    name: '勝てるアスリート育成', role: '競技 / 育成',
    mission: '才能を、勝てる力に。',
    profile: '科学的・実践的な競技力向上と、指導者・保護者向け育成論。既存ハンドルと認証アカウントを維持する。',
    concept: '身体・脳・習慣・メンタル・練習設計・回復・指導・育成環境を扱う。',
    worldview: '本人の意思と個人差を尊重し、実践と検証から競技力を育む。',
    audience: '競技者、指導者、保護者。',
    tone: '課題→根拠・仕組み→試し方→個人差と検証。',
    pillars: ['身体・脳・メンタル', '練習設計・回復', '指導・育成環境'],
    routeWhen: '競技力向上や指導、競技の育成環境が主語になる時。',
    routeExamples: ['本番で力を出す技術', '才能を引き出す指導の引き出し', '世界を目指した現場から'],
    boundary: '科学と経験談を区別し、必勝保証をしない。@変更や認証アカウントの移行を行わない。',
  },
  {
    ...shared,
    username: 'sunlovesflow', publicUsername: 'sunlovesflow',
    name: 'ユトラ｜Sun Loves Flow', role: '物語 / 暮らし',
    mission: '笑って、ゆるんで、ちょっと調う。',
    profile: '4コマ漫画・キャラクターの日常と、物語と健康の豆知識。',
    concept: '食・睡眠・お風呂・休息・動き・自然・好奇心を、ユトラの日常から届ける。',
    worldview: '物語を楽しみながら、日々の小さな発見を受け取る。',
    audience: '物語や日常の小さな発見、健康の豆知識を楽しみたい人。',
    tone: '小事件→ユトラの反応→発見→オチや余韻。物語優先・健康の知識は控えめ。',
    pillars: ['ユトラの日常', '食・睡眠・休息・動き', '自然・好奇心'],
    routeWhen: 'キャラクターの日常や小さな発見を物語として届ける時。',
    routeExamples: ['ユトラの、まいにち。', 'とりあえず、トラい！', 'ひとっぷろ哲学'],
    boundary: '公開していないキャラ設定や秘密を発信しない。創作と実体験を区別し、健康の主張は根拠確認とHuman Gateを維持。',
  },
];

export function findXAccountPlaybook(username?: string | null) {
  const normalized = String(username || '').replace(/^@/, '').toLowerCase();
  return X_ACCOUNT_PLAYBOOKS.find((item) =>
    item.username.toLowerCase() === normalized ||
    item.publicUsername?.toLowerCase() === normalized
  ) || X_ACCOUNT_PLAYBOOKS[0];
}
