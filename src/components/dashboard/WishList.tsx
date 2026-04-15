import { useState, useEffect } from 'react';

interface WishItem {
  id: string;
  name: string;
  url: string;
  imageUrl: string;
  price: string;
  memo: string;
  rotation: number;
}

function genId() { return Math.random().toString(36).slice(2,9); }

function loadItems(): WishItem[] {
  try {
    const s = localStorage.getItem('ace-wishlist-v1');
    if (s) return JSON.parse(s);
  } catch {}
  return [];
}

function saveItems(items: WishItem[]) {
  try {
    localStorage.setItem('ace-wishlist-v1', JSON.stringify(items));
  } catch {}
}

function randomRotation(): number {
  return (Math.random() * 5 - 2) * 1;
}

const gold = '#C9A96E';
const goldMuted = '#8B7355';
const bgSurface = '#1A1612';
const bgElevated = '#241F1A';
const textPrimary = '#D4C5A9';
const textMuted = '#7A6F5F';
const borderDefault = '#2E2822';

export default function WishList() {
  const [items, setItems] = useState<WishItem[]>([]);
  const [form, setForm] = useState({
    name: '',
    url: '',
    imageUrl: '',
    price: '',
    memo: '',
  });
  const [imagePreview, setImagePreview] = useState('');

  useEffect(() => {
    setItems(loadItems());
  }, []);

  const handleImageUrlChange = (val: string) => {
    setForm(f => ({ ...f, imageUrl: val }));
    setImagePreview(val);
  };

  const addItem = () => {
    if (!form.name.trim()) return;
    const item: WishItem = {
      id: genId(),
      name: form.name.trim(),
      url: form.url.trim(),
      imageUrl: form.imageUrl.trim(),
      price: form.price.trim(),
      memo: form.memo.trim(),
      rotation: randomRotation(),
    };
    const next = [item, ...items];
    setItems(next);
    saveItems(next);
    setForm({ name: '', url: '', imageUrl: '', price: '', memo: '' });
    setImagePreview('');
  };

  const deleteItem = (id: string) => {
    const next = items.filter(i => i.id !== id);
    setItems(next);
    saveItems(next);
  };

  const S = {
    sectionTitle: {
      fontFamily: "'Cormorant Garamond', serif",
      fontSize: '1.1rem',
      fontWeight: 300,
      color: gold,
      letterSpacing: '0.08em',
      textTransform: 'uppercase' as const,
      marginBottom: 16,
      paddingBottom: 8,
      borderBottom: `1px solid ${borderDefault}`,
    },
    formCard: {
      background: bgSurface,
      border: `1px solid ${borderDefault}`,
      padding: '20px',
      marginBottom: 32,
    },
    label: {
      fontFamily: "'Cormorant Garamond', serif",
      fontSize: '0.7rem',
      color: textMuted,
      letterSpacing: '0.08em',
      textTransform: 'uppercase' as const,
      marginBottom: 6,
      display: 'block',
    },
    input: {
      background: 'transparent',
      border: 'none',
      borderBottom: `1px solid ${borderDefault}`,
      color: textPrimary,
      fontFamily: "'Zen Kaku Gothic New', sans-serif",
      fontSize: '0.9rem',
      padding: '8px 4px',
      outline: 'none',
      width: '100%',
    },
    addBtn: {
      padding: '10px 28px',
      background: `linear-gradient(135deg, ${goldMuted}, #5A4D3A)`,
      border: 'none',
      color: '#0D0B08',
      fontFamily: "'Cormorant Garamond', serif",
      fontSize: '0.85rem',
      fontWeight: 600,
      letterSpacing: '0.1em',
      cursor: 'pointer',
      marginTop: 16,
    },
  };

  return (
    <div style={{ fontFamily: "'Zen Kaku Gothic New', sans-serif", paddingBottom: 40 }}>
      {/* Add form */}
      <div style={{ marginBottom: 32 }}>
        <div style={S.sectionTitle}>アイテムを追加</div>
        <div style={S.formCard}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 16, marginBottom: 16 }}>
            <div>
              <label style={S.label}>名前 *</label>
              <input
                type="text"
                style={S.input}
                placeholder="アイテム名"
                value={form.name}
                onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
              />
            </div>
            <div>
              <label style={S.label}>価格</label>
              <input
                type="text"
                style={S.input}
                placeholder="¥ 0"
                value={form.price}
                onChange={e => setForm(f => ({ ...f, price: e.target.value }))}
              />
            </div>
            <div>
              <label style={S.label}>商品URL</label>
              <input
                type="url"
                style={S.input}
                placeholder="https://..."
                value={form.url}
                onChange={e => setForm(f => ({ ...f, url: e.target.value }))}
              />
            </div>
            <div>
              <label style={S.label}>画像URL</label>
              <input
                type="url"
                style={S.input}
                placeholder="https://..."
                value={form.imageUrl}
                onChange={e => handleImageUrlChange(e.target.value)}
              />
            </div>
            <div style={{ gridColumn: '1 / -1' }}>
              <label style={S.label}>メモ</label>
              <input
                type="text"
                style={S.input}
                placeholder="任意"
                value={form.memo}
                onChange={e => setForm(f => ({ ...f, memo: e.target.value }))}
              />
            </div>
          </div>

          {/* Image preview */}
          {imagePreview && (
            <div style={{ marginBottom: 16 }}>
              <label style={S.label}>プレビュー</label>
              <div style={{
                display: 'inline-block',
                background: '#f5f0e8',
                padding: '12px 12px 44px 12px',
                boxShadow: '0 4px 20px rgba(0,0,0,0.35), 0 1px 4px rgba(0,0,0,0.2)',
                maxWidth: 140,
              }}>
                <img
                  src={imagePreview}
                  alt="preview"
                  style={{ width: '100%', aspectRatio: '1', objectFit: 'cover', display: 'block' }}
                  onError={() => setImagePreview('')}
                />
                <div style={{ fontFamily: "'Zen Kaku Gothic New', sans-serif", color: '#3a3a3a', fontSize: '0.75rem', textAlign: 'center', marginTop: 8 }}>
                  {form.name || 'アイテム名'}
                </div>
              </div>
            </div>
          )}

          <button style={S.addBtn} onClick={addItem}>
            追加
          </button>
        </div>
      </div>

      {/* Wish list grid */}
      <div style={S.sectionTitle}>ほしいものリスト ({items.length})</div>
      {items.length === 0 ? (
        <div style={{ color: textMuted, fontSize: '0.875rem', padding: '20px 0' }}>
          まだアイテムがありません
        </div>
      ) : (
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))',
          gap: 32,
          padding: '16px 8px',
        }}>
          {items.map((item, idx) => (
            <div key={item.id} style={{ position: 'relative' as const }}>
              {/* Polaroid */}
              <div
                style={{
                  background: '#f5f0e8',
                  padding: '12px 12px 44px 12px',
                  boxShadow: '0 4px 20px rgba(0,0,0,0.35), 0 1px 4px rgba(0,0,0,0.2)',
                  transform: `rotate(${item.rotation}deg)`,
                  transition: 'transform 0.3s, box-shadow 0.3s',
                  cursor: item.url ? 'pointer' : 'default',
                }}
                onMouseEnter={e => {
                  (e.currentTarget as HTMLElement).style.transform = 'scale(1.04) rotate(0deg)';
                  (e.currentTarget as HTMLElement).style.boxShadow = '0 8px 32px rgba(0,0,0,0.5)';
                }}
                onMouseLeave={e => {
                  (e.currentTarget as HTMLElement).style.transform = `rotate(${item.rotation}deg)`;
                  (e.currentTarget as HTMLElement).style.boxShadow = '0 4px 20px rgba(0,0,0,0.35), 0 1px 4px rgba(0,0,0,0.2)';
                }}
                onClick={() => {
                  if (item.url) window.open(item.url, '_blank', 'noopener,noreferrer');
                }}
              >
                {/* Image */}
                {item.imageUrl ? (
                  <img
                    src={item.imageUrl}
                    alt={item.name}
                    style={{ width: '100%', aspectRatio: '1', objectFit: 'cover', display: 'block' }}
                  />
                ) : (
                  <div style={{
                    width: '100%',
                    aspectRatio: '1',
                    background: '#d4cfc5',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: '#9a9080',
                    fontSize: '2rem',
                  }}>
                    🎁
                  </div>
                )}
                {/* Label */}
                <div style={{
                  fontFamily: "'Zen Kaku Gothic New', sans-serif",
                  color: '#3a3a3a',
                  fontSize: '0.8rem',
                  textAlign: 'center',
                  marginTop: 8,
                  lineHeight: 1.3,
                  wordBreak: 'break-word' as const,
                }}>
                  {item.name}
                </div>
                {item.price && (
                  <div style={{
                    fontFamily: "'Cormorant Garamond', serif",
                    color: '#6a6060',
                    fontSize: '0.75rem',
                    textAlign: 'center',
                    marginTop: 4,
                  }}>
                    {item.price}
                  </div>
                )}
              </div>

              {/* Delete button */}
              <button
                onClick={() => deleteItem(item.id)}
                style={{
                  position: 'absolute',
                  top: -8,
                  right: -8,
                  width: 24,
                  height: 24,
                  border: '1px solid rgba(232,92,82,0.4)',
                  background: '#0D0B08',
                  color: '#E85D4A',
                  cursor: 'pointer',
                  fontSize: '0.7rem',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  zIndex: 1,
                }}
              >
                ✕
              </button>

              {/* Memo */}
              {item.memo && (
                <div style={{
                  marginTop: 8,
                  fontSize: '0.72rem',
                  color: textMuted,
                  textAlign: 'center',
                  padding: '0 4px',
                }}>
                  {item.memo}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
