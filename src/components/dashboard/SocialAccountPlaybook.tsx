import { useEffect, useState } from 'react';
import {
  LAST_X_ACCOUNT_KEY,
  X_ACCOUNT_PLAYBOOKS,
  type XAccountPlaybook,
} from '../../lib/xAccountPlaybook';

function dispatchToComposer(account: XAccountPlaybook, text?: string) {
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

function visibleHandle(account: XAccountPlaybook) {
  return account.publicUsername || account.username;
}

export default function SocialAccountPlaybook() {
  const [active, setActive] = useState(0);
  const [lastUsed, setLastUsed] = useState<string | null>(null);
  const [notice, setNotice] = useState('');
  const account = X_ACCOUNT_PLAYBOOKS[active];

  useEffect(() => {
    try {
      const stored = window.localStorage.getItem(LAST_X_ACCOUNT_KEY);
      const index = stored ? X_ACCOUNT_PLAYBOOKS.findIndex((item) => item.username === stored) : -1;
      if (index >= 0) {
        setLastUsed(stored);
        setActive(index);
      }
    } catch {}
  }, []);

  function remember(item: XAccountPlaybook) {
    setLastUsed(item.username);
    try { window.localStorage.setItem(LAST_X_ACCOUNT_KEY, item.username); } catch {}
  }

  function selectForComposer(item: XAccountPlaybook) {
    remember(item);
    dispatchToComposer(item);
    const target = visibleHandle(item);
    setNotice(`@${target} を選択。本文はそのまま保持します。`);
  }

  function loadNextPost(item: XAccountPlaybook) {
    if (composerHasDraft() && !window.confirm('本文に下書きがあります。SEED DRAFTで置き換えますか？')) {
      remember(item);
      dispatchToComposer(item);
      setNotice(`@${visibleHandle(item)} に切替。既存の本文は保持しました。`);
      return;
    }
    remember(item);
    dispatchToComposer(item, item.nextPost);
    setNotice(`@${visibleHandle(item)} のSEED DRAFTを本文へ入れました。`);
  }

  return (
    <section className="sap-shell" aria-label="3 Account Brand OS">
      <header className="sap-head">
        <span>3 ACCOUNT BRAND OS · DRAFT</span>
        <h2>同じ思想から、3つの窓で打ち込む。</h2>
        <p>人＝MASA / 文化＝SLF / 育ち＝ALL ARE ACE。投稿先はテーマではなく「何を主語にするか」で決める。</p>
      </header>

      <div className="sap-mindset">
        <small>SERVICE ACE MINDSET</small>
        <strong>打ち込む。受け取るかどうかは委ねる。反応は「迎合」ではなく、次の打ち方を磨くために観る。</strong>
      </div>

      <div className="sap-route">
        <article><span>01</span><small>SOURCE</small><strong>体験・問い・調査</strong><p>まず素材を1つにする</p></article>
        <article><span>02</span><small>ROUTE</small><strong>主語で振り分ける</strong><p>人 / 文化 / 育ち</p></article>
        <article><span>03</span><small>ANGLE</small><strong>その垢の視点へ</strong><p>コピペせず再編集</p></article>
        <article><span>04</span><small>HUMAN GATE</small><strong>本人が精査する</strong><p>温度・言葉・事実</p></article>
        <article><span>05</span><small>PUBLISH</small><strong>サービスエース</strong><p>迷わず打ち込む</p></article>
        <article><span>06</span><small>LEARN</small><strong>反応を観察</strong><p>欲しい情報と変化を見る</p></article>
      </div>

      <div className="sap-routing-rule">
        <div><small>MASA</small><strong>「俺はどうした？」</strong><p>一次体験・実験・挑戦が主語</p></div>
        <div><small>SLF</small><strong>「どんな暮らし・文化？」</strong><p>日常の選択と循環が主語</p></div>
        <div><small>ALL ARE ACE</small><strong>「人はどう育つ？」</strong><p>体験・環境・関わりが主語</p></div>
      </div>

      <div className="sap-tabs" role="tablist" aria-label="Three brand accounts">
        {X_ACCOUNT_PLAYBOOKS.map((item, index) => {
          const publicHandle = visibleHandle(item);
          return (
            <button key={item.username} className={index === active ? 'active' : ''} onClick={() => { setActive(index); setNotice(''); }} role="tab" aria-selected={index === active}>
              <strong>{item.name}</strong>
              <small>@{publicHandle}{lastUsed === item.username ? ' · LAST' : ''}</small>
              {publicHandle !== item.username && <em>current @{item.username}</em>}
            </button>
          );
        })}
      </div>

      <div className="sap-card">
        <div className="sap-title">
          <div>
            <span>{account.role}</span>
            <h3>{account.name} <small>@{visibleHandle(account)}</small></h3>
            <p>{account.mission}</p>
          </div>
          <button className="sap-select" onClick={() => selectForComposer(account)}>この垢を選ぶ</button>
        </div>

        <div className="sap-source">
          <strong>{account.accountStatus}</strong>
          {account.handleStatus && <strong>{account.handleStatus}</strong>}
          <span>{account.accountSource}</span>
        </div>
        {visibleHandle(account) !== account.username && (
          <p className="sap-handle-note">ダッシュボード上のブランドIDは @{visibleHandle(account)}。投稿接続は改名前の @{account.username} を使います。</p>
        )}
        {notice && <p className="sap-notice" role="status" aria-live="polite">{notice}</p>}

        <div className="sap-profile"><small>PROFILE DRAFT / 公開前に精査</small><p>{account.profile}</p></div>

        <div className="sap-grid">
          <article><small>CONCEPT</small><p>{account.concept}</p></article>
          <article><small>WORLDVIEW</small><p>{account.worldview}</p></article>
          <article><small>AUDIENCE</small><p>{account.audience}</p></article>
          <article><small>TONE</small><p>{account.tone}</p></article>
        </div>

        <div className="sap-route-card">
          <div>
            <small>ROUTE WHEN</small>
            <strong>{account.routeWhen}</strong>
          </div>
          <ul>{account.routeExamples.map((example) => <li key={example}>{example}</li>)}</ul>
        </div>

        <div className="sap-pill-row">{account.pillars.map((pillar) => <span key={pillar}>{pillar}</span>)}</div>
        <div className="sap-boundary"><small>境界線 / この垢でやりすぎないこと</small><p>{account.boundary}</p></div>

        <div className="sap-next">
          <div className="sap-next-head">
            <div><small>SEED POST · {account.nextPostStatus}</small><strong>最初の方向を見るための下書き</strong><em>{account.nextPostSource}</em></div>
            <button onClick={() => loadNextPost(account)}>下書きを本文に入れる →</button>
          </div>
          <p>{account.nextPost}</p>
          <div>{account.nextPost.length} / 280</div>
        </div>
      </div>

      <style>{`
        .sap-shell{margin-bottom:16px;border:1px solid #d8cbb8;background:#fffdf9;padding:16px;color:#25211d}.sap-head>span{font-size:.76rem;letter-spacing:.1em;color:#9a6d24;font-weight:900}.sap-head h2{margin:3px 0 2px;font-size:1.14rem}.sap-head p{margin:0;color:#6f675e;font-size:.88rem;line-height:1.65}.sap-mindset{margin-top:12px;padding:12px 14px;border-left:4px solid #20242a;background:#f3efe8}.sap-mindset small{display:block;color:#8b5b2c;font-size:.7rem;font-weight:900;letter-spacing:.1em}.sap-mindset strong{display:block;margin-top:4px;font-size:.9rem;line-height:1.65}.sap-route{display:grid;grid-template-columns:repeat(6,1fr);margin-top:12px;border:1px solid #e0d8cd;background:#fff}.sap-route article{min-width:0;padding:10px;border-right:1px solid #ece6de}.sap-route article:last-child{border-right:0}.sap-route span{color:#b6aa9a;font-size:.68rem}.sap-route small,.sap-route strong,.sap-route p{display:block}.sap-route small{margin-top:5px;color:#9a6d24;font-size:.62rem;font-weight:900;letter-spacing:.08em}.sap-route strong{margin-top:3px;font-size:.78rem}.sap-route p{margin:3px 0 0;color:#80786e;font-size:.68rem;line-height:1.45}.sap-routing-rule{display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin-top:8px}.sap-routing-rule>div{padding:10px 11px;border:1px solid #e0d8cd;background:#faf8f5}.sap-routing-rule small{color:#8b5b2c;font-size:.68rem;font-weight:900;letter-spacing:.08em}.sap-routing-rule strong{display:block;margin-top:3px;font-size:.86rem}.sap-routing-rule p{margin:2px 0 0;color:#777067;font-size:.76rem}.sap-tabs{display:flex;gap:7px;overflow-x:auto;padding:12px 0 10px}.sap-tabs button{min-width:220px;text-align:left;border:1px solid #ded7ce;background:#fff;padding:9px 10px;cursor:pointer;color:#5f574f;font:inherit}.sap-tabs button.active{border-color:#b4863b;background:#fbf2e4;color:#4b3215}.sap-tabs strong,.sap-tabs small,.sap-tabs em{display:block}.sap-tabs strong{font-size:.88rem}.sap-tabs small{font-size:.78rem;margin-top:2px;color:#8a8177}.sap-tabs em{margin-top:2px;color:#9b9389;font-size:.68rem;font-style:normal}.sap-card{border:1px solid #e0d8cd;background:#fff;padding:14px}.sap-title{display:flex;align-items:start;justify-content:space-between;gap:14px}.sap-title>div>span{font-size:.78rem;color:#8b5b2c;font-weight:800}.sap-title h3{font-size:1.08rem;margin:2px 0}.sap-title h3 small{font-size:.8rem;color:#8a8177;font-weight:500}.sap-title>div>p{margin:4px 0 0;color:#615950;font-size:.86rem;line-height:1.55}.sap-select{border:1px solid #c9a975;background:#fff;color:#704817;font:inherit;font-size:.8rem;font-weight:850;padding:8px 10px;cursor:pointer}.sap-source{display:flex;gap:8px;flex-wrap:wrap;align-items:center;margin-top:8px}.sap-source strong{font-size:.72rem;border:1px solid #d8cbb8;background:#fff9ef;padding:4px 7px;color:#704817}.sap-source span{font-size:.72rem;color:#8a8177}.sap-handle-note,.sap-notice{margin:10px 0 0;padding:8px 10px;font-size:.82rem}.sap-handle-note{border-left:3px solid #7e8da0;background:#f4f7fa;color:#4f5d6b}.sap-notice{border-left:3px solid #b4863b;background:#fff9ef;color:#62451f}.sap-profile,.sap-boundary{margin-top:10px;padding:10px 11px;background:#faf8f5;border:1px solid #ece6de}.sap-profile small,.sap-boundary small,.sap-grid small,.sap-next small,.sap-route-card small{display:block;color:#8a8177;font-size:.72rem;letter-spacing:.08em;font-weight:900;margin-bottom:4px}.sap-profile p,.sap-boundary p,.sap-grid p{margin:0;font-size:.9rem;line-height:1.7;color:#4f4942;white-space:pre-wrap}.sap-grid{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-top:8px}.sap-grid article{border:1px solid #ece6de;padding:10px}.sap-route-card{display:grid;grid-template-columns:1.2fr 1fr;gap:12px;margin-top:8px;padding:10px 11px;border:1px solid #e5ded5;background:#fffdf9}.sap-route-card strong{font-size:.88rem;line-height:1.55}.sap-route-card ul{margin:0;padding-left:1.1rem;color:#6e665d;font-size:.8rem}.sap-route-card li+li{margin-top:4px}.sap-pill-row{display:flex;gap:6px;flex-wrap:wrap;margin-top:8px}.sap-pill-row span{font-size:.78rem;border:1px solid #d8cbb8;background:#fff9ef;padding:4px 7px;color:#704817}.sap-next{margin-top:10px;border:1px solid #cfae79;background:#fffaf2;padding:12px}.sap-next-head{display:flex;justify-content:space-between;align-items:end;gap:12px}.sap-next-head strong{display:block;font-size:.94rem}.sap-next-head em{display:block;font-size:.74rem;color:#8a8177;font-style:normal}.sap-next-head button{border:1px solid #9a6d24;background:#b4863b;color:#1f1a14;font:inherit;font-size:.82rem;font-weight:900;padding:8px 10px;cursor:pointer}.sap-next>p{white-space:pre-wrap;margin:10px 0 0;font-size:.94rem;line-height:1.75;color:#302c28}.sap-next>div:last-child{text-align:right;color:#8a8177;font-size:.76rem;margin-top:6px}@media(max-width:900px){.sap-route{grid-template-columns:repeat(3,1fr)}.sap-route article:nth-child(3){border-right:0}.sap-route article:nth-child(-n+3){border-bottom:1px solid #ece6de}}@media(max-width:700px){.sap-shell{padding:12px}.sap-grid,.sap-routing-rule,.sap-route-card{grid-template-columns:1fr}.sap-route{grid-template-columns:repeat(2,1fr)}.sap-route article{border-bottom:1px solid #ece6de}.sap-route article:nth-child(2n){border-right:0}.sap-title,.sap-next-head{flex-direction:column;align-items:stretch}.sap-select,.sap-next-head button{width:100%;min-height:40px}}
      `}</style>
    </section>
  );
}
