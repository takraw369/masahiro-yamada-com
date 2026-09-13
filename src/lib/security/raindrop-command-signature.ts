import { isValidRaindropCommandPayload, type RaindropCommandPayload } from './raindrop-command-types';

export type RaindropCommandEnvelope = {
  commandId: number;
  issuedAt: string;
  payload: RaindropCommandPayload;
  signature: string;
};

export function stableBridgeJson(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(stableBridgeJson).join(',')}]`;
  const object = value as Record<string, unknown>;
  return `{${Object.keys(object).sort().map((key) => `${JSON.stringify(key)}:${stableBridgeJson(object[key])}`).join(',')}}`;
}

function pemBytes(pem: string) {
  const encoded = pem.replace(/-----BEGIN [^-]+-----/g, '').replace(/-----END [^-]+-----/g, '').replace(/\s+/g, '');
  const binary = atob(encoded);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  return bytes.buffer;
}

function signatureBytes(value: string) {
  if (!/^[A-Za-z0-9_-]{1,256}$/.test(value)) return null;
  try {
    const padded = value.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - value.length % 4) % 4);
    const binary = atob(padded);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
    return bytes;
  } catch {
    return null;
  }
}

export async function verifyRaindropCommandEnvelope(publicKeyPem: string, value: unknown, nowMs = Date.now()): Promise<RaindropCommandEnvelope | null> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const raw = value as Record<string, unknown>;
  if (!Number.isInteger(raw.commandId) || Number(raw.commandId) <= 0) return null;
  if (typeof raw.issuedAt !== 'string' || typeof raw.signature !== 'string') return null;
  if (!isValidRaindropCommandPayload(raw.payload)) return null;

  const issuedAtMs = Date.parse(raw.issuedAt);
  if (!Number.isFinite(issuedAtMs)) return null;
  if (nowMs - issuedAtMs > 120_000 || issuedAtMs - nowMs > 30_000) return null;
  const signature = signatureBytes(raw.signature);
  if (!signature) return null;

  const key = await crypto.subtle.importKey('spki', pemBytes(publicKeyPem), { name: 'ECDSA', namedCurve: 'P-256' }, false, ['verify']);
  const canonical = `${raw.issuedAt}\n${raw.commandId}\n${stableBridgeJson(raw.payload)}`;
  const ok = await crypto.subtle.verify({ name: 'ECDSA', hash: 'SHA-256' }, key, signature, new TextEncoder().encode(canonical));
  return ok ? raw as unknown as RaindropCommandEnvelope : null;
}
