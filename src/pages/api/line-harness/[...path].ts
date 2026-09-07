import type { APIContext } from 'astro';
import { handleHarnessProxy } from '../../../lib/security/harness-proxy';

export const ALL = (context: APIContext) => handleHarnessProxy('line', context);
