export type XAccountPlaybook = {
  username: string;
  name: string;
  role: string;
  profile: string;
  concept: string;
  worldview: string;
  audience: string;
  tone: string;
  pillars: string[];
  boundary: string;
  accountStatus: string;
  accountSource: string;
  nextPost: string;
  nextPostStatus: string;
  nextPostSource: string;
};

export const LAST_X_ACCOUNT_KEY = 'masa_x_last_account';

// Derived UI snapshot only.
// Canonical account state: Drive SNS_ACCOUNT_REGISTRY.
// Canonical publish queue/state: Drive DISTRIBUTION_OS.
// Keep this list limited to owner-verified / registered X accounts.
export const X_ACCOUNT_PLAYBOOKS: XAccountPlaybook[] = [
  {
    username: 'MASAHIRO_501',
    name: '山田昌寛｜Flowをつくる元日本代表',
    role: 'Main / Personal',
    profile: '元セパタクロー日本代表🇯🇵｜全日本6連覇・アジア大会🥉\n20年以上の競技経験から「練習でできるを、本番で出す条件」を探究。\n才能を潰さないアスリート脳と心身の整え方。\n↓ 必要な人はLINE「勝ち筋」へ',
    concept: 'MASA本人の一次体験を起点に、競技・身体・Flow・脳科学・哲学を「問い→実践→検証」に変える本丸。',
    worldview: '完成された先生として語るより、20年以上の競技経験と今の実践をつなぎ、身体で確かめながら流れを見る。',
    audience: '自己成長・健康・教育・アスリートに関心がある人。特に「練習ではできるのに本番で出せない」競技者。',
    tone: '速い・生っぽい・考えている途中も出す。体験が先、理論は後。断定しすぎず、最後に問いを残す。',
    pillars: ['競技20年の再解釈', '本番再現性 / FLOW', '身体・脳・教育'],
    boundary: '情報まとめ専用・ブランド告知専用にはしない。MASA自身が何を見たか、どう試したかを必ず入れる。',
    accountStatus: 'ACTIVE / profile rebuild',
    accountSource: 'SNS_ACCOUNT_REGISTRY / Profiles',
    nextPost: '技術があるのに、本番で出せない。\n全部「メンタルが弱い」で終わらせない。\n\n崩れる時、先に変わっているものがある。\n呼吸、視線、身体、思考、声。\n\nまず最初の変化を観る。そこから次の1プレーに戻る。\n\nあなたは崩れる時、最初に何が変わりますか？',
    nextPostStatus: 'READY / HUMAN_GATE',
    nextPostSource: 'DISTRIBUTION_OS · C034',
  },
  {
    username: 'spirit_exp',
    name: 'AROUND/40 Exp.',
    role: 'Adult / Spirit & Body / Experience',
    profile: '極上な人生を選択するための経験値を上げろ / Spirit & Body .Exp / ココロとカラダの本質を体感し生き様を魅せつけろ',
    concept: '40代から人生の経験値を上げる。身体・仕事・家族・学び・挑戦を、自分を使ったExperience Logとして残す。',
    worldview: '年齢＝衰えだけではない。身体・経験・人脈・失敗を統合し、人生資本として使い直せる時期として40代を捉える。',
    audience: '35〜49歳前後／心身・生き方・再挑戦に関心がある人。ここは初期仮説として反応データで更新する。',
    tone: '軽い、率直、実験的。途中経過OK。失敗も出す。先生になるより「やってみた→どうだった→次どうする」。',
    pillars: ['Spirit & Body', '40代の人生資本', '挑戦 / 学び / Experience'],
    boundary: '完成形を教える垢にしない。研究資料だけでも終わらせない。必ず実体験・身体感覚・次の実験へ戻す。',
    accountStatus: 'ACTIVE / OWNER VERIFIED / POSITIONING TEST',
    accountSource: 'SNS_ACCOUNT_REGISTRY · owner screenshot 2026-09-17',
    nextPost: '40代って、衰える時期じゃなくて「経験が複利化し始める時期」なんじゃないか。\n\n身体。経験。人脈。失敗。\n若い頃はバラバラだったものが、あとから繋がって武器になる。\n\nだから今は、若さを取り戻すより、持ってる経験をどう使うか。\n\n40代になって、むしろ強くなったものって何？',
    nextPostStatus: 'DRAFT / HUMAN_GATE',
    nextPostSource: 'DISTRIBUTION_OS · C044',
  },
  {
    username: 'kodomo_athlete',
    name: '元日本代表｜子どもの才能を惹き出す脳科学',
    role: 'Athlete Education / Kids',
    profile: '元日本代表🇯🇵日本一30回超のアスリートが、脳科学で子どもの隠れた才能を惹き出す方法を発信｜教育の本質は「教える」じゃなく「惹き出す」｜体験セッション受付中→DMまたは下記リンクから',
    concept: '子どもの可能性を潰さず「惹き出す」。運動・身体感覚・脳・声かけを、親と指導者が使える形へ変える。',
    worldview: '完成させるより発現させる。評価・比較を先に置かず、その子を観察して、動き出せる環境と次の一歩をつくる。',
    audience: '保護者・ジュニアアスリート・指導者。子どもの才能や競技成長に関わる人。',
    tone: 'やさしい、具体的、短く実践的。専門語は噛み砕く。不安を煽らず、親・指導者が今日使える問いへ落とす。',
    pillars: ['子ども×アスリート', '脳科学 / 身体感覚', '親・指導者の関わり方'],
    boundary: '子どもを比較・選別する言葉で煽らない。大人向け自己啓発へ寄せすぎず、観察と具体的な関わり方へ戻す。',
    accountStatus: 'ACTIVE',
    accountSource: 'SNS_ACCOUNT_REGISTRY / Profiles',
    nextPost: '子どもへの「期待」は、応援にもなる。\nでも「こうなってほしい」が強くなると、いつの間にか親の理想を彫刻し始める。\n\n大事なのは、期待を捨てることじゃなくて、一度問い直すこと。\n\n「その期待は、誰の未来？」\n\n親にも指導者にも、たまに必要な問いだと思う。',
    nextPostStatus: 'DRAFT / HUMAN_GATE',
    nextPostSource: 'DISTRIBUTION_OS · C049',
  },
];

export function findXAccountPlaybook(username?: string | null) {
  const normalized = String(username || '').replace(/^@/, '');
  return X_ACCOUNT_PLAYBOOKS.find((item) => item.username === normalized) || X_ACCOUNT_PLAYBOOKS[0];
}
