export type RaindropCommandPayload =
  | { action: 'search'; search: string; limit?: number }
  | { action: 'get'; ids: number[] }
  | { action: 'curate'; operations: Array<{
      id: number;
      expectedLink: string;
      action: 'move' | 'tag' | 'trash';
      collectionId?: number;
      addTags?: string[];
      removeTags?: string[];
    }> };

function validStrings(value: unknown, max = 40) {
  return value === undefined || (
    Array.isArray(value) && value.length <= max &&
    value.every((item) => typeof item === 'string' && item.trim().length > 0 && item.length <= 200)
  );
}

export function isValidRaindropCommandPayload(value: unknown): value is RaindropCommandPayload {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const payload = value as Record<string, unknown>;

  if (payload.action === 'search') {
    return typeof payload.search === 'string' && payload.search.trim().length > 0 && payload.search.length <= 240 &&
      (payload.limit === undefined || (Number.isInteger(payload.limit) && Number(payload.limit) >= 1 && Number(payload.limit) <= 50));
  }

  if (payload.action === 'get') {
    return Array.isArray(payload.ids) && payload.ids.length >= 1 && payload.ids.length <= 150 &&
      payload.ids.every((id) => Number.isInteger(id) && Number(id) > 0);
  }

  if (payload.action !== 'curate' || !Array.isArray(payload.operations) || payload.operations.length < 1 || payload.operations.length > 150) return false;
  return payload.operations.every((raw) => {
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return false;
    const op = raw as Record<string, unknown>;
    if (!Number.isInteger(op.id) || Number(op.id) <= 0) return false;
    if (typeof op.expectedLink !== 'string' || op.expectedLink.length < 1 || op.expectedLink.length > 4000) return false;
    if (!['move', 'tag', 'trash'].includes(String(op.action))) return false;
    if (op.action === 'move') return Number.isInteger(op.collectionId) && (Number(op.collectionId) === -1 || Number(op.collectionId) > 0);
    if (op.action === 'tag') {
      const add = Array.isArray(op.addTags) ? op.addTags.length : 0;
      const remove = Array.isArray(op.removeTags) ? op.removeTags.length : 0;
      return validStrings(op.addTags) && validStrings(op.removeTags) && add + remove > 0;
    }
    return true;
  });
}
