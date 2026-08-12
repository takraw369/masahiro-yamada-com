import type { APIContext } from 'astro';

interface Env { DB: D1Database; }
function genId() { return Math.random().toString(36).slice(2, 10) + Date.now().toString(36); }
function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json' } });
}

// GET /api/schedule?week=2026-W15
export const GET = async ({ url, locals }: APIContext) => {
  const env = locals.runtime?.env as Env | undefined;
  if (!env?.DB) return json({ templates: [], items: [], streak: null });

  const week = url.searchParams.get('week') ?? currentWeek();
  const { start, end } = weekRange(week);

  const [templates, items, streak] = await Promise.all([
    env.DB.prepare('SELECT * FROM schedule_templates ORDER BY sort_order').all(),
    env.DB.prepare('SELECT * FROM schedule_items WHERE date >= ? AND date <= ? ORDER BY date, time_slot').bind(start, end).all(),
    env.DB.prepare('SELECT * FROM schedule_streaks WHERE week_start = ?').bind(start).first(),
  ]);

  return json({ templates: templates.results, items: items.results, streak });
};

// POST /api/schedule — add item
export const POST = async ({ request, locals }: APIContext) => {
  const env = locals.runtime?.env as Env | undefined;
  if (!env?.DB) return json({ error: 'no db' }, 500);

  const body = await request.json<{
    template_id?: string; title: string; category?: string; color?: string;
    date: string; time_slot: string; estimated_minutes?: number;
    platforms?: string; content?: string; memo?: string;
  }>();
  const id = genId();

  await env.DB.prepare(
    `INSERT INTO schedule_items (id, template_id, title, category, color, date, time_slot, estimated_minutes, platforms, content, memo)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).bind(id, body.template_id ?? null, body.title, body.category ?? null, body.color ?? null,
    body.date, body.time_slot, body.estimated_minutes ?? 30, body.platforms ?? null,
    body.content ?? null, body.memo ?? null).run();

  // upsert streak record
  const start = weekStartFor(body.date);
  await env.DB.prepare(
    `INSERT INTO schedule_streaks (id, week_start, items_total) VALUES (?, ?, 1)
     ON CONFLICT(week_start) DO UPDATE SET items_total = items_total + 1`
  ).bind(genId(), start).run();

  return json({ id });
};

// PATCH /api/schedule — update item
export const PATCH = async ({ request, locals }: APIContext) => {
  const env = locals.runtime?.env as Env | undefined;
  if (!env?.DB) return json({ error: 'no db' }, 500);

  const body = await request.json<{
    id: string; status?: string; content?: string; image_memo?: string;
    memo?: string; platforms?: string; platform_status?: string;
    completed?: boolean; date?: string; time_slot?: string;
  }>();

  const item = await env.DB.prepare('SELECT * FROM schedule_items WHERE id = ?').bind(body.id).first<{
    xp_earned: number; estimated_minutes: number; date: string;
    category: string; completed: number;
  }>();
  if (!item) return json({ error: 'not found' }, 404);

  // compute XP if completing now
  let xp = item.xp_earned;
  if (body.completed && !item.completed) {
    const tmpl = await env.DB.prepare('SELECT xp_multiplier FROM schedule_templates WHERE category = ?').bind(item.category).first<{ xp_multiplier: number }>();
    const mult = tmpl?.xp_multiplier ?? 1.0;
    xp = Math.round((item.estimated_minutes ?? 30) * mult);

    // update streak
    const start = weekStartFor(item.date);
    await env.DB.prepare(
      `INSERT INTO schedule_streaks (id, week_start, total_xp, items_completed) VALUES (?, ?, ?, 1)
       ON CONFLICT(week_start) DO UPDATE SET total_xp = total_xp + ?, items_completed = items_completed + 1`
    ).bind(genId(), start, xp, xp).run();
  }

  await env.DB.prepare(
    `UPDATE schedule_items SET
      status = COALESCE(?, status),
      content = COALESCE(?, content),
      image_memo = COALESCE(?, image_memo),
      memo = COALESCE(?, memo),
      platforms = COALESCE(?, platforms),
      platform_status = COALESCE(?, platform_status),
      completed = COALESCE(?, completed),
      xp_earned = ?,
      date = COALESCE(?, date),
      time_slot = COALESCE(?, time_slot),
      updated_at = datetime('now')
    WHERE id = ?`
  ).bind(
    body.status ?? null, body.content ?? null, body.image_memo ?? null,
    body.memo ?? null, body.platforms ?? null, body.platform_status ?? null,
    body.completed !== undefined ? (body.completed ? 1 : 0) : null,
    xp,
    body.date ?? null, body.time_slot ?? null,
    body.id
  ).run();

  return json({ xp });
};

// DELETE /api/schedule — delete item
export const DELETE = async ({ request, locals }: APIContext) => {
  const env = locals.runtime?.env as Env | undefined;
  if (!env?.DB) return json({ error: 'no db' }, 500);

  const body = await request.json<{ id: string }>();
  await env.DB.prepare('DELETE FROM schedule_items WHERE id = ?').bind(body.id).run();
  return json({ ok: true });
};

// ── helpers ──────────────────────────────────────────────
function currentWeek() {
  const now = new Date();
  const jan1 = new Date(now.getFullYear(), 0, 1);
  const week = Math.ceil(((now.getTime() - jan1.getTime()) / 86400000 + jan1.getDay() + 1) / 7);
  return `${now.getFullYear()}-W${String(week).padStart(2, '0')}`;
}

function weekRange(week: string) {
  const [year, w] = week.split('-W').map(Number);
  const jan1 = new Date(year, 0, 1);
  const dayOfWeek = jan1.getDay(); // 0=Sun
  const weekStart = new Date(jan1);
  weekStart.setDate(jan1.getDate() + (w - 1) * 7 - dayOfWeek + 1);
  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekStart.getDate() + 6);
  return {
    start: weekStart.toISOString().slice(0, 10),
    end: weekEnd.toISOString().slice(0, 10),
  };
}

function weekStartFor(dateStr: string) {
  const d = new Date(dateStr);
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  return d.toISOString().slice(0, 10);
}
