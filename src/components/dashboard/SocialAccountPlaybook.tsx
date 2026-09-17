import { useEffect, useState } from 'react';

type AccountPlaybook = {
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

const LAST_ACCOUNT_KEY = 'masa_x_last_account';

// Derived UI snapshot only.
// Canonical account state: Drive SNS_ACCOUNT_REGISTRY.
// Canonical publish queue/state: Drive DISTRIBUTION_OS.
// This X-only surface intentionally shows only verified/registered X accounts.
const ACCOUNTS: AccountPlaybook[] = [
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

function dispatchToComposer(account: AccountPlaybook, text?: string) {
  window.dispatchEvent(new CustomEvent('masa:x-compose', {
    detail: { username: account.username, ...(text ? { text } : {}) },
  }));
}

function composerHasDraft() {
  const textarea = Array.from(document.querySelectorAll('textarea')).find((node) =>
    node.getAttribute('placeholder')?.includes('今日の気づき')
  ) as HTMLTextAreaElement | undefined;
  return Boolean(textarea?.value.trim());
}

export default function SocialAccountPlaybook() {
  const [active, setActive] = useState(0);
  const [lastUsed, setLastUsed] = useState<string | null>(null);
  const [notice, setNotice] = useState('');
  const account = ACCOUNTS[active];

  useEffect(() => {
    try {
      const stored = window.localStorage.getItem(LAST_ACCOUNT_KEY);
      const index = stored ? ACCOUNTS.findIndex((item) => item.username === stored) : -1;
      if (index >= 0) {
        setLastUsed(stored);
        setActive(index);
      }
    } catch {}
  }, []);

  function remember(item: AccountPlaybook) {
    setLastUsed(item.username);
    try { window.localStorage.setItem(LAST_ACCOUNT_KEY, item.username); } catch {}
  }

  function selectForComposer(item: AccountPlaybook) {
    remember(item);
    dispatchToComposer(item);
    setNotice(`@${item.username} を選択。本文はそのまま保持します。`);
  }

  function loadNextPost(item: AccountPlaybook) {
    if (composerHasDraft() && !window.confirm('本文に下書きがあります。NEXT POSTで置き換えますか？')) {
      remember(item);
      dispatchToComposer(item);
      setNotice(`@${item.username} に切替。既存の本文は保持しました。`);
      return;
    }
    remember(item);
    dispatchToComposer(item, item.nextPost);
    setNotice(`@${item.username} を選択し、NEXT POSTを本文へ入れました。`);
  }

  return (
    <section className="sap-shell" aria-label="SNS Account Playbook">
      <header className="sap-head">
        <span>SNS ACCOUNT OS · DRIVE DERIVED</span>
        <h2>誰に、どんな世界観で、何を出すかを先に決める。</h2>
        <p>ここは正本ではなく操作面。XはDriveで所有・登録確認できた垢だけ表示し、NEXT POSTもDistribution OSの状態を明示します。</p>
      </header>

      <div className="sap-tabs" role="tablist" aria-label="Verified X accounts">
        {ACCOUNTS.map((item, index) => (
          <button key={item.username} className={index === active ? 'active' : ''} onClick={() => { setActive(index); setNotice(''); }} role="tab" aria-selected={index === active}>
            <strong>{item.name}</strong>
            <small>@{item.username}{lastUsed === item.username ? ' · LAST' : ''}</small>
          </button>
        ))}
      </div>

      <div className="sap-card">
        <div className="sap-title">
          <div><span>{account.role}</span><h3>{account.name} <small>@{account.username}</small></h3></div>
          <button className="sap-select" onClick={() => selectForComposer(account)}>この垢を選ぶ</button>
        </div>

        <div className="sap-source"><strong>{account.accountStatus}</strong><span>{account.accountSource}</span></div>
        {notice && <p className="sap-notice" role="status" aria-live="polite">{notice}</p>}

        <div className="sap-profile"><small>PROFILE / 運用プロフ</small><p>{account.profile}</p></div>

        <div className="sap-grid">
          <article><small>CONCEPT</small><p>{account.concept}</p></article>
          <article><small>WORLDVIEW</small><p>{account.worldview}</p></article>
          <article><small>AUDIENCE</small><p>{account.audience}</p></article>
          <article><small>TONE</small><p>{account.tone}</p></article>
        </div>

        <div className="sap-pill-row">{account.pillars.map((pillar) => <span key={pillar}>{pillar}</span>)}</div>
        <div className="sap-boundary"><small>境界線 / この垢でやりすぎないこと</small><p>{account.boundary}</p></div>

        <div className="sap-next">
          <div className="sap-next-head">
            <div><small>NEXT POST · {account.nextPostStatus}</small><strong>次に出せる投稿</strong><em>{account.nextPostSource}</em></div>
            <button onClick={() => loadNextPost(account)}>NEXT POSTを本文に入れる →</button>
          </div>
          <p>{account.nextPost}</p>
          <div>{account.nextPost.length} / 280</div>
        </div>
      </div>

      <style>{`
        .sap-shell{margin-bottom:16px;border:1px solid #d8cbb8;background:#fffdf9;padding:16px;color:#25211d}.sap-head>span{font-size:.76rem;letter-spacing:.1em;color:#9a6d24;font-weight:900}.sap-head h2{margin:3px 0 2px;font-size:1.08rem}.sap-head p{margin:0;color:#6f675e;font-size:.88rem;line-height:1.65}.sap-tabs{display:flex;gap:7px;overflow-x:auto;padding:12px 0 10px}.sap-tabs button{min-width:190px;text-align:left;border:1px solid #ded7ce;background:#fff;padding:9px 10px;cursor:pointer;color:#5f574f;font:inherit}.sap-tabs button.active{border-color:#b4863b;background:#fbf2e4;color:#4b3215}.sap-tabs strong,.sap-tabs small{display:block}.sap-tabs strong{font-size:.88rem}.sap-tabs small{font-size:.78rem;margin-top:2px;color:#8a8177}.sap-card{border:1px solid #e0d8cd;background:#fff;padding:14px}.sap-title{display:flex;align-items:start;justify-content:space-between;gap:14px}.sap-title>div>span{font-size:.78rem;color:#8b5b2c;font-weight:800}.sap-title h3{font-size:1.08rem;margin:2px 0}.sap-title h3 small{font-size:.8rem;color:#8a8177;font-weight:500}.sap-select{border:1px solid #c9a975;background:#fff;color:#704817;font:inherit;font-size:.8rem;font-weight:850;padding:8px 10px;cursor:pointer}.sap-source{display:flex;gap:8px;flex-wrap:wrap;align-items:center;margin-top:8px}.sap-source strong{font-size:.76rem;border:1px solid #d8cbb8;background:#fff9ef;padding:4px 7px;color:#704817}.sap-source span{font-size:.76rem;color:#8a8177}.sap-notice{margin:10px 0 0;padding:8px 10px;border-left:3px solid #b4863b;background:#fff9ef;color:#62451f;font-size:.82rem}.sap-profile,.sap-boundary{margin-top:10px;padding:10px 11px;background:#faf8f5;border:1px solid #ece6de}.sap-profile small,.sap-boundary small,.sap-grid small,.sap-next small{display:block;color:#8a8177;font-size:.72rem;letter-spacing:.08em;font-weight:900;margin-bottom:4px}.sap-profile p,.sap-boundary p,.sap-grid p{margin:0;font-size:.9rem;line-height:1.7;color:#4f4942;white-space:pre-wrap}.sap-grid{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-top:8px}.sap-grid article{border:1px solid #ece6de;padding:10px}.sap-pill-row{display:flex;gap:6px;flex-wrap:wrap;margin-top:8px}.sap-pill-row span{font-size:.78rem;border:1px solid #d8cbb8;background:#fff9ef;padding:4px 7px;color:#704817}.sap-next{margin-top:10px;border:1px solid #cfae79;background:#fffaf2;padding:12px}.sap-next-head{display:flex;justify-content:space-between;align-items:end;gap:12px}.sap-next-head strong{display:block;font-size:.94rem}.sap-next-head em{display:block;font-size:.74rem;color:#8a8177;font-style:normal}.sap-next-head button{border:1px solid #9a6d24;background:#b4863b;color:#1f1a14;font:inherit;font-size:.82rem;font-weight:900;padding:8px 10px;cursor:pointer}.sap-next>p{white-space:pre-wrap;margin:10px 0 0;font-size:.94rem;line-height:1.75;color:#302c28}.sap-next>div:last-child{text-align:right;color:#8a8177;font-size:.76rem;margin-top:6px}@media(max-width:700px){.sap-shell{padding:12px}.sap-grid{grid-template-columns:1fr}.sap-title,.sap-next-head{flex-direction:column;align-items:stretch}.sap-select,.sap-next-head button{width:100%;min-height:40px}}
      `}</style>
    </section>
  );
}
