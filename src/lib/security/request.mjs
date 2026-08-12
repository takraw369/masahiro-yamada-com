const MUTATING_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

export function isMutatingMethod(method) {
  return MUTATING_METHODS.has(String(method).toUpperCase());
}

export function isSameOriginRequest(request) {
  if (!isMutatingMethod(request.method)) return true;
  const origin = request.headers.get('Origin');
  if (!origin) return false;
  try {
    return new URL(origin).origin === new URL(request.url).origin;
  } catch {
    return false;
  }
}

export function clientIp(request) {
  const direct = request.headers.get('CF-Connecting-IP');
  const forwarded = request.headers.get('X-Forwarded-For')?.split(',')[0]?.trim();
  const candidate = direct ?? forwarded ?? 'unknown';
  return candidate.slice(0, 64).replace(/[^0-9A-Fa-f:._-]/gu, '_');
}

export function privateHeaders(extraHeaders = {}) {
  return {
    'Cache-Control': 'no-store, max-age=0',
    Pragma: 'no-cache',
    'X-Content-Type-Options': 'nosniff',
    'Referrer-Policy': 'no-referrer',
    'X-Frame-Options': 'DENY',
    'Cross-Origin-Resource-Policy': 'same-origin',
    ...extraHeaders,
  };
}

export function jsonResponse(body, status = 200, extraHeaders = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: privateHeaders({
      'Content-Type': 'application/json; charset=utf-8',
      ...extraHeaders,
    }),
  });
}
