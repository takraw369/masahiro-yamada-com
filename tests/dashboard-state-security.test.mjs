import assert from 'node:assert/strict';
import test from 'node:test';

import {
  handleDashboardStateGet,
  handleDashboardStatePost,
} from '../src/lib/dashboard/state.mjs';

const reader = Object.freeze({ sub: 'masa', permissions: ['dashboard:read'] });
const operator = Object.freeze({
  sub: 'masa',
  permissions: ['dashboard:read', 'dashboard:write'],
});

test('dashboard state fails closed when the DB binding is absent', async () => {
  const getResponse = await handleDashboardStateGet({ session: reader, env: {} });
  assert.equal(getResponse.status, 503);
  assert.deepEqual(await getResponse.json(), { error: 'database_unavailable' });

  const postResponse = await handleDashboardStatePost({
    request: new Request('https://example.test/api/dashboard/state', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ slotId: 'week-1:day-1', checked: true, xp: 10 }),
    }),
    session: operator,
    env: {},
  });
  assert.equal(postResponse.status, 503);
  assert.deepEqual(await postResponse.json(), { error: 'database_unavailable' });
});

test('dashboard state never queries DB before authorization', async () => {
  let prepareCalled = false;
  const env = {
    DB: {
      prepare() {
        prepareCalled = true;
        throw new Error('must not query');
      },
    },
  };

  const response = await handleDashboardStateGet({ session: null, env });
  assert.equal(response.status, 401);
  assert.equal(prepareCalled, false);
});
