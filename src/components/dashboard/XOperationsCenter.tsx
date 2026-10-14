import { useEffect, useState } from 'react';
import XCommandCenter from './XCommandCenter';
import XHealthPanel from './XHealthPanel';
import XNativeConnectionPanel from './XNativeConnectionPanel';

type Tab = 'publish' | 'health';

export default function XOperationsCenter() {
  const [tab, setTab] = useState<Tab>('publish');

  useEffect(() => {
    const openComposer = () => setTab('publish');
    window.addEventListener('masa:x-compose', openComposer);
    return () => window.removeEventListener('masa:x-compose', openComposer);
  }, []);

  return (
    <section className="x-operations" aria-label="編集と接続状況">
      <div hidden={tab !== 'publish'}><XCommandCenter /></div>
      <div className="x-operations-nav">
        <button
          type="button"
          onClick={() => setTab('publish')}
          aria-pressed={tab === 'publish'}
        >
          編集する
        </button>
        <button
          type="button"
          onClick={() => setTab('health')}
          aria-pressed={tab === 'health'}
        >
          接続と分析
        </button>
      </div>
      {tab === 'health' && <><XNativeConnectionPanel /><XHealthPanel /></>}
    </section>
  );
}
