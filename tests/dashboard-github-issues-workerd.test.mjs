import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

// Use the runtime and bundler already owned by the installed Wrangler dependency.
const require = createRequire(import.meta.url);
const wranglerRequire = createRequire(require.resolve('wrangler/package.json'));
const { build } = wranglerRequire('esbuild');
const miniflare = wranglerRequire('miniflare');
const { Miniflare, Log, LogLevel } = miniflare;

test('real Workboard API reads both repos in workerd and never follows credential-bearing redirects', { timeout: 30000 }, async () => {
  const { outputFiles } = await build({
    stdin: { resolveDir: fileURLToPath(new URL('..', import.meta.url)), contents:
      "import { GET } from './src/pages/api/dashboard/github-issues.ts'; export default { fetch() { return GET({}); } };" },
    bundle: true, write: false, format: 'esm', platform: 'browser', target: 'es2022', external: ['cloudflare:*'],
  });
  for (const redirect of [false, true]) {
    const calls = [];
    const options = {
      modules: true, compatibilityDate: '2024-12-01', script: outputFiles[0].text,
      bindings: { GITHUB_ISSUES_READ_TOKEN: 'PRIVATE_FIXTURE_TOKEN' }, log: new Log(LogLevel.NONE),
      outboundService: async (request) => {
        const url = new URL(request.url);
        calls.push({ origin: url.origin, path: url.pathname });
        assert.equal(url.origin, 'https://api.github.com');
        assert.equal(request.method, 'GET');
        assert.equal(request.headers.get('Authorization'), 'Bearer PRIVATE_FIXTURE_TOKEN');
        if (redirect) return new Response(null, { status: 307, headers: { Location: 'https://attacker.fixture.invalid/' } });
        if (url.pathname.endsWith('/issues')) return Response.json([]);
        if (url.pathname.endsWith('/pulls')) return Response.json([{ number: 1, head: { sha: 'fixture-head' }, state: 'open' }]);
        if (url.pathname.endsWith('/actions/runs')) return Response.json({ workflow_runs: [{ id: 10,
          name: url.pathname.includes('/masa-automation/') ? 'Flow Runner CI' : 'CI',
          head_sha: 'fixture-head', status: 'completed', conclusion: 'success' }] });
        throw Error('unexpected fixture path');
      },
    };
    const runtime = new Miniflare(miniflare.convertV4MiniflareOptions?.(options) ?? options);
    try {
      const response = await runtime.dispatchFetch('https://dashboard.fixture.invalid/api/dashboard/github-issues');
      const result = await response.json();
      assert.equal(response.headers.get('Cache-Control'), 'no-store, max-age=0');
      assert.equal(result.ok, true);
      assert.equal(result.repos.length, 2);
      assert.equal(calls.length, 6, 'each configured endpoint is fetched once, with no redirect/retry');
      assert.equal(JSON.stringify(result).includes('PRIVATE_FIXTURE_TOKEN'), false);
      for (const repo of result.repos) {
        assert.equal(repo.access, redirect ? 'unavailable' : 'connected');
        if (!redirect) assert.equal(repo.pulls[0].ci?.conclusion, 'success');
      }
    } finally { await runtime.dispose(); }
  }
});
