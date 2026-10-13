import { isSameOriginRequest, jsonResponse } from './security/request.mjs';
import { INTELLIGENCE_READING_VERSION, readingInput, readingSourceSnapshot, toIntelligenceItem, validReading, type IntelligenceReading, type IntelligenceRow } from './intelligenceReader.ts';

type ReadingInput = Awaited<ReturnType<typeof readingInput>>;
type GenerateResult = { ok: boolean; status: string; titleJa?: string; summaryJa?: string; whyJa?: string; model?: string; generatedAt?: string; evidenceScope?: string; cached?: boolean };
type Dependencies = {
  sessionValid: boolean;
  read: (id: string) => Promise<IntelligenceRow | null>;
  generate: (input: ReadingInput) => Promise<GenerateResult>;
  save: (id: string, inputHash: string, sourceSnapshot: string[], reading: IntelligenceReading) => Promise<IntelligenceRow>;
};

async function limitedBody(request: Request): Promise<string | null> {
  if (!request.body) return '';
  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      const next = await reader.read();
      if (next.done) break;
      size += next.value.byteLength;
      if (size > 2048) { await reader.cancel(); return null; }
      chunks.push(next.value);
    }
  } finally { reader.releaseLock(); }
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
  return new TextDecoder().decode(bytes);
}

export async function handleIntelligenceReader(request: Request, dependencies: Dependencies): Promise<Response> {
  if (request.method !== 'POST') return jsonResponse({ ok: false, error: 'method_not_allowed' }, 405);
  if (!dependencies.sessionValid) return jsonResponse({ ok: false, error: 'unauthorized', message: 'ログインし直してください。' }, 401);
  if (!isSameOriginRequest(request)) return jsonResponse({ ok: false, error: 'same_origin_required', message: 'Feedの画面から操作してください。' }, 403);
  const body = await limitedBody(request);
  if (body === null) return jsonResponse({ ok: false, error: 'payload_too_large', message: 'リクエストが大きすぎます。' }, 413);
  let parsed: Record<string, unknown>;
  try { parsed = JSON.parse(body); } catch { return jsonResponse({ ok: false, error: 'invalid_json', message: '操作内容を読み取れませんでした。' }, 400); }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed) || Object.keys(parsed).some((key) => key !== 'id') || typeof parsed.id !== 'string' || !/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(parsed.id)) {
    return jsonResponse({ ok: false, error: 'invalid_item', message: '記事を選び直してください。' }, 400);
  }
  try {
    const row = await dependencies.read(parsed.id);
    if (!row?.id || row.id !== parsed.id) return jsonResponse({ ok: false, error: 'not_found', message: '記事を見つけられませんでした。' }, 404);
    if (row.status === 'archived') return jsonResponse({ ok: false, error: 'archived', message: '保管済みの記事は日本語化の対象外です。' }, 409);
    const item = await toIntelligenceItem(row);
    if (item.readingCurrent) return jsonResponse({ ok: true, item, cached: true });
    const input = await readingInput(row);
    const result = await dependencies.generate(input);
    if (!result.ok || result.status !== 'ready') {
      const messages: Record<string, string> = {
        daily_limit: '今日の日本語化は上限の5件に達しました。保存済みの要点は引き続き読めます。',
        quota_exhausted: 'AIの今日の利用枠に達しました。原文と保存済みの要点は読めます。',
        busy: 'この記事の要点を作成中です。少し待ってからもう一度開いてください。',
        unavailable: '日本語化の接続を確認できません。原文から読めます。',
      };
      return jsonResponse({ ok: false, error: result.status, message: messages[result.status] ?? '要点を作成できませんでした。原文から読めます。' }, ['daily_limit', 'busy'].includes(result.status) ? 429 : 503);
    }
    const reading = validReading({ ...result, version: INTELLIGENCE_READING_VERSION, inputHash: input.inputHash });
    if (!reading) return jsonResponse({ ok: false, error: 'invalid_reading', message: '日本語の要点を確認できませんでした。原文から読めます。' }, 502);
    const saved = await dependencies.save(row.id, input.inputHash, readingSourceSnapshot(row), reading);
    return jsonResponse({ ok: true, item: await toIntelligenceItem(saved), cached: result.cached === true });
  } catch (error) {
    const changed = error instanceof Error && error.message.includes('reader_source_changed');
    return jsonResponse({ ok: false, error: changed ? 'source_changed' : 'reader_unavailable', message: changed ? '元の記事が更新されました。「更新」してから読み直してください。' : '日本語化を保存できませんでした。時間をおいて読み直してください。' }, changed ? 409 : 503);
  }
}
