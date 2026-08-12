import type { APIContext } from 'astro';
import {
  DEVELOPMENT_COOKIE_NAME,
  LEGACY_COOKIE_NAME,
  PRODUCTION_COOKIE_NAME,
} from '../../lib/security/auth.mjs';

export const GET = ({ cookies, redirect }: APIContext) => {
  for (const cookieName of [
    PRODUCTION_COOKIE_NAME,
    DEVELOPMENT_COOKIE_NAME,
    LEGACY_COOKIE_NAME,
  ]) {
    cookies.delete(cookieName, { path: '/' });
  }
  cookies.delete(LEGACY_COOKIE_NAME, { path: '/dashboard' });
  return redirect('/dashboard/login', 302);
};
