import { existsSync } from 'node:fs';
import { registerHooks } from 'node:module';

// Node-only dependency boundary: execute the real handlers with a fake Workers
// binding object. Never read process.env, dev vars, credentials or remote state.
export const env = {};
export const defineMiddleware = (handler) => handler;

registerHooks({
  resolve(specifier, context, nextResolve) {
    if (specifier === 'cloudflare:workers' || specifier === 'astro:middleware') {
      return { url: import.meta.url, shortCircuit: true };
    }
    if (specifier.startsWith('.') && context.parentURL) {
      const candidate = new URL(`${specifier}.ts`, context.parentURL);
      if (existsSync(candidate)) return nextResolve(candidate.href, context);
    }
    return nextResolve(specifier, context);
  },
});
