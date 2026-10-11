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

// Operational snapshot for the dashboard.
// Canonical account / publish state can continue to live in Drive, but this UI also
// carries owner-decided draft positioning that has not yet been pushed to public profiles.
export const X_ACCOUNT_PLAYBOOKS: XAccountPlaybook[] = [
  {
    username: 'MASAHIRO_501',
    publicUsername: 'MASAHIRO_501',
    handleStatus: 'CURRENT / KEEP',
    name: 'MASA｜生き方×探究',
    role: 'PERSON / 実践者',
    mission: '自分で生きて、試して、掘って、見えたことを打ち込む。',
    profile: '元セパタクロー日本代表🇯🇵｜日本一30回超・アジア大会🥉\n食べる・動く・考える・遊ぶ。自分で試して、掘って、見えたことを打ち込む。\n人の可能性と、日々の選択から生まれるFLOWを探究。',
    concept: 'MASA本人を実験場にするアカウント。完成した正解を教えるより、一次体験・違和感・問い・実践・検証をそのまま資産にする。',
    worldview: '人は固定された完成品ではない。日々の選択と体験によって、見える世界も身体も関係性も変わっていく。',
    audience: '生き方、身体、食、学び、スポーツ、仕事を自分で試しながら更新したい人。',
    tone: '生っぽい・好奇心・実験的。体験が先、理屈は後。断定しすぎず、でも打ち込む時は迷わない。',
    pillars: ['一次体験 / 実験', '身体・食・思考', '挑戦 / FLOW / 生き方'],
    routeWhen: '「俺はこう感じた・試した・変わった」が主語になる時。',
    routeExamples: ['自分の食事を変えてみた結果', '競技経験の再解釈', '仕事・家族・身体で起きた発見'],
    boundary: '情報まとめ専用にしない。ブランドの公式見解だけを流さない。MASA自身の体験・問い・選択が見える状態に戻す。',
    accountStatus: 'ACTIVE / PROFILE DRAFT',
    accountSource: 'OWNER DECISION · 2026-10-06',
    nextPost: '最近あらためて思う。\n\n人が変わるのは、正しい答えを知った瞬間より、\n「ちょっと試してみよう」と次の体験を選んだ瞬間かもしれない。\n\n食も、身体も、学びも同じ。\nまず自分で試す。そこから見えたものを残していく。',
    nextPostStatus: 'SEED DRAFT / HUMAN_GATE',
    nextPostSource: '3-account brand architecture · 2026-10-06',
  },
  {
    username: 'sunlovesflow',
    publicUsername: 'sunlovesflow',
    handleStatus: 'CURRENT / KEEP',
    name: 'Sun Loves Flow｜歓びから文化へ',
    role: 'CULTURE / 世界観',
    mission: '歓びから選んだ日々が、文化と豊かさのFLOWになっていく。',
    profile: '日々の選択と、人と人との関係から文化は生まれる。\n食・身体・癒し・暮らし・自然・仕事・祝うこと。\nSoul Pleasureから生まれる、豊かなFLOWを探究する。',
    concept: '個人の習慣を超えて、暮らし・関係・地域・経済・文化がどう循環するかを見るSLFの世界観アカウント。',
    worldview: '社会を変えるために「正しく生きる」のではなく、歓びから選んだ生き方が結果として周囲や文化を豊かにしていく。',
    audience: '食・健康・自然・文化・地域・働き方などを、分断せず「暮らし全体」として考えたい人。',
    tone: '温かい・余白がある・詩的すぎない。本質は深く、入口は日常。否定や対立を起点にしない。',
    pillars: ['食と暮らし', '身体と癒し', '文化・地域・経済循環'],
    routeWhen: '「個人の体験」より、暮らし・文化・社会のあり方や循環が主語になる時。',
    routeExamples: ['世界の食文化と日々の選択', '地域にお金が循環する仕組み', '祭り・風習・自然と暮らす知恵'],
    boundary: '政治的な敵味方づくりや正しさの押し付けを主語にしない。思想は日常の選択・体験・文化へ着地させる。',
    accountStatus: 'ACTIVE / PROFILE DRAFT',
    accountSource: 'OWNER VERIFIED + POSITIONING DECISION · 2026-10-06',
    nextPost: '文化って、誰かが上から作るものだけじゃない。\n\n何を食べるか。どう身体を使うか。誰と過ごすか。何を祝うか。\n毎日の小さな選択が、繰り返されて、誰かに渡っていく。\n\nその先に文化がある。\n歓びから始まるFLOWを、日常から見つけていきたい。',
    nextPostStatus: 'SEED DRAFT / HUMAN_GATE',
    nextPostSource: '3-account brand architecture · 2026-10-06',
  },
  {
    username: 'kodomo_athlete',
    publicUsername: 'all_are_ace',
    handleStatus: 'TARGET / RENAME UIで取得可否を最終確認',
    name: 'ALL ARE ACE｜可能性をひらく教育',
    role: 'GROWTH / 人づくり',
    mission: '一人ひとりのACEが発揮される環境と、次に選べる体験を増やす。',
    profile: '保護者・指導者・教育者へ。\n教育は「次に選べる体験を増やす」こと。\n遊び・運動・学び・食・関わり方から、一人ひとりのACEが発揮される環境を探究する。',
    concept: '「一部の優秀な人だけがACE」ではなく、全員の中に固有のACEがあるという思想を、教育・育成の実践へ落とす。',
    worldview: '育てる側／育てられる側を固定しない。観察し、体験を増やし、本人が選べる余白をつくることで可能性が発現していく。',
    audience: '保護者、指導者、教育者。今は次世代育成を中心にしながら、将来は大人の学びや組織にも広げられる。',
    tone: '肯定的・具体的・実践的。不安を煽らず、今日ひとつ変えられる関わり方や体験へ落とす。',
    pillars: ['遊び・運動・学び', '食・身体・成長環境', '親・指導者・教育者の関わり'],
    routeWhen: '「人がどう育つか」「次にどんな体験を選べるか」が主語になる時。',
    routeExamples: ['子どもの間食と成長環境', '指導中の声かけと観察', '遊びから運動能力や好奇心が育つ条件'],
    boundary: '子どもの比較・選別や恐怖訴求を軸にしない。「こうすべき」より、選択肢と体験を増やす方向へ戻す。',
    accountStatus: 'ACTIVE AS @kodomo_athlete / REBRAND DRAFT',
    accountSource: 'CURRENT ACCOUNT + TARGET ID DECISION · 2026-10-06',
    nextPost: 'ALL ARE ACE。\n\nACEは、一部の「できる人」だけの称号じゃない。\n一人ひとりに、その人にしか出せない強みや役割がある。\n\n教育で増やしたいのは、正解の数より「次に選べる体験」。\nその体験の中から、自分のACEが少しずつ見えてくる。',
    nextPostStatus: 'SEED DRAFT / HUMAN_GATE',
    nextPostSource: '3-account brand architecture · 2026-10-06',
  },
];

export function findXAccountPlaybook(username?: string | null) {
  const normalized = String(username || '').replace(/^@/, '').toLowerCase();
  return X_ACCOUNT_PLAYBOOKS.find((item) =>
    item.username.toLowerCase() === normalized ||
    item.publicUsername?.toLowerCase() === normalized
  ) || X_ACCOUNT_PLAYBOOKS[0];
}
