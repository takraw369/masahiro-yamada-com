import type { APIContext } from 'astro';
import { getSiteStorageEnv, supabaseRpc } from '../../../lib/siteStorage';

const json = (value: unknown, status = 200) => new Response(JSON.stringify(value), {
  status,
  headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
});

const clean = (value: unknown, max: number) => typeof value === 'string' ? value.trim().slice(0, max) : '';

export const POST = async ({ request, locals }: APIContext) => {
  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return json({ ok: false, error: 'invalid_json' }, 400);
  }

  const clientEventId = clean(body.clientEventId, 120);
  const productKey = clean(body.productKey, 200);
  const productName = clean(body.productName, 240);
  const sentiment = Number(body.sentiment);
  const bodyNote = clean(body.bodyNote, 500);
  const comment = clean(body.comment, 1200);
  const sourceRef = clean(body.sourceRef, 500) || '/food-lens';
  const wouldBuyAgain = typeof body.wouldBuyAgain === 'boolean' ? body.wouldBuyAgain : null;
  const sharePublic = body.sharePublic === true;
  const website = clean(body.website, 200);

  if (website) return json({ ok: true, data: { accepted: true } }, 201);
  if (clientEventId.length < 8 || !productKey || !Number.isInteger(sentiment) || sentiment < 1 || sentiment > 5) {
    return json({ ok: false, error: 'invalid_feedback' }, 400);
  }

  try {
    const env = getSiteStorageEnv(locals);
    const id = await supabaseRpc<string>(env, 'submit_food_product_feedback_v1', {
      p_client_event_id: clientEventId,
      p_product_key: productKey,
      p_product_name: productName || null,
      p_sentiment: sentiment,
      p_would_buy_again: wouldBuyAgain,
      p_body_note: bodyNote || null,
      p_comment: comment || null,
      p_share_public: sharePublic,
      p_source_ref: sourceRef,
    });
    return json({ ok: true, data: { id, status: 'pending' } }, 201);
  } catch (error) {
    return json({ ok: false, error: String(error) }, 500);
  }
};