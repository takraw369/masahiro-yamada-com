import type { APIRoute } from 'astro';
import { getSiteStorageEnv, supabaseRpc } from '../../lib/siteStorage';

export const prerender = false;

type LinkResolution = {
  destination_url: string;
  link_id: string;
  publication_id: string | null;
  asset_id: string | null;
  campaign_ref: string | null;
  source_channel: string | null;
  placement: string | null;
  cta_stage: string | null;
};

const OWNED_HOSTS = new Set(['masahiroyamada.com', 'www.masahiroyamada.com']);

const notFound = () =>
  new Response('Not found', {
    status: 404,
    headers: {
      'Cache-Control': 'no-store',
      'Content-Type': 'text/plain; charset=utf-8',
      'X-Robots-Tag': 'noindex, nofollow',
    },
  });

const sanitizeReferrer = (request: Request) => {
  const raw = request.headers.get('referer');
  if (!raw) return null;
  try {
    const parsed = new URL(raw);
    return `${parsed.origin}${parsed.pathname}`.slice(0, 500);
  } catch {
    return null;
  }
};

const classifyUserAgent = (request: Request) => {
  const ua = (request.headers.get('user-agent') || '').toLowerCase();
  if (!ua) return 'unknown';
  if (/bot|crawler|spider|slurp|preview|facebookexternalhit|twitterbot|linkedinbot/.test(ua)) return 'bot';
  if (/mobile|iphone|ipad|android/.test(ua)) return 'mobile';
  return 'desktop';
};

const requestId = (request: Request) => {
  const cfRay = request.headers.get('cf-ray')?.trim();
  if (cfRay) return cfRay.slice(0, 160);
  return crypto.randomUUID();
};

const withOwnedAttribution = (destination: URL, resolved: LinkResolution, slug: string) => {
  if (!OWNED_HOSTS.has(destination.hostname.toLowerCase())) return destination;

  const source = (resolved.source_channel || 'note').trim().slice(0, 80) || 'note';
  const campaign = (resolved.campaign_ref || `nh-${slug}`).trim().slice(0, 120);

  if (!destination.searchParams.has('utm_source')) destination.searchParams.set('utm_source', source);
  if (!destination.searchParams.has('utm_medium')) destination.searchParams.set('utm_medium', 'tracked_link');
  if (!destination.searchParams.has('utm_campaign')) destination.searchParams.set('utm_campaign', campaign);
  if (resolved.placement && !destination.searchParams.has('utm_content')) {
    destination.searchParams.set('utm_content', resolved.placement.slice(0, 120));
  }

  return destination;
};

export const GET: APIRoute = async ({ params, request, locals }) => {
  const slug = String(params.slug || '').trim().toLowerCase();
  if (!/^[a-z0-9][a-z0-9-]{1,79}$/.test(slug)) return notFound();

  const env = getSiteStorageEnv(locals);

  try {
    const rows = await supabaseRpc<LinkResolution[]>(env, 'resolve_tracked_link_v1', {
      p_slug: slug,
      p_request_id: requestId(request),
      p_referrer_path: sanitizeReferrer(request),
      p_user_agent_class: classifyUserAgent(request),
    });

    const resolved = Array.isArray(rows) ? rows[0] : null;
    if (!resolved?.destination_url) return notFound();

    let destination: URL;
    try {
      destination = new URL(resolved.destination_url);
    } catch {
      console.error('tracked_link_invalid_destination', resolved.link_id || slug);
      return notFound();
    }

    if (destination.protocol !== 'https:') {
      console.error('tracked_link_non_https_destination', resolved.link_id || slug);
      return notFound();
    }

    destination = withOwnedAttribution(destination, resolved, slug);

    return new Response(null, {
      status: 302,
      headers: {
        Location: destination.toString(),
        'Cache-Control': 'no-store, max-age=0',
        'Referrer-Policy': 'strict-origin-when-cross-origin',
        'X-Robots-Tag': 'noindex, nofollow',
      },
    });
  } catch (error) {
    console.error(
      'tracked_link_resolution_failed',
      error instanceof Error ? error.message.slice(0, 240) : 'unknown',
    );
    return new Response('Service unavailable', {
      status: 503,
      headers: {
        'Cache-Control': 'no-store',
        'Content-Type': 'text/plain; charset=utf-8',
        'Retry-After': '60',
        'X-Robots-Tag': 'noindex, nofollow',
      },
    });
  }
};
