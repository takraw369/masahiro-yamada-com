import type { APIContext } from 'astro';

interface Env {
  X_HARNESS_URL: string;
  X_HARNESS_API_KEY: string;
}

export const ALL = async ({ params, request, locals }: APIContext) => {
  const env = locals.runtime?.env as Env | undefined;
  const baseUrl = env?.X_HARNESS_URL ?? 'https://x-harness-worker.takraw501.workers.dev';
  const apiKey = env?.X_HARNESS_API_KEY ?? '';

  const path = params.path ?? '';
  const url = new URL(request.url);
  const target = `${baseUrl}/api/${path}${url.search}`;

  const res = await fetch(target, {
    method: request.method,
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: ['GET', 'HEAD'].includes(request.method) ? undefined : await request.text(),
  });

  return new Response(res.body, {
    status: res.status,
    headers: { 'Content-Type': 'application/json' },
  });
};
