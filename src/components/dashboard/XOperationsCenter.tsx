import { useEffect, useState } from 'react';
import XCommandCenter from './XCommandCenter';
import XHealthPanel from './XHealthPanel';

type Tab = 'publish' | 'health';

export default function XOperationsCenter() {
  const [tab, setTab] = useState<Tab>('publish');

  useEffect(() => {
    const openComposer = () => setTab('publish');
    window.addEventListener('masa:x-compose', openComposer);
    return () => window.removeEventListener('masa:x-compose', openComposer);
  }, []);

  return (
    <section style={{ marginTop: 18 }}>
      <div style={{ display: 'flex', gap: 8, marginBottom: 18 }}>
        <button
          type="button"
          onClick={() => setTab('publish')}
          style={tabStyle(tab === 'publish')}
        >
          ✍️ 投稿・予約
        </button>
        <button
          type="button"
          onClick={() => setTab('health')}
          style={tabStyle(tab === 'health')}
        >
          🩺 X Health
        </button>
      </div>
      <div hidden={tab !== 'publish'}><XCommandCenter /></div>
      {tab === 'health' && <XHealthPanel />}
    </section>
  );
}

function tabStyle(active: boolean): React.CSSProperties {
  return {
    flex: 1,
    padding: '11px 12px',
    borderRadius: 11,
    border: `1px solid ${active ? 'rgba(154,109,36,.42)' : 'rgba(37,33,29,.13)'}`,
    background: active ? 'rgba(154,109,36,.08)' : '#fff',
    color: active ? '#9a6d24' : '#736b61',
    cursor: 'pointer',
    fontFamily: 'inherit',
    fontSize: '.9rem',
    fontWeight: 800,
  };
}
