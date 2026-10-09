/** Client-only share intake. It never stores, publishes, or fetches the shared source. */
const CAPTURE_KEYS = ['capture', 'url', 'title', 'text'] as const;

export function readPlaygroundCapture(href: string) {
  const location = new URL(href);
  const fragment = new URLSearchParams(location.hash.slice(1));
  const params = fragment.get('capture') === '1' ? fragment : location.searchParams;
  if (params.get('capture') !== '1') return null;

  let warning = '';
  const bounded = (key: string, max: number) => {
    const raw = (params.get(key) || '').replace(/\u0000/g, '').trim();
    if (raw.length > max) warning = '長い入力は短くしました。保存前に確認してください。';
    return raw.slice(0, max);
  };
  const rawUrl = bounded('url', 2048);
  let sourceUrl = '';
  if (rawUrl) {
    try {
      const parsed = new URL(rawUrl);
      if (!['https:', 'http:'].includes(parsed.protocol) || parsed.username || parsed.password) throw new Error('unsafe_url');
      sourceUrl = parsed.href;
    } catch {
      warning = '参照URLを読み込めませんでした。HTTP(S)のURLを確認してください。';
    }
  }
  const excerpt = bounded('text', 4000);
  const title = bounded('title', 240) || (sourceUrl ? new URL(sourceUrl).hostname : excerpt.split('\n')[0].slice(0, 80));

  // Remove consumed input from the current browser-history entry before any outbound navigation.
  for (const key of CAPTURE_KEYS) location.searchParams.delete(key);
  if (params === fragment) {
    for (const key of CAPTURE_KEYS) fragment.delete(key);
    location.hash = fragment.toString();
  }
  return {
    fields: { title, url: sourceUrl, excerpt, collectionType: sourceUrl ? 'Source' : 'Insight' },
    warning,
    cleanPath: `${location.pathname}${location.search}${location.hash}`,
  };
}
