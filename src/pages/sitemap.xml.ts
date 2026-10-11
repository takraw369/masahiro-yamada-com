import type { APIRoute } from 'astro';
import { getCollection } from 'astro:content';
import { libraryItems } from '../lib/libraryCatalog';

const ORIGIN = 'https://masahiroyamada.com';

// Public pages intended for search. Keep private, noindex and redirect routes out.
const routes = [
  '/',
  '/library',
  '/tips',
  '/mental-check',
  '/trinity',
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

export const GET: APIRoute = async () => {
  const tips = await getCollection('tips', ({ data }) => data.publish !== false);
  const publicRoutes = [
    ...routes,
    ...libraryItems.map((item) => `/library/${item.slug}`),
    ...tips.map((tip) => `/tips/${tip.id}`),
  ];

  const urls = [...new Set(publicRoutes)]
    .map((route) => new URL(route, ORIGIN).toString())
    .sort()
    .map((url) => `  <url><loc>${escapeXml(url)}</loc></url>`)
    .join('\n');

  const body = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>\n`;

  return new Response(body, {
    headers: {
      'Content-Type': 'application/xml; charset=utf-8',
      'Cache-Control': 'public, max-age=3600',
    },
  });
};
