const ACTIONS = Object.freeze({
  x: Object.freeze({
    'GET x-accounts': Object.freeze({ permission: 'harness:read', sideEffect: false, body: null }),
    'GET posts/scheduled': Object.freeze({ permission: 'harness:read', sideEffect: false, body: null }),
    'POST posts': Object.freeze({ permission: 'harness:write', sideEffect: true, body: 'xPost' }),
    'POST posts/schedule': Object.freeze({ permission: 'harness:write', sideEffect: true, body: 'xSchedule' }),
  }),
  line: Object.freeze({
    'GET line-accounts': Object.freeze({ permission: 'harness:read', sideEffect: false, body: null }),
    'POST broadcasts': Object.freeze({ permission: 'harness:write', sideEffect: true, body: 'lineBroadcast' }),
  }),
});

function isPlainObject(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function stringField(value, min, max) {
  return typeof value === 'string' && value.trim().length >= min && value.length <= max;
}

function validIdentifier(value) {
  return stringField(value, 1, 128) && /^[A-Za-z0-9_-]+$/u.test(value);
}

function validScheduleDate(value, nowMs = Date.now()) {
  if (!stringField(value, 10, 64)) return false;
  const timestamp = Date.parse(value);
  const maximum = nowMs + (366 * 24 * 60 * 60 * 1000);
  return Number.isFinite(timestamp) && timestamp > nowMs - 60_000 && timestamp <= maximum;
}

export function resolveHarnessAction(provider, method, rawPath) {
  if (!Object.hasOwn(ACTIONS, provider)) return null;
  const normalizedMethod = String(method).toUpperCase();
  const path = String(rawPath ?? '').replace(/^\/+|\/+$/gu, '');
  if (!path || path.includes('..') || !/^[A-Za-z0-9/_-]+$/u.test(path)) return null;
  const action = ACTIONS[provider][`${normalizedMethod} ${path}`];
  return action ? { ...action, provider, method: normalizedMethod, path } : null;
}

export function validateHarnessBody(kind, body, options = {}) {
  if (!isPlainObject(body)) return false;

  if (kind === 'xPost') {
    return validIdentifier(body.xAccountId)
      && stringField(body.text, 1, 280)
      && Object.keys(body).every((key) => ['xAccountId', 'text'].includes(key));
  }

  if (kind === 'xSchedule') {
    return validIdentifier(body.xAccountId)
      && stringField(body.text, 1, 280)
      && validScheduleDate(body.scheduledAt, options.nowMs)
      && Object.keys(body).every((key) => ['xAccountId', 'text', 'scheduledAt'].includes(key));
  }

  if (kind === 'lineBroadcast') {
    return validIdentifier(body.lineAccountId)
      && stringField(body.title, 1, 100)
      && body.messageType === 'text'
      && stringField(body.messageContent, 1, 5000)
      && body.targetType === 'all'
      && (body.scheduledAt === undefined || validScheduleDate(body.scheduledAt, options.nowMs))
      && Object.keys(body).every((key) => [
        'lineAccountId',
        'title',
        'messageType',
        'messageContent',
        'targetType',
        'scheduledAt',
      ].includes(key));
  }

  return false;
}

export function harnessProxyEnabled(env) {
  return env?.HARNESS_PROXY_ENABLED === 'true';
}

export function harnessSideEffectsEnabled(env) {
  return env?.HARNESS_SIDE_EFFECTS_ENABLED === 'true';
}

export function resolveHarnessBaseUrl(env, provider) {
  const raw = provider === 'x' ? env?.X_HARNESS_URL : env?.LINE_HARNESS_URL;
  try {
    const url = new URL(raw);
    if (url.protocol !== 'https:' || url.username || url.password || url.search || url.hash) return null;
    return url.origin;
  } catch {
    return null;
  }
}

export function resolveHarnessApiKey(env, provider) {
  const value = provider === 'x' ? env?.X_HARNESS_API_KEY : env?.LINE_HARNESS_API_KEY;
  return typeof value === 'string' && value.length >= 8 ? value : null;
}
