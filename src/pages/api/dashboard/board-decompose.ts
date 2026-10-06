import type { APIContext } from 'astro';
import { getDashboardOwnerKey, getSiteStorageEnv } from '../../../lib/siteStorage';

const MAX_BODY_BYTES = 10_000;
const MAX_LABEL = 240;
const MAX_NOTE = 4_000;

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
  },
});

function cleanItem(value: unknown) {
  if (typeof value !== 'string') return '';
  return value
    .replace(/^[-*・●○□■▶▷→⇒\\d.)\\s]+/, '')
    .replace(/[。．.!！?？]+$/g, '')
    .replace(/\\s+/g, ' ')
    .trim()
    .slice(0, 36);
}

function uniqueItems(values: unknown[]) {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const raw of values) {
    const item = cleanItem(raw);
    if (!item || item.length > 36) continue;
    const key = item.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(item);
    if (out.length >= 7) break;
  }
  return out;
}

function fallbackItems(label: string, note: string) {
  const source = note || label;
  const rough = source
    .replace(/(?:→|⇒|->)/g, '・')
    .split(/[。！？\\n]+/)
    .flatMap(sentence => sentence.split(/[・、,，／/]+/))
    .map(value => value
      .replace(/^(?:そして|また|さらに|つまり|主に|全体の)/, '')
      .replace(/(?:する|できる|していく|へ変換する|へ接続する|を行う)$/u, '')
      .trim())
    .filter(Boolean);

  const direct = uniqueItems(rough);
  if (direct.length >= 2) return direct;

  const clauseParts = source
    .split(/(?:し、|して、|から|へ|と|を)/u)
    .map(value => value.trim())
    .filter(value => value.length >= 2);
  return uniqueItems([...direct, ...clauseParts, label]);
}

function extractStrings(payload: unknown): string[] {
  const preferred: string[] = [];
  const fallback: string[] = [];

  const visit = (value: unknown, key = '') => {
    if (typeof value === 'string') {
      if (/^(answer|response|text|content|message|output)$/i.test(key)) preferred.push(value);
      else fallback.push(value);
      return;
    }
    if (Array.isArray(value)) {
      if (/^(items|branches|nodes|children)$/i.test(key)) {
        if (value.every(item => typeof item === 'string')) preferred.push(JSON.stringify(value));
      }
      for (const item of value) visit(item, key);
      return;
    }
    if (value && typeof value === 'object') {
      for (const [childKey, childValue] of Object.entries(value as Record<string, unknown>)) {
        visit(childValue, childKey);
      }
    }
  };

  visit(payload);
  return [...preferred, ...fallback];
}

function parseItemsFromText(text: string) {
  const trimmed = text.replace(/```(?:json)?/gi, '').replace(/```/g, '').trim();
  const arrayStart = trimmed.indexOf('[');
  const arrayEnd = trimmed.lastIndexOf(']');
  if (arrayStart >= 0 && arrayEnd > arrayStart) {
    try {
      const parsed = JSON.parse(trimmed.slice(arrayStart, arrayEnd + 1));
      if (Array.isArray(parsed)) {
        const items = uniqueItems(parsed);
        if (items.length >= 2) return items;
      }
    } catch {}
  }

  const lines = trimmed
    .split(/\\r?\\n/)
    .map(line => line.trim())
    .filter(Boolean);
  const bullets = uniqueItems(lines);
  return bullets.length >= 2 ? bullets : [];
}

function parseAiItems(payload: unknown) {
  if (payload && typeof payload === 'object' && !Array.isArray(payload)) {
    const record = payload as Record<string, unknown>;
    for (const key of ['items', 'branches', 'nodes', 'children']) {
      if (Array.isArray(record[key])) {
        const items = uniqueItems(record[key] as unknown[]);
        if (items.length >= 2) return items;
      }
    }
  }

  for (const candidate of extractStrings(payload)) {
    const items = parseItemsFromText(candidate);
    if (items.length >= 2) return items;
  }
  return [];
}

async function askExistingAi(env: ReturnType<typeof getSiteStorageEnv>, ownerKey: string, label: string, note: string) {
  if (!env.SUPABASE_URL) return [];

  const prompt = [
    '次のFLOW Boardカードだけを根拠に、マインドマップの子ノードへ分解してください。',
    '4〜7個。各項目は2〜18文字程度の短い日本語。',
    '重複を避け、元カードにない新情報・推測・助言は追加しない。',
    '説明文に含まれる目的・対象・要素・流れを、小さい吹き出しに置ける粒度へ分ける。',
    '出力はJSON配列だけ。例: ["現在地","優先順位","次Action","俯瞰"]',
    '',
    'タイトル: ' + label,
    '説明: ' + (note || '(説明なし)'),
  ].join('\\n');

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 30_000);
  try {
    const response = await fetch(env.SUPABASE_URL.replace(/\\/$/, '') + '/functions/v1/knowledge-ask-v2', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify({
        owner_key: ownerKey,
        question: prompt,
        answer_mode: 'ai',
      }),
      signal: controller.signal,
    });
    if (!response.ok) return [];
    const text = await response.text();
    let payload: unknown = text;
    try { payload = text ? JSON.parse(text) : null; } catch {}
    return parseAiItems(payload);
  } catch {
    return [];
  } finally {
    clearTimeout(timeout);
  }
}

export const POST = async ({ request, locals }: APIContext) => {
  const contentLength = Number(request.headers.get('content-length') || '0');
  if (contentLength > MAX_BODY_BYTES) return json({ ok: false, error: 'payload_too_large' }, 413);

  let body: Record<string, unknown>;
  try {
    const raw = await request.text();
    if (new TextEncoder().encode(raw).length > MAX_BODY_BYTES) return json({ ok: false, error: 'payload_too_large' }, 413);
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error('invalid_body');
    body = parsed as Record<string, unknown>;
  } catch {
    return json({ ok: false, error: 'invalid_json' }, 400);
  }

  const label = typeof body.label === 'string' ? body.label.trim().slice(0, MAX_LABEL) : '';
  const note = typeof body.note === 'string' ? body.note.trim().slice(0, MAX_NOTE) : '';
  if (!label && !note) return json({ ok: false, error: 'empty_card' }, 400);

  const fallback = fallbackItems(label, note);

  try {
    const env = getSiteStorageEnv(locals);
    const ownerKey = await getDashboardOwnerKey(env);
    const aiItems = await askExistingAi(env, ownerKey, label, note);
    if (aiItems.length >= 2) return json({ ok: true, items: aiItems, source: 'ai' });
  } catch (error) {
    console.error('flow_board_decompose_ai_failed', error);
  }

  if (fallback.length >= 2) return json({ ok: true, items: fallback, source: 'fallback' });
  return json({ ok: false, error: 'not_enough_content' }, 422);
};