const ACTIONS = Object.freeze({
  x: Object.freeze({
    'GET x-accounts': Object.freeze({ permission: 'harness:read', sideEffect: false, body: null }),
    'GET posts/scheduled': Object.freeze({ permission: 'harness:read', sideEffect: false, body: null }),
    'POST posts': Object.freeze({ permission: 'harness:write', sideEffect: true, body: 'xPost' }),
    'POST posts/schedule': Object.freeze({ permission: 'harness:write', sideEffect: true, body: 'xSchedule' }),
  }),
  line: Object.freeze({
    'GET line-accounts': Object.freeze({ permission: 'harness:read', sideEffect: false, body: null }),
    'GET tags': Object.freeze({ permission: 'harness:read', sideEffect: false, body: null }),
    'GET scenarios': Object.freeze({ permission: 'harness:read', sideEffect: false, body: null }),
    'POST scenarios': Object.freeze({ permission: 'harness:write', sideEffect: true, body: 'lineScenarioCreate' }),
    'POST broadcasts': Object.freeze({ permission: 'harness:write', sideEffect: true, body: 'lineBroadcast' }),
  }),
});

const LINE_DYNAMIC_ACTIONS = Object.freeze([
  Object.freeze({ method: 'GET', pattern: /^scenarios\/[A-Za-z0-9_-]+$/u, permission: 'harness:read', sideEffect: false, body: null }),
  Object.freeze({ method: 'GET', pattern: /^scenarios\/[A-Za-z0-9_-]+\/stats$/u, permission: 'harness:read', sideEffect: false, body: null }),
  Object.freeze({ method: 'PUT', pattern: /^scenarios\/[A-Za-z0-9_-]+$/u, permission: 'harness:write', sideEffect: true, body: 'lineScenarioUpdate' }),
  Object.freeze({ method: 'POST', pattern: /^scenarios\/[A-Za-z0-9_-]+\/steps$/u, permission: 'harness:write', sideEffect: true, body: 'lineStepCreate' }),
  Object.freeze({ method: 'PUT', pattern: /^scenarios\/[A-Za-z0-9_-]+\/steps\/[A-Za-z0-9_-]+$/u, permission: 'harness:write', sideEffect: true, body: 'lineStepUpdate' }),
  Object.freeze({ method: 'DELETE', pattern: /^scenarios\/[A-Za-z0-9_-]+\/steps\/[A-Za-z0-9_-]+$/u, permission: 'harness:write', sideEffect: true, body: null }),
  Object.freeze({ method: 'POST', pattern: /^scenarios\/[A-Za-z0-9_-]+\/steps\/reorder$/u, permission: 'harness:write', sideEffect: true, body: 'lineStepReorder' }),
]);

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

function allowedKeys(body, allowed) {
  return Object.keys(body).every((key) => allowed.includes(key));
}

function optionalIdentifier(value) {
  return value === undefined || value === null || validIdentifier(value);
}

function optionalString(value, max) {
  return value === undefined || value === null || (typeof value === 'string' && value.length <= max);
}

function optionalBoolean(value) {
  return value === undefined || typeof value === 'boolean';
}

function optionalInteger(value, min, max) {
  return value === undefined || value === null || (Number.isInteger(value) && value >= min && value <= max);
}

function optionalNumber(value, min, max) {
  return value === undefined || value === null || (typeof value === 'number' && Number.isFinite(value) && value >= min && value <= max);
}

function validTrigger(value) {
  return ['friend_add', 'tag_added', 'manual'].includes(value);
}

function validDeliveryMode(value) {
  return ['relative', 'elapsed', 'absolute_time'].includes(value);
}

function validMessageType(value) {
  return ['text', 'image', 'flex'].includes(value);
}

function validConditionType(value) {
  return value === undefined || value === null || ['tag_exists', 'tag_not_exists', 'metadata_equals', 'metadata_not_equals'].includes(value);
}

function validateScenarioFields(body, { create = false } = {}) {
  const allowed = ['name', 'description', 'triggerType', 'triggerTagId', 'lineAccountId', 'isActive', 'deliveryMode'];
  if (!allowedKeys(body, allowed)) return false;
  if (create && !stringField(body.name, 1, 120)) return false;
  if (!create && body.name !== undefined && !stringField(body.name, 1, 120)) return false;
  if (!optionalString(body.description, 1000)) return false;
  if (create && !validTrigger(body.triggerType)) return false;
  if (!create && body.triggerType !== undefined && !validTrigger(body.triggerType)) return false;
  if (!optionalIdentifier(body.triggerTagId) || !optionalIdentifier(body.lineAccountId)) return false;
  if (!optionalBoolean(body.isActive)) return false;
  if (body.deliveryMode !== undefined && !validDeliveryMode(body.deliveryMode)) return false;
  const trigger = body.triggerType;
  if (trigger === 'tag_added' && !validIdentifier(body.triggerTagId)) return false;
  return create || Object.keys(body).length > 0;
}

function validateStepFields(body, { create = false } = {}) {
  const allowed = [
    'stepOrder', 'delayMinutes', 'offsetDays', 'offsetMinutes', 'deliveryTime',
    'messageType', 'messageContent', 'conditionType', 'conditionValue',
    'nextStepOnFalse', 'templateId', 'onReachTagId',
  ];
  if (!allowedKeys(body, allowed)) return false;
  if (create && !optionalInteger(body.stepOrder, 1, 10000)) return false;
  if (create && body.stepOrder === undefined) return false;
  if (!create && !optionalInteger(body.stepOrder, 1, 10000)) return false;
  if (!optionalNumber(body.delayMinutes, 0, 5256000)) return false;
  if (!optionalNumber(body.offsetDays, 0, 3650)) return false;
  if (!optionalNumber(body.offsetMinutes, 0, 1439)) return false;
  if (body.deliveryTime !== undefined && (typeof body.deliveryTime !== 'string' || !/^([01]\d|2[0-3]):[0-5]\d$/u.test(body.deliveryTime))) return false;
  if (create && !validMessageType(body.messageType)) return false;
  if (!create && body.messageType !== undefined && !validMessageType(body.messageType)) return false;
  if (create && !stringField(body.messageContent, 1, 10000)) return false;
  if (!create && body.messageContent !== undefined && !stringField(body.messageContent, 1, 10000)) return false;
  if (!validConditionType(body.conditionType)) return false;
  if (body.conditionType != null && !stringField(body.conditionValue, 1, 2048)) return false;
  if (body.conditionType == null && body.conditionValue !== undefined && body.conditionValue !== null && typeof body.conditionValue !== 'string') return false;
  if (!optionalInteger(body.nextStepOnFalse, 1, 10000)) return false;
  if (!optionalIdentifier(body.templateId) || !optionalIdentifier(body.onReachTagId)) return false;
  return create || Object.keys(body).length > 0;
}

export function resolveHarnessAction(provider, method, rawPath) {
  if (!Object.hasOwn(ACTIONS, provider)) return null;
  const normalizedMethod = String(method).toUpperCase();
  const path = String(rawPath ?? '').replace(/^\/+|\/+$/gu, '');
  if (!path || path.includes('..') || !/^[A-Za-z0-9/_-]+$/u.test(path)) return null;
  const action = ACTIONS[provider][`${normalizedMethod} ${path}`];
  if (action) return { ...action, provider, method: normalizedMethod, path };
  if (provider === 'line') {
    const dynamic = LINE_DYNAMIC_ACTIONS.find((candidate) => candidate.method === normalizedMethod && candidate.pattern.test(path));
    if (dynamic) return { permission: dynamic.permission, sideEffect: dynamic.sideEffect, body: dynamic.body, provider, method: normalizedMethod, path };
  }
  return null;
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

  if (kind === 'lineScenarioCreate') return validateScenarioFields(body, { create: true });
  if (kind === 'lineScenarioUpdate') return validateScenarioFields(body);
  if (kind === 'lineStepCreate') return validateStepFields(body, { create: true });
  if (kind === 'lineStepUpdate') return validateStepFields(body);
  if (kind === 'lineStepReorder') {
    return allowedKeys(body, ['orders'])
      && Array.isArray(body.orders)
      && body.orders.length >= 2
      && body.orders.length <= 100
      && body.orders.every((item) => isPlainObject(item)
        && allowedKeys(item, ['stepId', 'stepOrder'])
        && validIdentifier(item.stepId)
        && Number.isInteger(item.stepOrder)
        && item.stepOrder >= 1
        && item.stepOrder <= 10000);
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
