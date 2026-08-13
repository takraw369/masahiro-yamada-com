import { hasPermission } from '../security/auth.mjs';
import { jsonResponse } from '../security/request.mjs';

function validSlotId(value) {
  return typeof value === 'string'
    && value.length >= 1
    && value.length <= 128
    && /^[A-Za-z0-9:_-]+$/u.test(value);
}

export async function handleDashboardStateGet({ session, env }) {
  if (!session || !hasPermission(session, 'dashboard:read')) {
    return jsonResponse({ error: 'authentication_required' }, 401);
  }

  if (!env?.DB) return jsonResponse({ error: 'database_unavailable' }, 503);

  try {
    const rows = await env.DB.prepare(
      'SELECT slot_id FROM ace_checked WHERE user_id = ?',
    )
      .bind(session.sub)
      .all();

    const checked = {};
    for (const row of rows.results) checked[row.slot_id] = true;
    return jsonResponse({ checked });
  } catch {
    return jsonResponse({ error: 'database_query_failed' }, 500);
  }
}

export async function handleDashboardStatePost({ request, session, env }) {
  if (!session || !hasPermission(session, 'dashboard:write')) {
    return jsonResponse({ error: 'authorization_required' }, 403);
  }

  const contentType = request.headers.get('Content-Type') ?? '';
  const declaredLength = Number(request.headers.get('Content-Length') ?? 0);
  if (!contentType.toLowerCase().startsWith('application/json')) {
    return jsonResponse({ error: 'json_required' }, 415);
  }
  if (declaredLength > 2048) return jsonResponse({ error: 'request_too_large' }, 413);

  let body;
  try {
    const rawBody = await request.text();
    if (new TextEncoder().encode(rawBody).byteLength > 2048) {
      return jsonResponse({ error: 'request_too_large' }, 413);
    }
    body = JSON.parse(rawBody);
  } catch {
    return jsonResponse({ error: 'invalid_json' }, 400);
  }
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return jsonResponse({ error: 'invalid_input' }, 400);
  }

  const allowedKeys = ['slotId', 'checked', 'xp'];
  if (
    !Object.keys(body).every((key) => allowedKeys.includes(key))
    || !validSlotId(body.slotId)
    || typeof body.checked !== 'boolean'
    || !Number.isInteger(body.xp)
    || body.xp < 0
    || body.xp > 10_000
  ) {
    return jsonResponse({ error: 'invalid_input' }, 400);
  }

  if (!env?.DB) return jsonResponse({ error: 'database_unavailable' }, 503);

  try {
    if (body.checked) {
      await env.DB.prepare(
        'INSERT OR REPLACE INTO ace_checked (user_id, slot_id, xp, checked_at) VALUES (?, ?, ?, CURRENT_TIMESTAMP)',
      )
        .bind(session.sub, body.slotId, body.xp)
        .run();
    } else {
      await env.DB.prepare(
        'DELETE FROM ace_checked WHERE user_id = ? AND slot_id = ?',
      )
        .bind(session.sub, body.slotId)
        .run();
    }
    return jsonResponse({ ok: true });
  } catch {
    return jsonResponse({ error: 'database_write_failed' }, 500);
  }
}
