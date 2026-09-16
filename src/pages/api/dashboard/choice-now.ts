import type { APIContext } from 'astro';
import { choiceNowQuestions, fallbackChoiceNow, type ChoiceNowQuestion } from '../../../lib/choiceNow';
import { getDashboardOwnerKey, getSiteStorageEnv, supabaseRpc } from '../../../lib/siteStorage';

type FeedbackRow = {
  id: string;
  page: string;
  message: string;
  context: string | null;
  status: string;
  created_at: string;
};

type IntelligenceRow = {
  title?: string;
  topic?: string;
  lenses?: string[] | null;
  fact_type?: string;
  ace_impact?: string;
  why_it_matters?: string;
  suggested_outputs?: string[] | null;
  status?: string;
  first_seen_at?: string;
  last_seen_at?: string;
};

type PriorDecision = { id: string; choice: string; at: string };

const json = (value: unknown, status = 200) => new Response(JSON.stringify(value), {
  status,
  headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
});

const clean = (value: string | null) => value?.trim() || '';
const normalize = (value: unknown) => String(value ?? '').toLocaleLowerCase('ja-JP');
const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));

function parsePriorDecisions(rows: FeedbackRow[]): PriorDecision[] {
  const result: PriorDecision[] = [];
  for (const row of rows) {
    if (row.page !== '/dashboard/choice-lab' || !row.context) continue;
    try {
      const context = JSON.parse(row.context) as { kind?: string; decisions?: Array<Record<string, unknown>> };
      if (context.kind !== 'choice_now_5' || !Array.isArray(context.decisions)) continue;
      for (const d of context.decisions) {
        if (typeof d.id !== 'string' || typeof d.choice !== 'string') continue;
        result.push({ id: d.id, choice: d.choice, at: typeof d.at === 'string' ? d.at : row.created_at });
      }
    } catch {
      // Older feedback rows can contain free-form context. Ignore those here.
    }
  }
  return result;
}

function daysSince(value: string) {
  const ms = Date.now() - new Date(value).getTime();
  return Number.isFinite(ms) ? Math.max(0, ms / 86_400_000) : 999;
}

function knownSignalText(feedback: FeedbackRow[], intelligence: IntelligenceRow[], questionOverview: unknown) {
  const feedbackText = feedback.slice(0, 50).map((row) => `${row.page} ${row.message} ${row.context ?? ''}`).join(' ');
  const intelligenceText = intelligence.slice(0, 100).map((row) => [
    row.title, row.topic, ...(row.lenses ?? []), row.fact_type, row.ace_impact,
    row.why_it_matters, ...(row.suggested_outputs ?? []), row.status,
  ].filter(Boolean).join(' ')).join(' ');
  // Question Lab is already an owner-gated aggregate. It is used only for in-memory
  // matching; raw question/answer text is never returned from this endpoint.
  const questionText = questionOverview ? JSON.stringify(questionOverview).slice(0, 60_000) : '';
  return normalize(`${feedbackText} ${intelligenceText} ${questionText}`);
}

function tagHits(question: ChoiceNowQuestion, haystack: string) {
  let hits = 0;
  for (const tag of question.tags) {
    const token = normalize(tag);
    if (token && haystack.includes(token)) hits += 1;
  }
  return hits;
}

function rankQuestions(
  haystack: string,
  prior: PriorDecision[],
  excluded: Set<string>,
  limit: number,
) {
  const lastById = new Map<string, PriorDecision>();
  for (const item of prior) if (!lastById.has(item.id)) lastById.set(item.id, item);

  const scored = choiceNowQuestions.map((question) => {
    const hits = tagHits(question, haystack);
    let score = (question.weight ?? 1) * 10 + hits * 5;
    const previous = lastById.get(question.id);
    if (previous) {
      const age = daysSince(previous.at);
      // A hold is deliberately allowed to resurface sooner than a committed choice.
      const cooldown = previous.choice === 'hold'
        ? (age < 7 ? 8 : age < 30 ? 3 : 0)
        : (age < 7 ? 28 : age < 30 ? 16 : age < 90 ? 7 : 0);
      score -= cooldown;
    }
    if (excluded.has(question.id)) score -= 1000;
    return { question, score, hits };
  }).sort((a,b) => b.score - a.score || b.hits - a.hits || a.question.id.localeCompare(b.question.id));

  // Greedy diversity: avoid filling all five slots with one domain when another
  // similarly relevant domain is available.
  const chosen: typeof scored = [];
  const areaCounts = new Map<string, number>();
  const pool = scored.slice();
  while (pool.length && chosen.length < limit) {
    let bestIndex = 0;
    let bestAdjusted = -Infinity;
    pool.forEach((candidate, index) => {
      const areaPenalty = (areaCounts.get(candidate.question.area) ?? 0) * 8;
      const adjusted = candidate.score - areaPenalty;
      if (adjusted > bestAdjusted) { bestAdjusted = adjusted; bestIndex = index; }
    });
    const [picked] = pool.splice(bestIndex, 1);
    if (picked.score < -900) continue;
    chosen.push(picked);
    areaCounts.set(picked.question.area, (areaCounts.get(picked.question.area) ?? 0) + 1);
  }

  if (chosen.length < limit) {
    for (const candidate of scored) {
      if (chosen.some((item) => item.question.id === candidate.question.id)) continue;
      chosen.push(candidate);
      if (chosen.length >= limit) break;
    }
  }
  return chosen;
}

export const GET = async ({ request, locals }: APIContext) => {
  const url = new URL(request.url);
  const limit = clamp(Number(url.searchParams.get('limit') || 5) || 5, 1, 5);
  const excluded = new Set(clean(url.searchParams.get('exclude')).split(',').map(x => x.trim()).filter(Boolean).slice(0, 10));

  try {
    const env = getSiteStorageEnv(locals);
    const ownerKey = await getDashboardOwnerKey(env);

    const [feedbackResult, intelligenceResult, questionResult] = await Promise.allSettled([
      supabaseRpc<FeedbackRow[]>(env, 'masa_dashboard_feedback_list_v2', { p_owner_key: ownerKey, p_limit: 50 }),
      supabaseRpc<IntelligenceRow[]>(env, 'masa_intelligence_list_v1', {
        p_owner_key: ownerKey, p_status: null, p_topic: null, p_limit: 100,
      }),
      supabaseRpc<Record<string, unknown>>(env, 'masa_question_lab_overview_v1', {
        p_owner_key: ownerKey, p_search: null, p_domain: null, p_limit: 100,
      }),
    ]);

    const feedback = feedbackResult.status === 'fulfilled' ? feedbackResult.value ?? [] : [];
    const intelligence = intelligenceResult.status === 'fulfilled' ? intelligenceResult.value ?? [] : [];
    const questionOverview = questionResult.status === 'fulfilled' ? questionResult.value : null;
    const prior = parsePriorDecisions(feedback);
    const haystack = knownSignalText(feedback, intelligence, questionOverview);
    const ranked = rankQuestions(haystack, prior, excluded, limit);
    const anyLiveSource = feedbackResult.status === 'fulfilled' || intelligenceResult.status === 'fulfilled' || questionResult.status === 'fulfilled';

    const signalScores = new Map<string, number>();
    for (const { question } of ranked) {
      for (const tag of question.tags) {
        if (haystack.includes(normalize(tag))) signalScores.set(tag, (signalScores.get(tag) ?? 0) + 1);
      }
    }
    const signals = [...signalScores.entries()]
      .sort((a,b) => b[1] - a[1] || a[0].localeCompare(b[0]))
      .slice(0, 5)
      .map(([tag]) => tag);

    return json({
      ok: true,
      mode: anyLiveSource ? 'context-ranked' : 'base-ranked',
      generatedAt: new Date().toISOString(),
      questions: ranked.length ? ranked.map(item => item.question) : fallbackChoiceNow(limit),
      signals,
      sourceSummary: {
        recentFeedbackCount: feedback.length,
        intelligenceCount: intelligence.length,
        questionLabAvailable: questionResult.status === 'fulfilled',
      },
    });
  } catch {
    return json({
      ok: true,
      mode: 'fallback',
      generatedAt: new Date().toISOString(),
      questions: fallbackChoiceNow(limit),
      signals: [],
      sourceSummary: { recentFeedbackCount: 0, intelligenceCount: 0, questionLabAvailable: false },
    });
  }
};
