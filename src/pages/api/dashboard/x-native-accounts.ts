import { env as workerEnv } from 'cloudflare:workers';
import type { APIContext } from 'astro';
import { handleNativeXRead } from '../../../lib/security/native-x-read';

export const GET = (context: APIContext) =>
  handleNativeXRead(context, workerEnv as unknown as Parameters<typeof handleNativeXRead>[1]);
