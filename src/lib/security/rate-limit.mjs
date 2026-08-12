const buckets = new Map();
let lastSweep = 0;

function sweep(nowMs) {
  if (nowMs - lastSweep < 60_000) return;
  lastSweep = nowMs;
  for (const [key, bucket] of buckets) {
    if (bucket.resetAt <= nowMs) buckets.delete(key);
  }
}

function consumeLocalRateLimit(key, options = {}) {
  const nowMs = options.nowMs ?? Date.now();
  const limit = options.limit ?? 10;
  const windowMs = options.windowMs ?? 60_000;
  sweep(nowMs);

  const existing = buckets.get(key);
  const bucket = !existing || existing.resetAt <= nowMs
    ? { count: 0, resetAt: nowMs + windowMs }
    : existing;
  bucket.count += 1;
  buckets.set(key, bucket);

  return {
    allowed: bucket.count <= limit,
    remaining: Math.max(0, limit - bucket.count),
    retryAfterSeconds: Math.max(1, Math.ceil((bucket.resetAt - nowMs) / 1000)),
  };
}

export async function consumeRateLimit(binding, key, options = {}) {
  if (binding && typeof binding.limit === 'function') {
    try {
      const result = await binding.limit({ key });
      return {
        allowed: result?.success === true,
        remaining: null,
        retryAfterSeconds: options.retryAfterSeconds ?? 60,
        unavailable: false,
        source: 'cloudflare',
      };
    } catch {
      return {
        allowed: false,
        remaining: null,
        retryAfterSeconds: options.retryAfterSeconds ?? 60,
        unavailable: true,
        source: 'cloudflare',
      };
    }
  }

  if (!options.allowLocalFallback) {
    return {
      allowed: false,
      remaining: null,
      retryAfterSeconds: options.retryAfterSeconds ?? 60,
      unavailable: true,
      source: 'missing',
    };
  }

  return {
    ...consumeLocalRateLimit(key, options),
    unavailable: false,
    source: 'local',
  };
}

export function resetRateLimitsForTests() {
  buckets.clear();
  lastSweep = 0;
}
