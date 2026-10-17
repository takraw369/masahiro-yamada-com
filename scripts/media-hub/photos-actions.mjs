// Local proposal ledger only: no Photos API, OAuth or browser automation.
import { randomUUID } from 'node:crypto';

export function proposePhotosAction(catalog, assetId, action, note = '') {
  const item = catalog.getItem(assetId);
  if (!item?.available) throw new Error('Available media item required');
  if (!['add-to-album','favorite','archive','review-metadata'].includes(action)) throw new Error('Unsupported native action proposal');
  if (typeof note !== 'string' || note.length > 500) throw new Error('Invalid proposal note');
  const id = randomUUID();
  const data = { action, note, proposedAt: new Date().toISOString(), sourceUrl: item.sourceUrl,
    sourceUrlStatus: item.sourceUrlStatus, confirmation: null, evidenceType: 'manual-user-report-only' };
  catalog.db.prepare('INSERT INTO photos_actions VALUES (?,?,?,?)').run(id, assetId, 'proposed', JSON.stringify(data));
  return { id, assetId, state: 'proposed', ...data };
}
export function transitionPhotosAction(catalog, id, state, confirmation = '') {
  const row = catalog.db.prepare('SELECT * FROM photos_actions WHERE id=?').get(id);
  if (!row) throw new Error('Unknown proposal');
  const allowed = { proposed: ['opened','skipped','error'], opened: ['manually-confirmed','skipped','error'], 'manually-confirmed': ['completed','error'], error: ['proposed','skipped'] };
  if (!allowed[row.state]?.includes(state)) throw new Error('Invalid proposal transition; opening Photos is not completion');
  if (state === 'manually-confirmed' && (typeof confirmation !== 'string' || !confirmation.trim() || confirmation.length > 500)) throw new Error('Explicit manual confirmation required');
  const data = { ...JSON.parse(row.data), updatedAt: new Date().toISOString(), ...(state === 'manually-confirmed' ? { confirmation } : {}) };
  catalog.db.prepare('UPDATE photos_actions SET state=?,data=? WHERE id=? AND state=?').run(state, JSON.stringify(data), id, row.state);
  return { id, assetId: row.asset_id, state, ...data };
}
