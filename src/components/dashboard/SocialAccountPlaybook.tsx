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
  nextPost: string;
};

const LAST_ACCOUNT_KEY = 'masa_x_last_account';

const ACCOUNTS: AccountPlaybook[] = [
  {
    username: 'MASAHIRO_501',
    name: 'MASAHIRO YAMADA',
    role: '本人 / Master Account',
    profile: '元日本代表20年｜心と身体・FLOW・教育｜競技と人生の経験を、問いと実践に変える。',
    concept: '体験 → 問い → 本質 → 次の一歩。MASA本人の一次情報を中心に、考え方と生き方を見せる本丸。',
    worldview: '身体で確かめ、複数の視点で流れを見る。完成された先生として語るより、実践し続ける人として残す。',
    audience: '30〜50代を中心に、競技・仕事・家庭・学びの次フェーズを探す人。教育、コーチング、社会に関心がある人。',
    tone: '一人称。熱はあるが断定しすぎない。体験が先、理論は後。余白と問いを残す。',
    pillars: ['競技20年の再解釈', '心身・FLOW', '学び / 社会を自分ごと化'],
    boundary: '情報まとめ専用にはしない。ブランド説明だけにも寄せない。必ず「MASAが何を見たか・感じたか」を入れる。',
    nextPost: '「ありのまま」と「そのまま」は、似ているようで違う。\nそのまま＝変えずに置く。\nありのまま＝評価や思い込みを足さず、まず観る。\n\nこの違いを知るだけで、人の見方も、自分の見え方も変わる。\nヴィパッサナーの「観る」にも近い。まず観る。そこから選ぶ。',
  },
  {
    username: 'spirit_exp',
    name: 'AROUND/40 Exp.',
    role: '40代の人生実験 / Experience Log',
    profile: '極上な人生を選択するための経験値を上げろ / Spirit & Body .Exp / ココロとカラダの本質を体感し生き様を魅せつけろ',
    concept: '40代から人生の経験値を上げる。身体・仕事・家族・学び・挑戦を、自分を使った実験ログとして残す。',
    worldview: '年齢＝衰えではなく、経験を統合して再設計できる時期。成功も失敗もExp.に変える。',
    audience: '35〜49歳前後。人生をもう一度面白くしたい人、体力・仕事・生き方を立て直したい人。',
    tone: '軽い、率直、実験的。途中経過OK。失敗も出す。少し遊びとwがあっていい。',
    pillars: ['40代の身体実験', '仕事・生活の再設計', '挑戦 / 学び / 経験値'],
    boundary: '先生っぽく完成形を教えない。研究資料だけで終わらせず「試した→どうだった→次どうする」を入れる。',
    nextPost: '40代って、衰える時期じゃなくて「経験を統合できる時期」なんじゃないか。\n\n身体、仕事、家族、失敗、競技、学び。\n若い頃は別々だった経験が、ここから繋がり始める。\n\nAROUND/40 Exp.では、自分を使って試したことをそのまま記録していく。',
  },
  {
    username: 'sunlovesflow',
    name: 'Sun Loves Flow',
    role: 'House / World / Integration',
    profile: '人が人をFLOWさせる。心・身体・学び・仕事を、流れとして整える実験場。',
    concept: 'MASA個人から生まれた知恵・実践・仕組みを、他の人も使える形へ変換する「器」。',
    worldview: '自分だけが整うのではなく、次の人も流れやすくなる。知識、体験、商品、コミュニティを循環でつなぐ。',
    audience: '心身・教育・コミュニティ・自己成長をバラバラではなく一つの流れとして捉えたい人。',
    tone: '静か、やわらかい、哲学的。煽らず、余白をつくる。個人垢より「私」より「場・流れ」を主語にする。',
    pillars: ['FLOWの概念', '実践を仕組みにする', 'コミュニティ / Quest / Offer'],
    boundary: '日記にしすぎない。単なる告知垢にしない。個人の体験を「他者も使える構造」に変換して出す。',
    nextPost: 'FLOWは「ずっと調子がいい状態」じゃない。\n詰まっても、止まっても、また流れをつくれること。\n\n自分だけを整えるのではなく、次の人も少し流れやすくする。\nその連鎖をどう設計できるか。\nSun Loves Flowは、その実験場にしたい。',
  },
  {
    username: 'kodomo_athlete',
    name: 'こどもアスリート',
    role: 'Child / Parent / Coach Education',
    profile: '子どもの運動・学び・成長を「できる / できない」で終わらせない。遊び×身体×問いで可能性を育てる。',
    concept: '子どもの可能性を潰さず伸ばす。運動・遊び・身体感覚・声かけを、親と指導者が使える形にする。',
    worldview: '評価より観察。正解を押しつけるより、その子の現在地と次の一歩を見つける。',
    audience: '小中学生の保護者、ジュニア指導者、子どもの運動や成長に関わる人。',
    tone: 'やさしい、具体的、短く実践的。専門語は噛み砕く。子どもを不安材料として煽らない。',
    pillars: ['運動能力 / 身体感覚', '親・指導者の声かけ', '遊び / 学び / 成長'],
    boundary: '大人向け自己啓発に寄せすぎない。子どもを比較・選別する言葉を避け、観察と具体策を中心にする。',
    nextPost: '子どもの運動で先に見たいのは「できた・できない」より、どこで流れが止まったか。\n\n怖い？ 分からない？ 身体がまだ追いつかない？\n原因が違えば、声かけも練習も変わる。\n\n評価より観察。そこから、その子に合う次の一歩をつくる。',
  },
  {
    username: 'SLF_INF',
    name: 'SLF INF',
    role: 'Research / Intelligence / Fact Layer',
    profile: '健康・教育・AI・社会の情報を、一次情報と構造で整理。事実 / 仮説 / 解釈を分けて残す。',
    concept: '情報を煽らず、構造とFlowで読む。MASAやSLFが考える前の「材料置き場・一次情報レイヤー」。',
    worldview: '何を信じるかの前に、何が確認できて、何が解釈で、何が未確定かを分ける。',
    audience: '健康、教育、AI、社会の情報を追いたいが、煽りや断定ではなく材料を見たい人。',
    tone: '冷静、短い、出典重視。事実 / 仮説 / 解釈を分ける。感情より確認可能性。',
    pillars: ['Research / Evidence', '健康・教育', 'AI・社会の構造'],
    boundary: '政治・社会を扱う場合も支持・不支持を決める投稿にしない。事実、制度、出典、論点を分けて提示する。',
    nextPost: '情報を見るとき、まず3つに分ける。\n\n1. 確認できる事実\n2. そこからの解釈\n3. まだ分からないこと\n\n健康でもAIでも社会でも、この3つを混ぜると話が急に荒くなる。\n「何が分かっていて、何が未確定か」を残すだけで判断の質はかなり変わる。',
  },
];

// UI Pattern Vault receipt: ui_buffer_channel_selector_20260917
// Mechanism only: fast context recall + context selection separated from draft replacement.
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
      if (!stored) return;
      const index = ACCOUNTS.findIndex((item) => item.username === stored);
      if (index >= 0) {
        setLastUsed(stored);
        setActive(index);
      }
    } catch {
      // local UI convenience only; canonical account config remains in code.
    }
  }, []);

  function remember(accountToRemember: AccountPlaybook) {
    setLastUsed(accountToRemember.username);
    try {
      window.localStorage.setItem(LAST_ACCOUNT_KEY, accountToRemember.username);
    } catch {
      // Browsers that block storage still retain the in-session selection.
    }
  }

  function chooseAccount(index: number) {
    setActive(index);
    setNotice('');
  }

  function selectForComposer(accountToSelect: AccountPlaybook) {
    remember(accountToSelect);
    dispatchToComposer(accountToSelect);
    setNotice(`@${accountToSelect.username} を選択。本文はそのまま保持します。`);
  }

  function loadNextPost(accountToLoad: AccountPlaybook) {
    if (composerHasDraft()) {
      const replace = window.confirm('本文に下書きがあります。NEXT POSTで置き換えますか？');
      if (!replace) {
        remember(accountToLoad);
        dispatchToComposer(accountToLoad);
        setNotice(`@${accountToLoad.username} に切替。既存の本文は保持しました。`);
        return;
      }
    }
    remember(accountToLoad);
    dispatchToComposer(accountToLoad, accountToLoad.nextPost);
    setNotice(`@${accountToLoad.username} を選択し、NEXT POSTを本文へ入れました。`);
  }

  return (
    <section className="sap-shell" aria-label="SNS Account Playbook">
      <header className="sap-head">
        <div>
          <span>SNS ACCOUNT OS</span>
          <h2>誰に、どんな世界観で、何を出すかを先に決める。</h2>
          <p>アカウント選択と本文挿入は別操作。垢を切り替えても、書きかけの本文は勝手に消しません。</p>
        </div>
      </header>

      <div className="sap-tabs" role="tablist" aria-label="X accounts">
        {ACCOUNTS.map((item, index) => (
          <button
            key={item.username}
            className={index === active ? 'active' : ''}
            onClick={() => chooseAccount(index)}
            role="tab"
            aria-selected={index === active}
          >
            <strong>{item.name}</strong>
            <small>@{item.username}{lastUsed === item.username ? ' · LAST' : ''}</small>
          </button>
        ))}
      </div>

      <div className="sap-card">
        <div className="sap-title">
          <div>
            <span>{account.role}</span>
            <h3>{account.name} <small>@{account.username}</small></h3>
          </div>
          <div className="sap-title-actions">
            <div className="sap-pill">{active === 0 ? 'CORE' : 'ROLE'}</div>
            <button className="sap-select" onClick={() => selectForComposer(account)}>この垢を選ぶ</button>
          </div>
        </div>

        {notice && <p className="sap-notice" role="status" aria-live="polite">{notice}</p>}

        <div className="sap-profile">
          <small>PROFILE / 運用プロフ</small>
          <p>{account.profile}</p>
        </div>

        <div className="sap-grid">
          <article><small>CONCEPT</small><p>{account.concept}</p></article>
          <article><small>WORLDVIEW</small><p>{account.worldview}</p></article>
          <article><small>AUDIENCE</small><p>{account.audience}</p></article>
          <article><small>TONE</small><p>{account.tone}</p></article>
        </div>

        <div className="sap-pillar-row">
          {account.pillars.map((pillar) => <span key={pillar}>{pillar}</span>)}
        </div>

        <div className="sap-boundary">
          <small>境界線 / この垢でやりすぎないこと</small>
          <p>{account.boundary}</p>
        </div>

        <div className="sap-next">
          <div className="sap-next-head">
            <div><small>NEXT POST</small><strong>次に出せる投稿</strong></div>
            <button onClick={() => loadNextPost(account)}>NEXT POSTを本文に入れる →</button>
          </div>
          <p>{account.nextPost}</p>
          <div className="sap-count">{account.nextPost.length} / 280</div>
        </div>
      </div>

      <style>{`
        .sap-shell{margin-bottom:16px;border:1px solid #d8cbb8;background:#fffdf9;padding:16px;color:#25211d}.sap-head span{font-size:.72rem;letter-spacing:.1em;color:#9a6d24;font-weight:900}.sap-head h2{margin:3px 0 2px;font-size:1.08rem;line-height:1.45}.sap-head p{margin:0;color:#6f675e;font-size:.84rem;line-height:1.65}.sap-tabs{display:flex;gap:7px;overflow-x:auto;padding:12px 0 10px}.sap-tabs button{min-width:145px;text-align:left;border:1px solid #ded7ce;background:#fff;padding:9px 10px;cursor:pointer;color:#5f574f;font:inherit}.sap-tabs button.active{border-color:#b4863b;background:#fbf2e4;color:#4b3215}.sap-tabs strong,.sap-tabs small{display:block}.sap-tabs strong{font-size:.82rem}.sap-tabs small{font-size:.72rem;margin-top:2px;color:#8a8177}.sap-card{border:1px solid #e0d8cd;background:#fff;padding:14px}.sap-title{display:flex;align-items:start;justify-content:space-between;gap:14px}.sap-title>div>span{font-size:.72rem;color:#8b5b2c;font-weight:800}.sap-title h3{font-size:1.08rem;margin:2px 0 0}.sap-title h3 small{font-size:.78rem;color:#8a8177;font-weight:500}.sap-title-actions{display:flex;align-items:center;gap:7px;flex-wrap:wrap;justify-content:flex-end}.sap-pill{font-size:.66rem;font-weight:900;letter-spacing:.08em;border:1px solid #c9a975;background:#fbf2e4;padding:4px 7px;color:#704817}.sap-select{border:1px solid #c9a975;background:#fff;color:#704817;font:inherit;font-size:.76rem;font-weight:850;padding:7px 9px;cursor:pointer}.sap-select:hover{background:#fff9ef}.sap-notice{margin:10px 0 0;padding:8px 10px;border-left:3px solid #b4863b;background:#fff9ef;color:#62451f;font-size:.78rem;line-height:1.55}.sap-profile,.sap-boundary{margin-top:11px;padding:10px 11px;background:#faf8f5;border:1px solid #ece6de}.sap-profile small,.sap-boundary small,.sap-grid small,.sap-next small{display:block;color:#8a8177;font-size:.66rem;letter-spacing:.08em;font-weight:900;margin-bottom:4px}.sap-profile p,.sap-boundary p,.sap-grid p{margin:0;font-size:.84rem;line-height:1.7;color:#4f4942}.sap-grid{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-top:8px}.sap-grid article{border:1px solid #ece6de;padding:10px}.sap-pillar-row{display:flex;gap:6px;flex-wrap:wrap;margin-top:8px}.sap-pillar-row span{font-size:.72rem;border:1px solid #d8cbb8;background:#fff9ef;padding:4px 7px;color:#704817}.sap-next{margin-top:10px;border:1px solid #cfae79;background:#fffaf2;padding:12px}.sap-next-head{display:flex;justify-content:space-between;align-items:end;gap:12px}.sap-next-head strong{display:block;font-size:.9rem}.sap-next-head button{border:1px solid #9a6d24;background:#b4863b;color:#1f1a14;font:inherit;font-size:.78rem;font-weight:900;padding:8px 10px;cursor:pointer}.sap-next>p{white-space:pre-wrap;margin:10px 0 0;font-size:.9rem;line-height:1.75;color:#302c28}.sap-count{text-align:right;color:#8a8177;font-size:.72rem;margin-top:6px}@media(max-width:700px){.sap-shell{padding:12px}.sap-grid{grid-template-columns:1fr}.sap-title{flex-direction:column}.sap-title-actions{justify-content:flex-start}.sap-next-head{align-items:stretch;flex-direction:column}.sap-next-head button,.sap-select{width:100%;min-height:40px}}
      `}</style>
    </section>
  );
}
