import assert from 'node:assert/strict';
import test from 'node:test';
import { env } from './helpers/worker-runtime.mjs';
import { parseXUnderTheHoodReport } from '../src/lib/xHealth.ts';

const xHealthApi = await import('../src/pages/api/dashboard/x-health.ts');
const origin = 'https://dashboard.example.test';

test.beforeEach(() => {
  for (const key of Object.keys(env)) delete env[key];
  Object.assign(env, {
    DASHBOARD_PASSWORD: 'test-x-health-secret',
    SUPABASE_URL: 'https://supabase.example.test',
    SUPABASE_PUBLISHABLE_KEY: 'test-only-key',
  });
});

test('parses the current official Under the Hood JSON shape', () => {
  const parsed = parseXUnderTheHoodReport({
    notes: 'best effort transparency report',
    period: { startDate: '2026-07-01', endDate: '2026-07-31', timezone: 'UTC' },
    generatedAt: '2026-08-08T23:59:59Z',
    postCount: '982',
    postLabels: [
      {
        label: 'NSFW_HIGH_RECALL',
        about: 'Post detected by automated systems',
        effect: 'Post may be hidden from recommendations to non-followers.',
        posts: 16,
        totalPostsInMonth: 982,
        percentageOfPosts: '1.62%',
      },
      {
        label: 'Court order [JP]',
        about: 'Visibility limited to comply with law in a country.',
        effect: 'Post withheld in country JP.',
        posts: 1,
        totalPostsInMonth: 982,
        percentageOfPosts: '0.10%',
      },
    ],
    accountLabels: [
      {
        label: 'NsfwHighRecall',
        about: 'Account label',
        effect: 'The account’s posts are hidden from recommendations to non-followers.',
        days: 16,
        daysInPeriod: 31,
        percentageOfDays: '51.61%',
      },
    ],
  });

  assert.equal(parsed.reportMonth, '2026-07');
  assert.equal(parsed.postCount, 982);
  assert.equal(parsed.postLabelCount, 17);
  assert.equal(parsed.accountLabelDays, 16);
  assert.equal(parsed.legalRestrictionCount, 1);
  assert.equal(parsed.labels.length, 3);
  assert.equal(parsed.labels[1].legal, true);
});

test('unwraps reportJson when the GraphQL envelope is pasted', () => {
  const parsed = parseXUnderTheHoodReport({
    reportJson: JSON.stringify({
      period: { startDate: '2026-08-01', endDate: '2026-08-31', timezone: 'UTC' },
      postCount: '17',
      postLabels: [],
      accountLabels: [],
      totalPostLabels: 0,
      totalAccountLabels: 0,
    }),
  });

  assert.equal(parsed.reportMonth, '2026-08');
  assert.equal(parsed.postCount, 17);
  assert.equal(parsed.postLabelCount, 0);
  assert.equal(parsed.accountLabelDays, 0);
});

test('rejects empty and incomplete reports instead of treating them as zero-label months', () => {
  assert.throws(() => parseXUnderTheHoodReport({}), /対象月/);
  assert.throws(() => parseXUnderTheHoodReport({
    period: { startDate: '2026-08-01', endDate: '2026-08-31' },
    postCount: '120',
  }), /ラベル一覧/);
  assert.throws(() => parseXUnderTheHoodReport({
    period: { startDate: '2026-08-01', endDate: '2026-09-01' },
    postCount: '120', postLabels: [], accountLabels: [],
  }), /対象月/);
});

test('GET maps the Supabase X Health read model', async (t) => {
  t.mock.method(globalThis, 'fetch', async (url, init) => {
    assert.ok(String(url).endsWith('/rest/v1/rpc/masa_x_health_reports_get_v1'));
    assert.equal(init?.method, 'POST');
    return Response.json([
      {
        account_id: 'acct-1',
        username: 'masa',
        report_month: '2026-08',
        post_count: 120,
        post_label_count: 2,
        account_label_days: 0,
        legal_restriction_count: 0,
        labels: [],
        raw_report: { postCount: '120' },
        imported_at: '2026-09-23T00:00:00Z',
        updated_at: '2026-09-23T00:00:00Z',
      },
    ]);
  });

  const response = await xHealthApi.GET({ locals: {} });
  assert.equal(response.status, 200);
  const body = await response.json();
  assert.equal(body.ok, true);
  assert.equal(body.reports.length, 1);
  assert.equal(body.reports[0].accountId, 'acct-1');
  assert.equal(body.reports[0].reportMonth, '2026-08');
  assert.equal(body.reports[0].postLabelCount, 2);
});

test('POST validates and persists a normalized monthly report', async (t) => {
  const rawReport = {
    period: { startDate: '2026-08-01', endDate: '2026-08-31' },
    postCount: '120',
    postLabels: [{ label: 'NSFW_HIGH_RECALL', posts: 2, totalPostsInMonth: 120 }],
    accountLabels: [],
  };
  const normalized = parseXUnderTheHoodReport(rawReport);
  t.mock.method(globalThis, 'fetch', async (url, init) => {
    assert.ok(String(url).endsWith('/rest/v1/rpc/masa_x_health_report_upsert_v1'));
    assert.equal(init?.method, 'POST');
    const payload = JSON.parse(String(init?.body));
    assert.equal(payload.p_account_id, 'acct-1');
    assert.equal(payload.p_report_month, '2026-08');
    assert.equal(payload.p_post_count, 120);
    assert.equal(payload.p_post_label_count, 2);
    return Response.json(true);
  });

  const response = await xHealthApi.POST({
    request: new Request(`${origin}/api/dashboard/x-health`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        accountId: 'acct-1',
        username: '@masa',
        reportMonth: '2026-08',
        postCount: 120,
        postLabelCount: 2,
        accountLabelDays: 0,
        legalRestrictionCount: 0,
        labels: normalized.labels,
        rawReport,
      }),
    }),
    locals: {},
  });

  assert.equal(response.status, 200);
  const body = await response.json();
  assert.equal(body.ok, true);
});

test('POST rejects malformed report months before storage', async () => {
  const response = await xHealthApi.POST({
    request: new Request(`${origin}/api/dashboard/x-health`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        accountId: 'acct-1',
        username: 'masa',
        reportMonth: '2026-13',
        postCount: 1,
        postLabelCount: 0,
        accountLabelDays: 0,
        legalRestrictionCount: 0,
        labels: [],
        rawReport: {},
      }),
    }),
    locals: {},
  });

  assert.equal(response.status, 400);
  const body = await response.json();
  assert.equal(body.error, 'invalid_x_health_report');
});

test('POST rejects a fabricated empty report before calling storage', async (t) => {
  t.mock.method(globalThis, 'fetch', async () => { throw new Error('storage should not be called'); });
  const response = await xHealthApi.POST({
    request: new Request(`${origin}/api/dashboard/x-health`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        accountId: 'acct-1', username: 'masa', reportMonth: '2026-08',
        postCount: 0, postLabelCount: 0, accountLabelDays: 0,
        legalRestrictionCount: 0, labels: [], rawReport: {},
      }),
    }),
    locals: {},
  });
  assert.equal(response.status, 400);
  assert.equal((await response.json()).error, 'invalid_x_health_report');
});
