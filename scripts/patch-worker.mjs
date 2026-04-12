import { readFileSync, writeFileSync, existsSync } from 'fs';
import { join } from 'path';

const renderers = join(process.cwd(), 'dist/_worker.js/renderers.mjs');

if (!existsSync(renderers)) {
  console.log('renderers.mjs not found, skipping patch');
  process.exit(0);
}

const content = readFileSync(renderers, 'utf-8');

if (content.includes('__mc_polyfilled__')) {
  console.log('renderers.mjs already patched');
  process.exit(0);
}

// Minimal MessageChannel polyfill for Cloudflare Workers validation
const polyfill = `// __mc_polyfilled__
if (typeof MessageChannel === 'undefined') {
  globalThis.MessageChannel = class MessageChannel {
    constructor() {
      let h1, h2;
      this.port1 = {
        postMessage(d) { h2 && h2({ data: d }); },
        set onmessage(fn) { h1 = fn; },
        get onmessage() { return h1; },
      };
      this.port2 = {
        postMessage(d) { h1 && h1({ data: d }); },
        set onmessage(fn) { h2 = fn; },
        get onmessage() { return h2; },
      };
    }
  };
}
`;

writeFileSync(renderers, polyfill + content);
console.log('✓ Patched renderers.mjs with MessageChannel polyfill');
