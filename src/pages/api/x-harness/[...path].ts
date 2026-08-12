import type { APIContext } from 'astro';
import { handleHarnessProxy } from '../../../lib/security/harness-proxy.mjs';

export const ALL = (context: APIContext) => handleHarnessProxy('x', context);
