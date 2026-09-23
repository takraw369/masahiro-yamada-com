import type { APIRoute } from 'astro';

const ORIGIN = 'https://masahiroyamada.com';

const routes = [
  '/',
  '/library',
  '/faq',
  '/contact',
  '/legal',
  '/legal/privacy',
  '/legal/terms',
  '/legal/tokushoho',
  '/legal/refund',
  '/legal/disclaimer',
  '/legal/confidentiality',
];

const escapeXml = (value: string) =>
  value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&apos;');

export const GET: APIRoute = () => {
  const urls = routes
    .map((route) => `  <url><loc>${escapeXml(new URL(route, ORIGIN).toString())}</loc></url>`)
    .join('\n');

  const body = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>\n`;

  return new Response(body, {
    headers: {
      'Content-Type': 'application/xml; charset=utf-8',
      'Cache-Control': 'public, max-age=3600',
    },
  });
};
