/** Server-only: reuse the deployed LINE PWA login channel and provider verification.
 * A browser contact UUID, email, decoded JWT or Flow Check link is not identity proof.
 * Never persist the ID token or put it in a URL, Stripe metadata, or a log.
 */
export async function verifyBookingLineIdentity(idToken: unknown, http: typeof fetch = fetch): Promise<string | null> {
  if (typeof idToken !== 'string' || idToken.length < 20 || idToken.length > 4096) return null;
  const channel = '2009606403'; // Same public LINE Login channel as line-pwa-bootstrap v12.
  const response = await http('https://api.line.me/oauth2/v2.1/verify', {
    method: 'POST', redirect: 'error', signal: AbortSignal.timeout(8000),
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ id_token: idToken, client_id: channel }),
  });
  if (!response.ok) return null;
  const value: unknown = await response.json();
  if (!value || typeof value !== 'object') return null;
  const proof = value as Record<string, unknown>;
  return proof.aud === channel && proof.iss === 'https://access.line.me'
    && typeof proof.exp === 'number' && proof.exp > Math.floor(Date.now() / 1000)
    && typeof proof.sub === 'string' && /^U[0-9a-f]{32}$/i.test(proof.sub)
    ? proof.sub : null;
}
