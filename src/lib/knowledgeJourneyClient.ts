type JourneyContext = {
  visitorId: string;
  sessionId: string;
  source: string | null;
  medium: string | null;
  campaign: string | null;
  referrer: string | null;
  assetSlug: string | null;
  path: string;
};

const VISITOR_KEY = 'masa_ks_visitor_id';
const SESSION_KEY = 'masa_ks_session_id';
const ATTRIBUTION_KEY = 'masa_ks_attribution';

const safeStorage = (kind: 'local' | 'session') => {
  try {
    return kind === 'local' ? window.localStorage : window.sessionStorage;
  } catch {
    return null;
  }
};

const randomId = () => {
  try {
    return crypto.randomUUID().replace(/-/g, '');
  } catch {
    return `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 18)}`;
  }
};

const getOrCreate = (kind: 'local' | 'session', key: string) => {
  const storage = safeStorage(kind);
  const existing = storage?.getItem(key)?.trim();
  if (existing && /^[A-Za-z0-9_-]{8,80}$/.test(existing)) return existing;
  const value = randomId();
  try { storage?.setItem(key, value); } catch {}
  return value;
};

const readAttribution = () => {
  const session = safeStorage('session');
  const params = new URLSearchParams(window.location.search);
  const incoming = {
    source: params.get('utm_source')?.slice(0, 80) || null,
    medium: params.get('utm_medium')?.slice(0, 80) || null,
    campaign: params.get('utm_campaign')?.slice(0, 120) || null,
  };
  if (incoming.source || incoming.medium || incoming.campaign) {
    try { session?.setItem(ATTRIBUTION_KEY, JSON.stringify(incoming)); } catch {}
    return incoming;
  }
  try {
    const parsed = JSON.parse(session?.getItem(ATTRIBUTION_KEY) || '{}');
    return {
      source: typeof parsed.source === 'string' ? parsed.source.slice(0, 80) : null,
      medium: typeof parsed.medium === 'string' ? parsed.medium.slice(0, 80) : null,
      campaign: typeof parsed.campaign === 'string' ? parsed.campaign.slice(0, 120) : null,
    };
  } catch {
    return incoming;
  }
};

const assetFromPath = (path: string) => {
  const match = path.match(/^\/library\/([a-z0-9-]{2,100})\/?$/);
  return match?.[1] || null;
};

export const getKnowledgeJourneyContext = (): JourneyContext => {
  const path = window.location.pathname;
  const attribution = readAttribution();
  return {
    visitorId: getOrCreate('local', VISITOR_KEY),
    sessionId: getOrCreate('session', SESSION_KEY),
    source: attribution.source,
    medium: attribution.medium,
    campaign: attribution.campaign,
    referrer: document.referrer ? document.referrer.slice(0, 500) : null,
    assetSlug: assetFromPath(path),
    path,
  };
};

export const trackKnowledgeJourney = async (
  event: string,
  meta: Record<string, string | number | boolean | null> = {},
) => {
  const context = getKnowledgeJourneyContext();
  try {
    await fetch('/api/library/journey', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      keepalive: true,
      body: JSON.stringify({ ...context, event, meta }),
    });
  } catch {
    // Analytics must never block the public learning experience.
  }
};

export const initKnowledgeJourney = () => {
  if (!window.location.pathname.startsWith('/library')) return;
  const context = getKnowledgeJourneyContext();
  const firstEvent = context.assetSlug ? 'ks_item_view' : 'ks_shelf_view';
  void trackKnowledgeJourney(firstEvent);

  let sent30 = false;
  let sent120 = false;
  window.setTimeout(() => {
    if (!document.hidden && !sent30) {
      sent30 = true;
      void trackKnowledgeJourney('ks_engaged_30s');
    }
  }, 30_000);
  window.setTimeout(() => {
    if (!document.hidden && !sent120) {
      sent120 = true;
      void trackKnowledgeJourney('ks_engaged_120s');
    }
  }, 120_000);

  let sent50 = false;
  let sent90 = false;
  const onScroll = () => {
    const max = Math.max(1, document.documentElement.scrollHeight - window.innerHeight);
    const ratio = window.scrollY / max;
    if (ratio >= 0.5 && !sent50) {
      sent50 = true;
      void trackKnowledgeJourney('ks_scroll_50');
    }
    if (ratio >= 0.9 && !sent90) {
      sent90 = true;
      void trackKnowledgeJourney('ks_scroll_90');
      window.removeEventListener('scroll', onScroll);
    }
  };
  window.addEventListener('scroll', onScroll, { passive: true });

  document.addEventListener('click', (event) => {
    const target = event.target instanceof Element ? event.target.closest('a,button') : null;
    if (!target) return;
    const href = target instanceof HTMLAnchorElement ? target.getAttribute('href') || '' : '';
    const label = (target.textContent || '').trim().replace(/\s+/g, ' ').slice(0, 120);
    if (href.startsWith('/library/')) {
      void trackKnowledgeJourney('ks_asset_click', { href: href.slice(0, 200), label });
      return;
    }
    if (target.closest('[data-library-lead]')) return;
    if (href || target instanceof HTMLButtonElement) {
      void trackKnowledgeJourney('ks_cta_click', { href: href.slice(0, 200), label });
    }
  });
};
