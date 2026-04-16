import type { APIContext } from 'astro';

interface Env { DB: D1Database; }

function genId() { return Math.random().toString(36).slice(2, 10) + Date.now().toString(36); }

// SM-2 algorithm
function nextInterval(rating: 'easy' | 'medium' | 'hard', currentInterval: number, ef: number) {
  if (rating === 'hard') return { interval: 1, ef: Math.max(1.3, ef - 0.2) };
  if (rating === 'medium') return { interval: Math.round(currentInterval * ef), ef };
  return { interval: Math.round(currentInterval * ef * 1.3), ef: Math.min(3.0, ef + 0.1) };
}

function addDays(days: number) {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

// GET /api/flashcards?deck=deck-ace&mode=today|all
export const GET = async ({ url, locals }: APIContext) => {
  const env = locals.runtime?.env as Env | undefined;
  if (!env?.DB) return json({ decks: [], cards: [] });

  const deckId = url.searchParams.get('deck');
  const mode   = url.searchParams.get('mode') ?? 'today';
  const today  = new Date().toISOString().slice(0, 10);

  const [decks, cards] = await Promise.all([
    env.DB.prepare('SELECT * FROM flashcard_decks ORDER BY sort_order').all(),
    mode === 'today'
      ? env.DB.prepare(
          `SELECT * FROM flashcards WHERE next_review <= ? ${deckId ? 'AND deck_id = ?' : ''} ORDER BY next_review, RANDOM()`
        ).bind(...(deckId ? [today, deckId] : [today])).all()
      : env.DB.prepare(
          `SELECT * FROM flashcards ${deckId ? 'WHERE deck_id = ?' : ''} ORDER BY created_at DESC`
        ).bind(...(deckId ? [deckId] : [])).all(),
  ]);

  return json({ decks: decks.results, cards: cards.results });
};

// POST /api/flashcards — create card
export const POST = async ({ request, locals }: APIContext) => {
  const env = locals.runtime?.env as Env | undefined;
  if (!env?.DB) return json({ error: 'no db' }, 500);

  const body = await request.json<{ front: string; back: string; deck_id: string; tags?: string; source?: string }>();
  const id = genId();

  await env.DB.prepare(
    'INSERT INTO flashcards (id, front, back, deck_id, tags, source) VALUES (?, ?, ?, ?, ?, ?)'
  ).bind(id, body.front, body.back, body.deck_id, body.tags ?? null, body.source ?? null).run();

  return json({ id });
};

// PATCH /api/flashcards — review a card
export const PATCH = async ({ request, locals }: APIContext) => {
  const env = locals.runtime?.env as Env | undefined;
  if (!env?.DB) return json({ error: 'no db' }, 500);

  const body = await request.json<{ id: string; rating: 'easy' | 'medium' | 'hard' }>();
  const { id, rating } = body;

  const card = await env.DB.prepare('SELECT * FROM flashcards WHERE id = ?').bind(id).first<{
    interval_days: number; ease_factor: number; xp_total: number; review_count: number;
  }>();
  if (!card) return json({ error: 'not found' }, 404);

  const xp = rating === 'easy' ? 10 : rating === 'medium' ? 20 : 30;
  const { interval, ef } = nextInterval(rating, card.interval_days, card.ease_factor);
  const nextReview = addDays(interval);

  await Promise.all([
    env.DB.prepare(
      'UPDATE flashcards SET difficulty=?, next_review=?, interval_days=?, ease_factor=?, xp_total=?, review_count=?, updated_at=datetime("now") WHERE id=?'
    ).bind(rating, nextReview, interval, ef, card.xp_total + xp, card.review_count + 1, id).run(),
    env.DB.prepare(
      'INSERT INTO flashcard_reviews (id, card_id, rating, xp_earned) VALUES (?, ?, ?, ?)'
    ).bind(genId(), id, rating, xp).run(),
  ]);

  return json({ xp, nextReview, interval });
};

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}
