import { useEffect, useMemo, useState } from 'react';
import { STARTER_RECIPES, type StarterRecipe } from '../../lib/line-flow-recipes';

type LineAccount = { id:string; name?:string; displayName?:string };
type Handoff = { text?:string; title?:string; sourceId?:string; topic?:string };

const GOALS = [
  { id:'welcome', label:'新しい人を迎える', note:'安心 → 現在地 → 小さな体験' },
  { id:'education', label:'理解を深める', note:'問い → Why → Reframe → 体験' },
  { id:'diagnosis', label:'診断から動かす', note:'問い → 診断 → 理解 → 実験' },
  { id:'offer-soft', label:'商品へ自然につなぐ', note:'課題理解 → 選択肢 → 自己選択' },
  { id:'reactivate', label:'休眠から戻す', note:'許可 → 新しい問い → 軽い入口' },
  { id:'quest-soft-return', label:'Questをやさしく再開', note:'催促せず角度を変える' },
  { id:'quest-complete', label:'完了を学びへ変える', note:'体験 → 言語化 → 次の自発行動' },
] as const;

function accountName(account: LineAccount) {
  return account.displayName || account.name || account.id;
}

export default function LineFlowAssistant() {
  const [accounts, setAccounts] = useState<LineAccount[]>([]);
  const [accountId, setAccountId] = useState('');
  const [goal, setGoal] = useState('welcome');
  const [seed, setSeed] = useState<Handoff | null>(null);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState('');
  const [open, setOpen] = useState(true);

  const recipe = useMemo(() => STARTER_RECIPES.find((item) => item.id === goal) || STARTER_RECIPES[0], [goal]);

  useEffect(() => {
    try {
      const raw = sessionStorage.getItem('masa:line-seed');
      if (raw) {
        setSeed(JSON.parse(raw));
        sessionStorage.removeItem('masa:line-seed');
      }
    } catch {}

    void fetch('/api/line-harness/line-accounts', { headers: { Accept:'application/json' } })
      .then((res) => res.json())
      .then((payload) => {
        const rows = Array.isArray(payload?.data) ? payload.data : Array.isArray(payload) ? payload : [];
        setAccounts(rows);
        if (rows[0]?.id) setAccountId(rows[0].id);
      })
      .catch(() => {});
  }, []);

  async function api(path: string, init?: RequestInit) {
    const response = await fetch(`/api/line-harness/${path}`, {
      ...init,
      headers: init?.body ? { 'Content-Type':'application/json', ...(init.headers || {}) } : init?.headers,
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok || payload?.success === false) throw new Error(payload?.message || payload?.error || 'LINE API error');
    return payload?.data ?? payload;
  }

  async function createRecipe(selected: StarterRecipe) {
    if (!accountId) { setNotice('LINEアカウントを選んでください。'); return; }
    setBusy(true);
    setNotice('');
    try {
      const scenario = await api('scenarios', {
        method:'POST',
        body:JSON.stringify({
          name:`下書き｜${selected.name}`,
          description:`目的から組んだ非稼働Flow。${selected.purpose}`,
          triggerType:selected.triggerType,
          lineAccountId:accountId,
          deliveryMode:'elapsed',
          isActive:false,
        }),
      });
      for (const [index, step] of selected.steps.entries()) {
        await api(`scenarios/${scenario.id}/steps`, {
          method:'POST',
          body:JSON.stringify({
            stepOrder:index + 1,
            offsetDays:step.offsetDays,
            offsetMinutes:step.offsetMinutes ?? 0,
            messageType:'text',
            messageContent:step.message,
          }),
        });
      }
      setNotice(`✓ 「${selected.name}」を非稼働の下書きFlowとして作成しました。下のBuilderでMASA味に整えてから有効化してください。`);
      window.setTimeout(() => window.location.reload(), 1400);
    } catch (value) {
      setNotice(`作成できませんでした：${value instanceof Error ? value.message : String(value)}`);
    } finally {
      setBusy(false);
    }
  }

  async function copyRecipe(selected: StarterRecipe) {
    const text = selected.steps.map((step, index) => `${index + 1}. ${step.angle}｜${step.offsetDays}日後${step.offsetMinutes ? ` ${step.offsetMinutes}分` : ''}\n${step.message}`).join('\n\n');
    await navigator.clipboard.writeText(text);
    setNotice('Flow文言をコピーしました。');
  }

  if (!open) return <button className="lfa-reopen" onClick={() => setOpen(true)}>目的からFlowを組む</button>;

  return (
    <section className="lfa-shell">
      <header>
        <div><span>LINE FLOW ASSIST</span><h2>目的を選ぶ。型と文言は先に置いておく。</h2></div>
        <button className="lfa-close" onClick={() => setOpen(false)}>×</button>
      </header>
      <p className="lfa-lead">COPY OSの考え方と既存Flow Recipeを使い、ゼロから文章を考えない。作るのは必ず非稼働の下書きです。</p>

      {seed?.text && (
        <aside className="lfa-seed">
          <b>INTELLIGENCEから持ってきた素材</b>
          <strong>{seed.title || 'Content seed'}</strong>
          <p>{seed.text.slice(0, 520)}{seed.text.length > 520 ? '…' : ''}</p>
          <button onClick={() => void navigator.clipboard.writeText(seed.text || '')}>素材をCopy</button>
        </aside>
      )}

      <div className="lfa-goals">
        {GOALS.map((item) => (
          <button key={item.id} className={goal === item.id ? 'active' : ''} onClick={() => setGoal(item.id)}>
            <b>{item.label}</b><small>{item.note}</small>
          </button>
        ))}
      </div>

      <div className="lfa-preview">
        <div className="lfa-preview-head">
          <div><span>{recipe.icon} RECIPE</span><h3>{recipe.name}</h3><p>{recipe.purpose}</p></div>
          {accounts.length > 0 && <select value={accountId} onChange={(e) => setAccountId(e.target.value)}>{accounts.map((account) => <option value={account.id} key={account.id}>{accountName(account)}</option>)}</select>}
        </div>
        <ol>
          {recipe.steps.map((step, index) => (
            <li key={`${recipe.id}-${index}`}>
              <div><b>{step.angle}</b><small>{step.offsetDays === 0 && !step.offsetMinutes ? 'すぐ' : `${step.offsetDays}日後${step.offsetMinutes ? ` +${step.offsetMinutes}分` : ''}`}</small></div>
              <p>{step.message}</p>
            </li>
          ))}
        </ol>
        <div className="lfa-actions">
          <button onClick={() => void copyRecipe(recipe)}>文言をまとめてCopy</button>
          <button className="primary" disabled={busy || !accountId} onClick={() => void createRecipe(recipe)}>{busy ? '作成中…' : 'このFlowを下書き作成'}</button>
        </div>
      </div>
      {notice && <div className="lfa-notice">{notice}</div>}

      <style>{`
        .lfa-shell{max-width:1440px;margin:12px auto 0;padding:15px 22px 18px;color:#25211d;font-family:-apple-system,BlinkMacSystemFont,"SF Pro Text","Hiragino Sans","Yu Gothic","Noto Sans JP",system-ui,sans-serif}.lfa-shell>header{display:flex;justify-content:space-between;gap:20px;align-items:start}.lfa-shell header span{font-size:12px;letter-spacing:.08em;font-weight:800;color:#8b5b2c}.lfa-shell h2{font-size:18px;line-height:1.45;margin:3px 0}.lfa-close{border:0;background:transparent;font:inherit;font-size:20px;color:#716b63;cursor:pointer}.lfa-lead{font-size:14px;line-height:1.75;color:#59636e;max-width:900px}.lfa-seed{margin-top:12px;padding:12px 13px;border:1px solid #d7c49f;background:#fffaf2}.lfa-seed b{display:block;font-size:12px;color:#8b5b2c}.lfa-seed strong{display:block;font-size:15px;margin-top:3px}.lfa-seed p{font-size:14px;line-height:1.7;color:#4f5962;white-space:pre-wrap;margin:5px 0 8px}.lfa-seed button,.lfa-actions button,.lfa-reopen{min-height:38px;border:1px solid #d4cdc4;background:#fff;color:#58636d;font:inherit;font-size:13px;padding:6px 10px;cursor:pointer}.lfa-goals{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:7px;margin-top:13px}.lfa-goals button{min-height:70px;text-align:left;border:1px solid #d8d2c9;background:#fff;padding:10px 11px;color:#4f5962;font:inherit;cursor:pointer}.lfa-goals button.active{border-color:#b88b4b;background:#f8efe1;color:#67400f}.lfa-goals b{display:block;font-size:14px;line-height:1.4}.lfa-goals small{display:block;font-size:12px;line-height:1.5;color:#707983;margin-top:4px}.lfa-preview{margin-top:10px;border:1px solid #d8d2c9;background:#fff;padding:14px}.lfa-preview-head{display:flex;justify-content:space-between;gap:16px;align-items:start}.lfa-preview-head span{font-size:12px;color:#8b5b2c;font-weight:800}.lfa-preview h3{font-size:17px;margin-top:3px}.lfa-preview-head p{font-size:13px;line-height:1.65;color:#59636e;max-width:760px;margin-top:3px}.lfa-preview select{min-height:40px;border:1px solid #d4cdc4;background:#fff;font:inherit;font-size:14px;padding:7px 10px}.lfa-preview ol{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:7px;list-style:none;padding:0;margin:12px 0 0;counter-reset:flow}.lfa-preview li{border:1px solid #e0dbd3;background:#fbfaf8;padding:11px;counter-increment:flow}.lfa-preview li>div{display:flex;justify-content:space-between;gap:8px}.lfa-preview li b{font-size:13px;color:#744b18}.lfa-preview li small{font-size:12px;color:#707983}.lfa-preview li p{font-size:14px;line-height:1.7;color:#424a52;margin-top:6px}.lfa-actions{display:flex;justify-content:flex-end;gap:7px;margin-top:12px}.lfa-actions .primary{border-color:#b88b4b;background:#f4e5cf;color:#67400f;font-weight:800}.lfa-notice{margin-top:10px;padding:10px 12px;border:1px solid #c9d4c3;background:#f5faf3;color:#42603e;font-size:13px;line-height:1.6}.lfa-reopen{margin:12px 22px}@media(max-width:900px){.lfa-goals{grid-template-columns:repeat(2,1fr)}.lfa-preview ol{grid-template-columns:1fr}}@media(max-width:560px){.lfa-shell{padding:12px 14px 16px}.lfa-goals{grid-template-columns:1fr}.lfa-preview-head{flex-direction:column}.lfa-preview-head select{width:100%;font-size:16px}.lfa-actions{display:grid;grid-template-columns:1fr}.lfa-actions button{width:100%;min-height:44px}.lfa-seed p,.lfa-preview li p{font-size:15px}}
      `}</style>
    </section>
  );
}
