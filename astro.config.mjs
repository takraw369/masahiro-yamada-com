import { defineConfig } from 'astro/config';
import cloudflare from '@astrojs/cloudflare';
import react from '@astrojs/react';

// react-dom/server.browser uses MessageChannel at init time which breaks
// Cloudflare Workers validation. Since all React components are client:only,
// SSR rendering of React is never needed — replace with a no-op stub.
const stubReactDomServer = {
  name: 'stub-react-dom-server',
  resolveId(id) {
    if (id === 'react-dom/server' || id === 'react-dom/server.browser') {
      return '\0react-dom-server-stub';
    }
  },
  load(id) {
    if (id === '\0react-dom-server-stub') {
      return `
export const renderToString = () => '';
export const renderToStaticMarkup = () => '';
export const renderToReadableStream = async () => {
  return new ReadableStream({ start(c) { c.close(); } });
};
export default { renderToString, renderToStaticMarkup, renderToReadableStream };
      `;
    }
  },
};

export default defineConfig({
  output: 'server',
  adapter: cloudflare({
    platformProxy: {
      enabled: true,
    },
  }),
  integrations: [react()],
  vite: {
    plugins: [stubReactDomServer],
  },
});
