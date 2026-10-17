const base = location.pathname.replace(/\/$/, '');
const el = id => document.getElementById(id);
let offset = 0;
let total = 0;
const limit = 48;
let loadSequence = 0;
const bytes = n => n >= 1e9 ? (n / 1e9).toFixed(1) + ' GB' : n >= 1e6 ? (n / 1e6).toFixed(1) + ' MB' : (n / 1e3).toFixed(0) + ' KB';
const add = (parent, tag, value, cls) => { const node = document.createElement(tag); if (cls) node.className = cls; node.textContent = String(value ?? ''); parent.append(node); return node; };
async function fetchJSON(p) { const res = await fetch(base + p, { cache: 'no-store' }); if (!res.ok) throw new Error('HTTP ' + res.status); return res.json(); }
function showStats(s) {
  const stats = el('stats'); stats.replaceChildren();
  for (const [label, value] of [['総素材', s.count.toLocaleString('ja-JP')], ['画像', s.kinds.photo.toLocaleString('ja-JP')], ['動画', s.kinds.video.toLocaleString('ja-JP')], ['合計', bytes(s.totalBytes)]]) {
    const node = add(stats, 'div', '', 'stat'); add(node, 'strong', value); add(node, 'span', label);
  }
}
function card(item) {
  const article = document.createElement('article'); article.className = 'asset';
  const media = add(article, 'div', '', 'preview');
  if (item.kind === 'video') {
    const trigger = add(media, 'button', '▶ 動画をプレビュー', 'play');
    trigger.type = 'button'; trigger.addEventListener('click', () => {
      const video = document.createElement('video'); video.controls = true; video.preload = 'metadata'; video.src = base + '/media/' + item.id; media.replaceChildren(video);
    });
  } else {
    const img = document.createElement('img'); img.loading = 'lazy'; img.alt = ''; img.src = base + '/media/' + item.id;
    img.addEventListener('error', () => { const fallback = document.createElement('div'); add(fallback, 'span', 'プレビュー非対応'); img.replaceWith(fallback); });
    media.append(img);
  }
  const content = add(article, 'div', '', 'details');
  const tags = add(content, 'div', '', 'tags');
  add(tags, 'span', item.category === 'UNSORTED' ? '未分類' : item.category, 'tag');
  if (item.duplicateStatus !== 'none') add(tags, 'span', item.duplicateStatus === 'sha256-identical' ? '同一データ確認' : '同サイズ・未確認', 'tag alert');
  add(content, 'h4', item.filename);
  add(content, 'p', item.relativePath, 'path');
  add(content, 'p', item.takenAt.slice(0, 10) + ' · ' + bytes(item.bytes) + ' · ' + (item.dateSource === 'file-mtime' ? '日付:ファイル更新日時' : '日付:Takeout'), 'meta');
  if (item.sourceUrl) {
    const a = add(content, 'a', 'Googleフォトで開く（URL未検証） ↗', 'link');
    a.href = item.sourceUrl; a.target = '_blank'; a.rel = 'noreferrer noopener';
  }
  return article;
}
async function load() {
  const seq = ++loadSequence;
  const p = new URLSearchParams({ offset: String(offset), limit: String(limit) });
  if (el('search').value.trim()) p.set('q', el('search').value.trim());
  if (el('category').value) p.set('category', el('category').value);
  if (el('kind').value) p.set('kind', el('kind').value);
  if (el('duplicates').checked) p.set('duplicates', '1');
  try {
    const data = await fetchJSON('/api/items?' + p);
    if (seq !== loadSequence) return;
    total = data.total; const gal = el('gallery'); gal.replaceChildren();
    if (!data.items.length) add(gal, 'p', '条件に一致する素材がありません。', 'empty');
    else gal.append(...data.items.map(card));
    el('count').textContent = total.toLocaleString('ja-JP') + ' 件';
    el('page').textContent = total ? (offset + 1) + '–' + Math.min(offset + limit, total) + ' / ' + total : '0 / 0';
    el('previous').disabled = offset === 0;
    el('next').disabled = offset + limit >= total;
  } catch (e) { el('gallery').textContent = '読み込みに失敗しました: ' + e.message; }
}
let debounce;
el('search').addEventListener('input', () => { clearTimeout(debounce); debounce = setTimeout(() => { offset = 0; load(); }, 250); });
for (const id of ['category', 'kind', 'duplicates']) el(id).addEventListener('change', () => { offset = 0; load(); });
el('previous').addEventListener('click', () => { offset = Math.max(0, offset - limit); load(); });
el('next').addEventListener('click', () => { if (offset + limit < total) { offset += limit; load(); } });
fetchJSON('/api/summary').then(data => showStats(data.summary)).catch(() => { el('stats').textContent = '概要を取得できませんでした'; });
load();
