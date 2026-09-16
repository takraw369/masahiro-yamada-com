import { useEffect, useState } from 'react';

type Item = { id:string; title:string; topic?:string; contentSeed?:string; excerpt?:string; status:string };

type Handoff = { text?:string; title?:string; sourceId?:string; topic?:string };

function fillComposer(text: string) {
  const attempt = (remaining: number) => {
    const textarea = Array.from(document.querySelectorAll('textarea')).find((node) =>
      node.getAttribute('placeholder')?.includes('今日の気づき')
    ) as HTMLTextAreaElement | undefined;
    if (!textarea) {
      if (remaining > 0) window.setTimeout(() => attempt(remaining - 1), 160);
      return;
    }
    const setter = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value')?.set;
    setter?.call(textarea, text);
    textarea.dispatchEvent(new Event('input', { bubbles: true }));
    textarea.focus();
    textarea.scrollIntoView({ behavior: 'smooth', block: 'center' });
  };
  attempt(15);
}

export default function PostDraftShelf() {
  const [items, setItems] = useState<Item[]>([]);
  const [open, setOpen] = useState(true);
  const [notice, setNotice] = useState('');

  useEffect(() => {
    try {
      const raw = sessionStorage.getItem('masa:x-draft');
      if (raw) {
        const handoff = JSON.parse(raw) as Handoff;
        if (handoff.text) {
          fillComposer(handoff.text);
          setNotice(`「${handoff.title || 'Intelligence Draft'}」を本文へ入れました。ここからMASA味に。`);
        }
        sessionStorage.removeItem('masa:x-draft');
      }
    } catch {}

    void fetch('/api/dashboard/intelligence', { headers: { Accept: 'application/json' } })
      .then((res) => res.json())
      .then((data) => {
        const rows = Array.isArray(data?.items) ? data.items : [];
        setItems(rows.filter((item: Item) => item.contentSeed || item.status === 'content_seed').slice(0, 8));
      })
      .catch(() => {});
  }, []);

  if (!open && !notice) {
    return <button className="pds-reopen" onClick={() => setOpen(true)}>AI Draft Shelfを開く</button>;
  }

  return (
    <section className="pds-shell" aria-label="AI Draft Shelf">
      <header>
        <div><span>AI DRAFT SHELF</span><h2>先にAIが作る。最後はMASAが決める。</h2></div>
        <button className="pds-close" onClick={() => setOpen(false)} aria-label="閉じる">×</button>
      </header>
      {notice && <div className="pds-notice">✓ {notice}</div>}
      {open && (
        <>
          <p className="pds-lead">Intelligence / 資産から生成済みの投稿種。使うものだけ本文へ入れて、語尾・温度・実体験を足して投稿へ。</p>
          <div className="pds-list">
            {items.length ? items.map((item) => (
              <article key={item.id}>
                <div className="pds-meta"><span>{item.topic || 'General'}</span><span>AI DRAFT</span></div>
                <h3>{item.title}</h3>
                <p>{(item.contentSeed || item.excerpt || '').slice(0, 300)}{(item.contentSeed || item.excerpt || '').length > 300 ? '…' : ''}</p>
                <div className="pds-actions">
                  <button className="primary" onClick={() => { fillComposer(item.contentSeed || item.excerpt || item.title); setNotice(`「${item.title}」を本文へ入れました。`); }}>本文に入れる</button>
                  <button onClick={() => void navigator.clipboard.writeText(item.contentSeed || item.excerpt || item.title)}>Copy</button>
                </div>
              </article>
            )) : <div className="pds-empty">AI Draftはまだありません。Intelligenceで「AI投稿化」するとここへ流れます。</div>}
          </div>
        </>
      )}
      <style>{`
        .pds-shell{margin-bottom:14px;border:1px solid #d7c8b2;background:#fffaf2;padding:14px 15px;color:#25211d}.pds-shell>header{display:flex;justify-content:space-between;gap:16px;align-items:start}.pds-shell header span{font-size:.75rem;color:#8b5b2c;font-weight:800;letter-spacing:.08em}.pds-shell h2{font-size:1.05rem;line-height:1.45;margin-top:2px}.pds-close{border:0;background:transparent;font:inherit;font-size:1.2rem;cursor:pointer;color:#736b61}.pds-lead{font-size:.86rem;line-height:1.7;color:#59636e;margin:7px 0 11px}.pds-notice{margin:8px 0;padding:8px 10px;border:1px solid #bfd1b9;background:#f4faf2;color:#43613e;font-size:.84rem}.pds-list{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px;max-height:340px;overflow:auto}.pds-list article{background:#fff;border:1px solid #ddd7cf;padding:11px}.pds-meta{display:flex;gap:5px;flex-wrap:wrap}.pds-meta span{font-size:.72rem;border:1px solid #ddd7cf;padding:2px 5px;color:#6b6359}.pds-list h3{font-size:.92rem;line-height:1.5;margin-top:7px}.pds-list p{font-size:.84rem;line-height:1.7;color:#59636e;margin-top:6px;white-space:pre-wrap}.pds-actions{display:flex;gap:5px;margin-top:9px}.pds-actions button,.pds-reopen{min-height:36px;border:1px solid #d2cbc1;background:#fff;color:#59636e;font:inherit;font-size:.8rem;padding:6px 9px;cursor:pointer}.pds-actions .primary{border-color:#c7a46d;background:#f6ead8;color:#704817;font-weight:800}.pds-empty{grid-column:1/-1;padding:18px;border:1px dashed #d2cbc1;color:#6c747c;font-size:.84rem}.pds-reopen{margin-bottom:12px}@media(max-width:900px){.pds-list{grid-template-columns:1fr 1fr}}@media(max-width:560px){.pds-list{grid-template-columns:1fr;max-height:420px}}
      `}</style>
    </section>
  );
}
