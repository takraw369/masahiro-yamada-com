import type { APIContext } from 'astro';
import { env } from 'cloudflare:workers';
import { handleXOAuthConnectionAction, type XOAuthEnv } from '../../../../lib/security/x-oauth-read';
export const POST = (context: APIContext) => handleXOAuthConnectionAction(context, env as unknown as XOAuthEnv, 'disconnect');
