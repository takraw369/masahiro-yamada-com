export type PublishingHandoff = {
  phase?: string;
  theme?: string;
  question?: string;
  coreId?: string;
  coreTitle?: string;
  audience?: string;
  channel?: string;
  cta?: string;
  createdAt?: number;
};

// A handoff is a short-lived selection, not a saved draft or canonical record.
export const PUBLISHING_HANDOFF_MAX_AGE_MS = 24 * 60 * 60 * 1000;

export function readPublishingHandoff(raw: string | null): PublishingHandoff | null {
  try {
    const value: unknown = JSON.parse(raw || 'null');
    if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
    const record = value as Record<string, unknown>;
    const handoff: PublishingHandoff = {};
    for (const key of ['phase', 'theme', 'question', 'coreId', 'coreTitle', 'audience', 'channel', 'cta'] as const) {
      if (typeof record[key] === 'string') handoff[key] = record[key].trim();
    }
    if (typeof record.createdAt === 'number') handoff.createdAt = record.createdAt;
    return handoff;
  } catch {
    return null;
  }
}

export function isPublishingHandoffFresh(handoff: PublishingHandoff, now = Date.now()): boolean {
  const createdAt = handoff.createdAt;
  return typeof createdAt === 'number' && Number.isFinite(createdAt) && createdAt > 0
    && createdAt <= now && now - createdAt < PUBLISHING_HANDOFF_MAX_AGE_MS;
}

export function publishingHandoffSeed(handoff: PublishingHandoff): string {
  // Strategy fields stay in the handoff panel. Only source copy enters Composer.
  return [...new Set([handoff.coreTitle, handoff.question].map((text) => text?.trim()).filter(Boolean))].join('\n\n');
}
