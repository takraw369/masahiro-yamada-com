import { env } from 'cloudflare:workers';
import type { APIContext } from 'astro';
import { handleXOAuthCallback, type XOAuthEnv } from '../../../../lib/security/x-oauth-read';
export const GET = (context: APIContext) => handleXOAuthCallback(context, env as unknown as XOAuthEnv);
