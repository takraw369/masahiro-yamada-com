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
    setNotice(`@${item.username} を選択。本文はそのまま保持します。`);
  }

  function loadNextPost(item: XAccountPlaybook) {
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
        {X_ACCOUNT_PLAYBOOKS.map((item, index) => (
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
