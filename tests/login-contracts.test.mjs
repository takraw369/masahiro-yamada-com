import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';
import { env } from './helpers/worker-runtime.mjs';

const source = readFileSync(new URL('../src/pages/dashboard/login.astro', import.meta.url), 'utf8');
const scripts = [...source.matchAll(/<script is:inline>([\s\S]*?)<\/script>/g)].map((match) => match[1]);
const origin = 'https://dashboard.example.test';
const secret = 'test-only-worker-signing-secret';
const accessToken = 'test-only-browser-access-token';
const newPassword = 'test-only-new-password';

test.beforeEach(() => {
  for (const name of Object.keys(env)) delete env[name];
  Object.assign(env, { DASHBOARD_PASSWORD: secret, SUPABASE_URL: 'https://supabase.example.test', SUPABASE_PUBLISHABLE_KEY: 'test-only-publishable-key' });
});

function browser({ hash = '', intent, fetch = () => { throw new Error('unexpected live request'); } } = {}) {
  const nodes = new Map();
  for (const id of ['auth-card', 'google-login', 'password-recovery', 'login-panel', 'reset-panel', 'oauth-message', 'reset-submit', 'new-password', 'confirm-password']) {
    nodes.set(id, { hidden: id === 'reset-panel' || id === 'oauth-message', disabled: false, dataset: { supabaseUrl: env.SUPABASE_URL }, value: '', events: {}, addEventListener(name, handler) { this.events[name] = handler; } });
  }
  const classes = new Set();
  const items = new Map(intent ? [['masa.dashboard.oauth.intent', intent]] : []);
  const history = [];
  const navigation = [];
  const window = {
    location: { hash, pathname: '/dashboard/login', origin, assign: (url) => navigation.push(['assign', url]), replace: (url) => navigation.push(['replace', url]) },
    history: { replaceState: (...args) => { history.push(args); window.location.hash = ''; } },
  };
  const sandbox = vm.createContext({
    window, URL, URLSearchParams, fetch,
    document: { getElementById: (id) => nodes.get(id), documentElement: { classList: { add: (name) => classes.add(name), remove: (name) => classes.delete(name) } } },
    sessionStorage: { setItem: (key, value) => items.set(key, value), getItem: (key) => items.get(key), removeItem: (key) => items.delete(key) },
  });
  vm.runInContext(scripts[0], sandbox);
  const wasPending = classes.has('oauth-callback-pending');
  // Observe the existing invocation; don't replace callback implementation.
  vm.runInContext(scripts[1].replace('void processGoogleCallback();', 'globalThis.callbackPromise = processGoogleCallback();'), sandbox);
  return { nodes, classes, items, history, navigation, window, wasPending, done: sandbox.callbackPromise };
}

test('Google/recovery entry preserves intent and redirects only to this origin callback', async () => {
  for (const [id, intent] of [['google-login', 'login'], ['password-recovery', 'reset']]) {
    const page = browser();
    await page.done;
    page.nodes.get(id).events.click();
    assert.equal(page.items.get('masa.dashboard.oauth.intent'), intent);
    const url = new URL(page.navigation[0][1]);
    assert.equal(url.origin, 'https://supabase.example.test');
    assert.equal(url.searchParams.get('provider'), 'google');
    assert.equal(url.searchParams.get('redirect_to'), `${origin}/dashboard/login`);
  }
});

test('T0057 callback success keeps the card concealed, removes tokens from the URL and goes directly to Dashboard', async () => {
  let calls = 0;
  const page = browser({ hash: `#access_token=${accessToken}&refresh_token=test-only-refresh`, intent: 'login', fetch: async (url, options) => {
    calls++;
    assert.equal(url, '/api/dashboard/google-login');
    assert.equal(options.method, 'POST');
    assert.equal(options.headers.Authorization, `Bearer ${accessToken}`);
    return Response.json({ ok: true });
  } });
  await page.done;
  assert.equal(page.wasPending, true);
  assert.equal(page.classes.has('oauth-callback-pending'), true);
  assert.equal(page.window.location.hash, '');
  assert.equal(page.history[0][2], '/dashboard/login');
  assert.deepEqual(page.navigation, [['replace', '/dashboard']]);
  assert.equal(page.items.size, 0);
  assert.equal(calls, 1);
});

test('callback OAuth rejection/non-admin/network failure restores a visible actionable login screen', async () => {
  for (const options of [
    { hash: '#error=access_denied' },
    { hash: `#access_token=${accessToken}`, fetch: async () => Response.json({ ok: false }, { status: 403 }) },
    { hash: `#access_token=${accessToken}`, fetch: async () => { throw new Error('offline'); } },
  ]) {
    const page = browser(options);
    await page.done;
    assert.equal(page.classes.has('oauth-callback-pending'), false);
    assert.equal(page.nodes.get('oauth-message').hidden, false);
    assert.equal(page.nodes.get('oauth-message').className, 'error');
    assert.equal(page.navigation.length, 0);
    assert.equal(page.window.location.hash, '');
  }
});

test('recovery carries Bearer only in memory, validates confirmation, and submits the password once', async () => {
  let calls = 0;
  const page = browser({ hash: `#access_token=${accessToken}`, intent: 'reset', fetch: async (url, options) => {
    calls++;
    assert.equal(url, '/api/dashboard/reset-password');
    assert.equal(options.headers.Authorization, `Bearer ${accessToken}`);
    assert.deepEqual(JSON.parse(options.body), { password: newPassword });
    return Response.json({ ok: true });
  } });
  await page.done;
  assert.equal(calls, 0);
  assert.equal(page.nodes.get('reset-panel').hidden, false);
  assert.equal(page.items.size, 0);
  const submit = () => page.nodes.get('reset-panel').events.submit({ preventDefault() {} });
  await submit();
  page.nodes.get('new-password').value = newPassword;
  await submit();
  assert.equal(calls, 0);
  page.nodes.get('confirm-password').value = newPassword;
  await submit();
  assert.equal(calls, 1);
  assert.deepEqual(page.navigation, [['replace', '/dashboard']]);
  await submit();
  assert.equal(calls, 1);
});

test('recovery network failure restores submit control and requires fresh Google verification', async () => {
  let calls = 0;
  const page = browser({ hash: `#access_token=${accessToken}`, intent: 'reset', fetch: async () => { calls++; throw new Error('offline'); } });
  await page.done;
  page.nodes.get('new-password').value = newPassword;
  page.nodes.get('confirm-password').value = newPassword;
  const submit = () => page.nodes.get('reset-panel').events.submit({ preventDefault() {} });
  await submit();
  assert.equal(page.nodes.get('reset-submit').disabled, false);
  assert.equal(page.nodes.get('oauth-message').className, 'error');
  assert.equal(page.navigation.length, 0);
  await submit();
  assert.equal(calls, 1);
});
