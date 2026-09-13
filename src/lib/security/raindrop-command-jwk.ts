import { isValidRaindropCommandPayload, type RaindropCommandPayload } from './raindrop-command-types';

export type BridgeEnvelope = {
  commandId: number;
  issuedAt: string;
  payload: RaindropCommandPayload;
  signature: string;
};

export function canonicalJson(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`;
  const object = value as Record<string, unknown>;
  return `{${Object.keys(object).sort().map((key) => `${JSON.stringify(key)}:${canonicalJson(object[key])}`).join(',')}}`;
}

function decodeSignature(value: string) {
  if (!/^[A-Za-z0-9_-]{1,256}$/.test(value)) return null;
  try {
    const text = value.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - value.length % 4) % 4);
    const binary = atob(text);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
    return bytes;
  } catch {
    return null;
  }
}

export async function verifyBridgeEnvelope(publicKey: JsonWebKey, value: unknown, now = Date.now()): Promise<BridgeEnvelope | null> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const raw = value as Record<string, unknown>;
  if (!Number.isInteger(raw.commandId) || Number(raw.commandId) <= 0) return null;
  if (typeof raw.issuedAt !== 'string' || typeof raw.signature !== 'string') return null;
  if (!isValidRaindropCommandPayload(raw.payload)) return null;
  const issued = Date.parse(raw.issuedAt);
  if (!Number.isFinite(issued) || now - issued > 120000 || issued - now > 30000) return null;
  const signature = decodeSignature(raw.signature);
  if (!signature) return null;
  const key = await crypto.subtle.importKey('jwk', publicKey, { name: 'ECDSA', namedCurve: 'P-256' }, false, ['verify']);
  const message = `${raw.issuedAt}\n${raw.commandId}\n${canonicalJson(raw.payload)}`;
  const ok = await crypto.subtle.verify({ name: 'ECDSA', hash: 'SHA-256' }, key, signature, new TextEncoder().encode(message));
  return ok ? raw as unknown as BridgeEnvelope : null;
}
