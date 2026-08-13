import type { APIContext } from 'astro';
import {
  handleDashboardStateGet,
  handleDashboardStatePost,
} from '../../../lib/dashboard/state.mjs';

interface SecuritySession {
  sub: string;
  permissions: string[];
}

function sessionFrom(locals: APIContext['locals']) {
  return (locals as unknown as { securitySession?: SecuritySession }).securitySession;
}

function envFrom(locals: APIContext['locals']) {
  return (locals as unknown as { securityEnv?: Cloudflare.Env }).securityEnv;
}

export const GET = ({ locals }: APIContext) => handleDashboardStateGet({
  session: sessionFrom(locals),
  env: envFrom(locals),
});

export const POST = ({ request, locals }: APIContext) => handleDashboardStatePost({
  request,
  session: sessionFrom(locals),
  env: envFrom(locals),
});
