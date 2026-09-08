import { useEffect, useMemo, useState } from 'react';

type Platform = 'X' | 'Instagram' | 'note';
type QueueStatus = 'HOLD' | 'DRAFT' | 'READY' | 'PUBLISHED';

type MediaDoor = {
  id: string;
  platform: Platform;
  name: string;
  handle: string;
  url: string;
  role: string;
  theme: string;
  audience: string;
  cta: string;
  status: string;
  brand: string;
};

type ContentItem = {
  id: string;
  title: string;
  status: QueueStatus;
  sourceUrl: string;
  sourceState: string;
  hook: string;
  body: string;
  cta: string;
  primaryDoorId: string | null;
  reuseDoorIds: string[];
};

type LiveContentRow = {
  asset_id: string;
  current_title: string | null;
  productization_status: string | null;
  next_action: string | null;
  source_url: string | null;
  last_reviewed: string | null;
  source_updated_at: string | null;
};

type DistributionApiResponse = {
  ok: boolean;
  storage: string;
  content: LiveContentRow[];
};

const STORAGE_KEY = 'masa-primary-distribution-board-v1';
const FILTER_KEY = 'masa-primary-distribution-filter-v1';

// Snapshot intentionally mirrors verified/owned entries in Drive SNS_ACCOUNT_REGISTRY.
// The Dashboard is an operating overlay, not the canonical account registry.
const MEDIA: MediaDoor[] = [
  {
    id: 'x-masa',
    platform: 'X',
    name: 'MASA / Personal',
    handle: '@MASAHIRO_501',
    url: 'https://x.com/MASAHIRO_501',
    role: '思想の種まき・反応検証・対話',
    theme: 'アスリート × Flow × 身体性 × 哲学',
    audience: '自己成長・健康・教育・アスリートに関心のある層',
    cta: 'note / ACE / Athlete Quest / Sun Loves Flow',
    status: 'ACTIVE / profile rebuild',
    brand: 'MASA / Personal',
  },
  {
    id: 'x-kids',
    platform: 'X',
    name: 'Athlete Education',
    handle: '@kodomo_athlete',
    url: 'https://x.com/kodomo_athlete',
    role: '育成テーマの短文・会話・反応検証',
    theme: '子ども × アスリート × 脳科学 × 教育',
    audience: '子育て層・ジュニアアスリート・指導者',
    cta: 'DM / 深掘り導線',
    status: 'ACTIVE / 0 posts',
    brand: 'Athlete Education / Kids',
  },
  {
    id: 'ig-kids',
    platform: 'Instagram',
    name: 'Athlete Education',
    handle: '@kodomo_athlete',
    url: 'https://www.instagram.com/kodomo_athlete/',
    role: '視覚コンテンツ・体験・信頼形成',
    theme: '子ども × アスリート × 脳科学 × 教育',
    audience: '子育て層・ジュニアアスリート・指導者',
    cta: 'DM / プロフィールリンク',
    status: 'ACTIVE / 0 posts',
    brand: 'Athlete Education / Kids',
  },
  {
    id: 'ig-slf',
    platform: 'Instagram',
    name: 'Sun Loves Flow',
    handle: '@sunlovesflow',
    url: 'https://www.instagram.com/sunlovesflow/',
    role: 'ブランド世界観の城門',
    theme: 'Flow・身体性・哲学・世界観',
    audience: '健康・自己探究・教育・世界観に共鳴する層',
    cta: 'sunlovesflow.com / note',
    status: 'OWNED / verify profile',
    brand: 'Sun Loves Flow',
  },
  {
    id: 'note-masa',
    platform: 'note',
    name: 'MASA / Main',
    handle: 'masahiroyamada',
    url: 'https://note.com/masahiroyamada',
    role: '長文・信頼構築・知識資産化',
    theme: '脳・身体・アスリート・教育・生き方',
    audience: '深く理解したい読者',
    cta: '記事 → 商品 / ACE / Athlete Quest',
    status: 'KNOWN / verify current',
    brand: 'MASA / Personal',
  },
  {
    id: 'note-slf',
    platform: 'note',
    name: 'Sun Loves Flow',
    handle: 'sunlovesflow',
    url: 'https://note.com/sunlovesflow',
    role: 'ブランド思想の長文資産化',
    theme: 'Flow・身体性・哲学・ブランド思想',
    audience: '世界観を深く読みたい層',
    cta: 'sunlovesflow.com / 商品 / Community',
    status: 'OWNED / verify profile',
    brand: 'Sun Loves Flow',
  },
];

const C034_X = `技術があるのに、本番で出せない。\n\nこれを全部「メンタルが弱い」で片づけるのは、もったいないと思っています。\n\n僕自身、日本代表として20年以上やってきて、調子が悪い日も、流れを失う試合も何度もありました。\n\n大事なのは「最高の自分になること」より、“今の自分から次の1プレーへ戻れること”。\n\nあなたは崩れる時、最初に何が変わりますか？\n呼吸、視線、足、思考、声——ひとつ教えてください。`;

const C034_THREADS = `「練習ではできるのに、本番になると出せない」\n\nこれをすぐ「メンタルが弱い」「自信がない」で終わらせてしまうことがあります。\n\nでも、本番で崩れる時って、いきなり別人になるわけじゃない。\n呼吸が浅くなる。視線が変わる。足が止まる。判断が遅れる。\nそしてプレーが変わる。\n\n必要なのは、気持ちを無理に強くすることより「自分はどこから崩れ始めるのか」「何をすれば次の1プレーに戻れるのか」を知っておくこと。\n\n最高の状態を待たない。今の自分から、次の1プレーを作る。\n\nあなたは本番で崩れる時、最初に何が変わりますか？`;

const C034_INSTAGRAM = `技術があるのに、本番で出せない理由。\n\nそれを全部「メンタルが弱い」で終わらせない。\n\n僕はセパタクローで長く日本代表として活動してきました。振り返ると、本当に残ったのは勝った時の方法だけではありません。\n\n調子が悪い日。流れを失った試合。ミスした直後。役割が変わった時。\n\nそんな時に、自分をどう次の1プレーへ戻すか。\n\n競技では技術を練習します。身体も鍛えます。でも「崩れた時に戻る方法」は曖昧なままになりやすい。\n\n「できる技術」はある。では「本番で出せる状態」はどう作るのか。\n\nあなたの場合、崩れる時に最初に変わるのは何ですか？`;

const DEFAULT_QUEUE: ContentItem[] = [
  {
    id: 'C034',
    title: '技術があるのに本番で出せない理由',
    status: 'HOLD',
    sourceUrl: 'https://docs.google.com/document/d/16j7EngzwxUQqmxJ6dG3H6HtmabE6nHmXNkDjFi695c0/edit',
    sourceState: 'CONTENT READY / DISTRIBUTION HOLD — Primary Account未決定',
    hook: '技術があるのに、本番で出せない。',
    body: C034_X,
    cta: 'あなたは崩れる時、最初に何が変わりますか？',
    primaryDoorId: null,
    reuseDoorIds: [],
  },
  {
    id: 'C033',
    title: 'ゾーンは待つものじゃない。条件を整えるもの。',
    status: 'DRAFT',
    sourceUrl: 'https://docs.google.com/spreadsheets/d/1C4QoQMneCmQ4rVAWAXWX5L18hzmwJRGitS4UdOSz6QM/edit',
    sourceState: 'DRAFT — MASA一次体験を1つ足して初稿化',
    hook: 'ゾーンは、来るのを待つものじゃない。',
    body: 'CONTENT_OS正本をfresh-readして、Primary Account決定後に媒体別稿へ落とす。',
    cta: '自分が整う条件を1つ言語化する',
    primaryDoorId: null,
    reuseDoorIds: [],
  },
  {
    id: 'C035',
    title: '13歳の自分へ｜未来世代に渡す競技人生の手紙',
    status: 'DRAFT',
    sourceUrl: 'https://drive.google.com/file/d/1RPTvwolFqlMOMiKlu30W7A6ZfNNHsfx5/view',
    sourceState: 'DRAFT — Story候補。まず1本試作',
    hook: '13歳の自分に、いま何を伝えるだろう。',
    body: 'Story / note / Instagram向けの長文素材。正本を基準に編集する。',
    cta: 'Story → Quest / ACE',
    primaryDoorId: null,
    reuseDoorIds: [],
  },
];

function loadQueue(): ContentItem[] {
  if (typeof window === 'undefined') return DEFAULT_QUEUE;
  try {
    const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null');
    return Array.isArray(parsed) && parsed.length ? parsed : DEFAULT_QUEUE;
  } catch {
    return DEFAULT_QUEUE;
  }
}

function saveQueue(items: ContentItem[]) {
  if (typeof window !== 'undefined') localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
}

function mediaById(id: string | null) {
  return MEDIA.find((item) => item.id === id) || null;
}

function base64url(value: unknown) {
  const bytes = new TextEncoder().encode(JSON.stringify(value));
  let binary = '';
  bytes.forEach((byte) => { binary += String.fromCharCode(byte); });
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

function noteBody(item: ContentItem) {
  return `${item.body}\n\n---\n\n${item.cta}`.trim();
}

function platformDraft(item: ContentItem, target: 'x' | 'threads' | 'instagram' | 'note' | 'shorts') {
  if (item.id === 'C034') {
    if (target === 'x') return C034_X;
    if (target === 'threads') return C034_THREADS;
    if (target === 'instagram') return C034_INSTAGRAM;
  }
  if (target === 'note') return `${item.title}\n\n${noteBody(item)}`;
  if (target === 'shorts') return `HOOK\n${item.hook}\n\nBODY\n${item.body}\n\nCTA\n${item.cta}`;
  return `${item.hook}\n\n${item.body}\n\n${item.cta}`.trim();
}

function cleanTitle(value: string | null, fallback: string) {
  if (!value?.trim()) return fallback;
  return value.replace(/^SEED｜/, '').trim();
}

function statusFromCanonical(item: ContentItem, value: string | null): QueueStatus {
  const text = (value || '').toUpperCase();
  if (text.includes('DISTRIBUTION_HOLD') || text.includes('HOLD')) return 'HOLD';
  if (item.id === 'C034' && !item.primaryDoorId) return 'HOLD';
  if (text.includes('READY')) return item.primaryDoorId ? 'READY' : item.status;
  if (text.includes('PUBLISHED')) return 'PUBLISHED';
  return item.status;
}

function mergeCanonical(current: ContentItem[], rows: LiveContentRow[]) {
  const byId = new Map(rows.map((row) => [row.asset_id, row]));
  return current.map((item) => {
    const row = byId.get(item.id);
    if (!row) return item;
    const canonicalState = [row.productization_status, row.next_action].filter(Boolean).join(' — ');
    return {
      ...item,
      title: cleanTitle(row.current_title, item.title),
      status: statusFromCanonical(item, row.productization_status),
      sourceUrl: row.source_url || item.sourceUrl,
      sourceState: canonicalState || item.sourceState,
    };
  });
}

const palette = {
  bg: '#0D0B08',
  panel: '#17130f',
  panel2: '#201a14',
  border: '#332b22',
  gold: '#C9A96E',
  text: '#DDD0B8',
  muted: '#8A7C68',
  green: '#75b798',
  red: '#d88578',
  blue: '#82aee8',
};

export default function DistributionBoard() {
  const [queue, setQueue] = useState<ContentItem[]>(loadQueue);
  const [filter, setFilter] = useState(() => typeof window === 'undefined' ? 'ALL' : localStorage.getItem(FILTER_KEY) || 'ALL');
  const [selectedId, setSelectedId] = useState('C034');
  const [message, setMessage] = useState('');
  const [syncState, setSyncState] = useState<'loading' | 'live' | 'fallback'>('loading');

  useEffect(() => {
    let cancelled = false;

    fetch('/api/dashboard/distribution', { cache: 'no-store' })
      .then(async (response) => {
        if (!response.ok) throw new Error(`distribution_${response.status}`);
        return response.json() as Promise<DistributionApiResponse>;
      })
      .then((payload) => {
        if (cancelled || !payload.ok || !Array.isArray(payload.content)) return;
        setQueue((current) => {
          const next = mergeCanonical(current, payload.content);
          saveQueue(next);
          return next;
        });
        setSyncState('live');
      })
      .catch(() => {
        if (!cancelled) setSyncState('fallback');
      });

    return () => { cancelled = true; };
  }, []);

  const selected = queue.find((item) => item.id === selectedId) || queue[0];
  const selectedMedia = mediaById(selected?.primaryDoorId || null);

  const visibleQueue = useMemo(() => {
    if (filter === 'ALL') return queue;
    return queue.filter((item) => item.primaryDoorId === filter || item.reuseDoorIds.includes(filter));
  }, [queue, filter]);

  const mutateQueue = (updater: (items: ContentItem[]) => ContentItem[]) => {
    setQueue((current) => {
      const next = updater(current);
      saveQueue(next);
      return next;
    });
  };

  const updateItem = (id: string, patch: Partial<ContentItem>) => {
    mutateQueue((items) => items.map((item) => item.id === id ? { ...item, ...patch } : item));
  };

  const setPrimary = (item: ContentItem, doorId: string | null) => {
    const status: QueueStatus = doorId && item.status === 'HOLD' ? 'READY' : (!doorId && item.id === 'C034' ? 'HOLD' : item.status);
    updateItem(item.id, { primaryDoorId: doorId, status });
  };

  const move = (id: string, delta: number) => {
    mutateQueue((items) => {
      const next = [...items];
      const from = next.findIndex((item) => item.id === id);
      const to = Math.max(0, Math.min(next.length - 1, from + delta));
      if (from < 0 || from === to) return items;
      const [moved] = next.splice(from, 1);
      next.splice(to, 0, moved);
      return next;
    });
  };

  const copy = async (text: string, ok: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setMessage(ok);
    } catch {
      setMessage('クリップボードに書き込めませんでした');
    }
    window.setTimeout(() => setMessage(''), 2600);
  };

  const copyNoteCommand = async (item: ContentItem) => {
    const account = mediaById(item.primaryDoorId)?.platform === 'note' ? mediaById(item.primaryDoorId) : MEDIA.find((m) => m.id === 'note-masa');
    const payload = base64url({
      source: 'masahiroyamada.com/dashboard/distribution',
      content_id: item.id,
      account: account?.handle || 'masahiroyamada',
      title: item.title,
      body: noteBody(item),
      requested_at: new Date().toISOString(),
    });
    const command = `cd ~/masa-automation/mcp/masa-os && npm run note:handoff -- ${payload}`;
    await copy(command, '✓ note MCP下書きコマンドをコピーしました');
  };

  const setFilterSafe = (id: string) => {
    setFilter(id);
    if (typeof window !== 'undefined') localStorage.setItem(FILTER_KEY, id);
  };

  const reset = () => {
    mutateQueue(() => DEFAULT_QUEUE);
    setSelectedId('C034');
    setFilterSafe('ALL');
  };

  return (
    <div style={{ color: palette.text, fontFamily: "'Zen Kaku Gothic New', sans-serif" }}>
      <header style={{ marginBottom: 26 }}>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
          <span style={eyebrow}>DISTRIBUTION OS · PRIMARY</span>
          <span style={{ ...eyebrow, color: palette.green, borderColor: '#345244' }}>Human Gate ON</span>
          <span style={{ ...eyebrow, color: syncState === 'live' ? palette.green : syncState === 'fallback' ? palette.red : palette.muted }}>
            {syncState === 'live' ? 'Drive Sync LIVE' : syncState === 'fallback' ? 'Static Fallback' : 'Drive Sync…'}
          </span>
        </div>
        <h1 style={{ margin: '10px 0 6px', fontFamily: "'Cormorant Garamond', serif", fontSize: 'clamp(2rem,5vw,3.6rem)', fontWeight: 300, color: palette.gold }}>What → Where → CTA</h1>
        <p style={{ color: palette.muted, maxWidth: 900, lineHeight: 1.8 }}>
          Driveを正本のまま、次に何を・誰として・どこへ流すかを決める操作面。公開は自動化しません。
          noteはローカルMASA OS MCPへ下書きhandoff、X/Instagram/Threads/Shortsは媒体別ドラフトとして再利用します。
        </p>
      </header>

      <section style={{ ...panel, marginBottom: 18, borderColor: selectedMedia ? '#4d6d5b' : '#68453f' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 18, flexWrap: 'wrap', alignItems: 'center' }}>
          <div>
            <span style={label}>ACCOUNT SELECTION GATE</span>
            <h2 style={{ margin: '6px 0', fontSize: '1.25rem', fontWeight: 500 }}>
              {selected?.id || '—'} · {selected?.title || 'Contentを選択'}
            </h2>
            <p style={{ margin: 0, color: selectedMedia ? palette.green : palette.red }}>
              {selectedMedia ? `READY TO ROUTE → ${selectedMedia.platform} ${selectedMedia.handle}` : 'DISTRIBUTION HOLD — Primary Accountを1つ選ぶ'}
            </p>
          </div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <a href="https://docs.google.com/spreadsheets/d/1mB9ZodA700hd3IRnV2Ijp-4tQ3_Y1tg_ZwGKOq_DWA8/edit" target="_blank" rel="noreferrer" style={ghostLink}>CONTENT_OS ↗</a>
            <a href="https://docs.google.com/spreadsheets/d/1uPKSKKpCw-6SkAOjmv4YkoglePtWBfkY126VewBW_wg/edit" target="_blank" rel="noreferrer" style={ghostLink}>ACCOUNT REGISTRY ↗</a>
            <a href="https://docs.google.com/spreadsheets/d/1429YnqTU2-WOjX-EALGo6DSeNdHjqBGDsx8HgBVhsH4/edit" target="_blank" rel="noreferrer" style={ghostLink}>DISTRIBUTION_OS ↗</a>
          </div>
        </div>
      </section>

      <section style={{ marginBottom: 26 }}>
        <div style={sectionHead}>
          <div><span style={label}>MEDIA DOORS</span><h2 style={sectionTitle}>実在確認済みの扉</h2></div>
          <button onClick={() => setFilterSafe('ALL')} style={smallButton}>ALL MEDIA</button>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(230px,1fr))', gap: 12 }}>
          {MEDIA.map((door) => {
            const active = filter === door.id;
            const primary = selected?.primaryDoorId === door.id;
            return (
              <article key={door.id} style={{ ...mediaCard, borderColor: primary ? palette.gold : active ? '#6b5c48' : palette.border }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
                  <span style={{ ...eyebrow, color: door.platform === 'X' ? '#c9d8e8' : door.platform === 'Instagram' ? '#e9a8c7' : '#8ed0ad' }}>{door.platform}</span>
                  <span style={{ fontSize: 11, color: palette.muted }}>{door.status}</span>
                </div>
                <h3 style={{ margin: '14px 0 3px', fontSize: 18 }}>{door.name}</h3>
                <div style={{ color: palette.gold, fontSize: 13 }}>{door.handle}</div>
                <p style={{ minHeight: 50, color: palette.muted, fontSize: 13, lineHeight: 1.6 }}>{door.role}</p>
                <div style={{ fontSize: 12, lineHeight: 1.6, color: '#aa9b84' }}><b>THEME</b> {door.theme}</div>
                <div style={{ fontSize: 12, lineHeight: 1.6, color: '#aa9b84', marginTop: 4 }}><b>CTA</b> {door.cta}</div>
                <div style={{ display: 'flex', gap: 7, marginTop: 15, flexWrap: 'wrap' }}>
                  <button onClick={() => selected && setPrimary(selected, door.id)} style={primary ? activeButton : smallButton}>{primary ? 'PRIMARY ✓' : 'Primaryにする'}</button>
                  <button onClick={() => setFilterSafe(door.id)} style={smallButton}>絞る</button>
                  <a href={door.url} target="_blank" rel="noreferrer" style={smallLink}>開く ↗</a>
                </div>
              </article>
            );
          })}
        </div>
        <div style={{ ...panel, marginTop: 12, padding: 14, background: '#12161a' }}>
          <b style={{ color: palette.blue }}>Threads / TikTok / Shorts</b>
          <span style={{ color: palette.muted, marginLeft: 10, lineHeight: 1.7 }}>
            ThreadsはInstagram同一ID候補だが実URL・有効化未確認なのでMedia Door化しない。TikTok / Shortsは勝ち動画の再利用先として扱い、専用制作を増やさない。
          </span>
        </div>
      </section>

      <section>
        <div style={sectionHead}>
          <div><span style={label}>NEXT POST DECK</span><h2 style={sectionTitle}>次に流す順番</h2></div>
          <button onClick={reset} style={smallButton}>overlayを初期化</button>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1.2fr) minmax(300px,.8fr)', gap: 16 }} className="distribution-grid">
          <div style={{ display: 'grid', gap: 10 }}>
            {visibleQueue.map((item, index) => {
              const primary = mediaById(item.primaryDoorId);
              const isSelected = selected?.id === item.id;
              return (
                <article key={item.id} onClick={() => setSelectedId(item.id)} style={{ ...queueCard, borderColor: isSelected ? palette.gold : palette.border, cursor: 'pointer' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: 14, alignItems: 'flex-start' }}>
                    <div style={{ display: 'flex', gap: 12, minWidth: 0 }}>
                      <div style={{ fontFamily: "'Cormorant Garamond',serif", color: palette.gold, fontSize: 28, minWidth: 34 }}>{String(index + 1).padStart(2, '0')}</div>
                      <div style={{ minWidth: 0 }}>
                        <div style={{ display: 'flex', gap: 7, flexWrap: 'wrap', alignItems: 'center' }}>
                          <span style={eyebrow}>{item.id}</span>
                          <span style={{ ...eyebrow, color: item.status === 'READY' ? palette.green : item.status === 'HOLD' ? palette.red : palette.muted }}>{item.status}</span>
                        </div>
                        <h3 style={{ margin: '8px 0 4px', fontSize: 17 }}>{item.title}</h3>
                        <p style={{ margin: 0, color: palette.muted, fontSize: 12 }}>{item.sourceState}</p>
                        <div style={{ marginTop: 10, fontSize: 12, color: primary ? palette.green : palette.red }}>{primary ? `Primary: ${primary.platform} ${primary.handle}` : 'Primary: 未決定'}</div>
                      </div>
                    </div>
                    <div style={{ display: 'grid', gap: 5 }}>
                      <button onClick={(e) => { e.stopPropagation(); move(item.id, -1); }} style={tinyButton}>↑</button>
                      <button onClick={(e) => { e.stopPropagation(); move(item.id, 1); }} style={tinyButton}>↓</button>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>

          {selected && (
            <aside style={{ ...panel, position: 'sticky', top: 20, alignSelf: 'start' }}>
              <span style={label}>ROUTE / EDIT</span>
              <h3 style={{ margin: '7px 0 16px', fontSize: 20 }}>{selected.id} · {selected.title}</h3>

              <label style={fieldLabel}>Primary Channel</label>
              <select value={selected.primaryDoorId || ''} onChange={(e) => setPrimary(selected, e.target.value || null)} style={inputStyle}>
                <option value="">未決定 / HOLD</option>
                {MEDIA.map((door) => <option key={door.id} value={door.id}>{door.platform} · {door.handle} · {door.brand}</option>)}
              </select>

              <label style={fieldLabel}>Hook</label>
              <textarea value={selected.hook} onChange={(e) => updateItem(selected.id, { hook: e.target.value })} rows={2} style={inputStyle} />
              <label style={fieldLabel}>Body / Draft</label>
              <textarea value={selected.body} onChange={(e) => updateItem(selected.id, { body: e.target.value })} rows={9} style={inputStyle} />
              <label style={fieldLabel}>CTA</label>
              <textarea value={selected.cta} onChange={(e) => updateItem(selected.id, { cta: e.target.value })} rows={2} style={inputStyle} />

              <div style={{ display: 'flex', gap: 7, flexWrap: 'wrap', marginTop: 13 }}>
                <a href={selected.sourceUrl} target="_blank" rel="noreferrer" style={smallLink}>正本を開く ↗</a>
                {selected.primaryDoorId && <button onClick={() => setPrimary(selected, null)} style={smallButton}>Primary解除</button>}
              </div>

              <div style={{ borderTop: `1px solid ${palette.border}`, marginTop: 18, paddingTop: 16 }}>
                <span style={label}>REPURPOSE / HANDOFF</span>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2,minmax(0,1fr))', gap: 7, marginTop: 10 }}>
                  <button onClick={() => copy(platformDraft(selected, 'x'), '✓ X稿をコピーしました')} style={actionButton}>X稿をコピー</button>
                  <button onClick={() => copy(platformDraft(selected, 'threads'), '✓ Threads稿をコピーしました')} style={actionButton}>Threads稿をコピー</button>
                  <button onClick={() => copy(platformDraft(selected, 'instagram'), '✓ Instagram稿をコピーしました')} style={actionButton}>Instagram稿をコピー</button>
                  <button onClick={() => copy(platformDraft(selected, 'shorts'), '✓ Shorts/Reels台本をコピーしました')} style={actionButton}>Shorts台本をコピー</button>
                  <button onClick={() => copy(platformDraft(selected, 'note'), '✓ note本文をコピーしました')} style={actionButton}>note本文をコピー</button>
                  <button onClick={() => copyNoteCommand(selected)} style={{ ...actionButton, borderColor: '#587b65', color: '#9fd1ad' }}>note MCP下書き</button>
                </div>
                <p style={{ color: palette.muted, fontSize: 12, lineHeight: 1.7, marginBottom: 0 }}>
                  note MCPは「コマンドをコピー」まで。Mac Terminalで貼り付けると、ログイン済みBrave profileを使って下書き保存し、公開はしません。
                  Xの実送信は既存X Harness、LINEは既存Content Schedulerを継続利用します。
                </p>
                <div style={{ display: 'flex', gap: 7, flexWrap: 'wrap', marginTop: 10 }}>
                  <a href="/dashboard/post" style={smallLink}>X Harness →</a>
                  <a href="/dashboard/content-schedule" style={smallLink}>X / LINE Scheduler →</a>
                </div>
              </div>
            </aside>
          )}
        </div>
      </section>

      {message && <div style={{ position: 'fixed', right: 22, bottom: 22, padding: '12px 16px', background: '#203126', color: '#b9dfc4', border: '1px solid #4d6d5b', borderRadius: 8, zIndex: 999 }}>{message}</div>}

      <style>{`
        @media (max-width: 980px) {
          .distribution-grid { grid-template-columns: 1fr !important; }
        }
      `}</style>
    </div>
  );
}

const panel: React.CSSProperties = { background: palette.panel, border: `1px solid ${palette.border}`, borderRadius: 10, padding: 18 };
const mediaCard: React.CSSProperties = { ...panel, padding: 16, background: 'linear-gradient(145deg,#17130f,#1d1812)' };
const queueCard: React.CSSProperties = { ...panel, padding: 15, transition: 'border-color .15s, transform .15s' };
const eyebrow: React.CSSProperties = { display: 'inline-flex', padding: '3px 7px', border: `1px solid ${palette.border}`, borderRadius: 99, fontSize: 10, letterSpacing: '.1em', color: palette.gold };
const label: React.CSSProperties = { fontSize: 10, letterSpacing: '.14em', color: palette.gold };
const sectionTitle: React.CSSProperties = { margin: '4px 0 0', fontFamily: "'Cormorant Garamond',serif", fontSize: 27, fontWeight: 400 };
const sectionHead: React.CSSProperties = { display: 'flex', justifyContent: 'space-between', alignItems: 'end', gap: 14, marginBottom: 12 };
const smallButton: React.CSSProperties = { background: 'transparent', color: palette.muted, border: `1px solid ${palette.border}`, borderRadius: 6, padding: '7px 9px', cursor: 'pointer', fontFamily: 'inherit', fontSize: 12 };
const activeButton: React.CSSProperties = { ...smallButton, color: palette.gold, borderColor: palette.gold };
const tinyButton: React.CSSProperties = { ...smallButton, padding: '3px 8px' };
const smallLink: React.CSSProperties = { ...smallButton, textDecoration: 'none', display: 'inline-flex', alignItems: 'center' };
const ghostLink: React.CSSProperties = { ...smallLink, color: palette.gold };
const fieldLabel: React.CSSProperties = { display: 'block', color: palette.muted, fontSize: 11, margin: '11px 0 5px', letterSpacing: '.06em' };
const inputStyle: React.CSSProperties = { width: '100%', padding: '9px 10px', background: '#100d0b', border: `1px solid ${palette.border}`, borderRadius: 6, color: palette.text, font: 'inherit', fontSize: 13, lineHeight: 1.6, resize: 'vertical' };
const actionButton: React.CSSProperties = { background: '#15120f', color: palette.text, border: `1px solid ${palette.border}`, borderRadius: 7, padding: '9px 8px', cursor: 'pointer', fontFamily: 'inherit', fontSize: 12 };
