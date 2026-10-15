import { env } from 'cloudflare:workers';
import type { APIContext } from 'astro';
import { handleXOAuthStart, type XOAuthEnv } from '../../../../lib/security/x-oauth-read';
export const POST = (context: APIContext) => handleXOAuthStart(context, env as unknown as XOAuthEnv);
