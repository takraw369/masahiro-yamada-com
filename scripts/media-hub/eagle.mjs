// Preparation only. No Eagle write transport is enabled before a real canary.
// The fixed loopback endpoint is never supplied by a web page or catalog data.
import { createHash } from 'node:crypto';
import { fingerprint, openSource } from './files.mjs';
import { sourceUrlFromSidecar } from './core.mjs';

export async function eaglePreflight({ fetchImpl = fetch } = {}) {
  const checkedAt = new Date().toISOString();
  try {
    const res = await fetchImpl('http://127.0.0.1:41595/api/application/info', {
      method: 'GET', redirect: 'error', signal: AbortSignal.timeout(2500), headers: { Accept: 'application/json' }
    });
    if (res.status === 401 || res.status === 403) { await res.body?.cancel(); return { state: 'authentication-required', checkedAt }; }
    if (!res.ok) { await res.body?.cancel(); return { state: 'unavailable', checkedAt }; }
    let bytes = 0; const parts = [];
    for await (const chunk of res.body) {
      bytes += chunk.length;
      if (bytes > 64 * 1024) throw new Error('oversized-response');
      parts.push(chunk);
    }
    const result = JSON.parse(Buffer.concat(parts).toString('utf8'));
    if (result.status !== 'success' || typeof result.data?.version !== 'string' || !/^\d+(\.\d+){1,3}$/.test(result.data.version)) return { state: 'unsupported-response', checkedAt };
    // Never return execPath, library contents, configuration or raw upstream errors.
    return { state: 'available', version: result.data.version,
      platform: ['darwin','win32','linux'].includes(result.data.platform) ? result.data.platform : 'unknown', checkedAt };
  } catch { return { state: 'unavailable', checkedAt }; }
}

function verifiedPhotoUrl(value) {
  if (!value || sourceUrlFromSidecar({ url: value }) !== value) return false;
  const url = new URL(value);
  return !url.search && !url.hash && !url.port && /^\/photo\/[A-Za-z0-9_-]+$/.test(url.pathname);
}

export async function prepareEagle(catalog, id, { mode = 'local-original', approveLocalCopy = false, verifiedUrl } = {}) {
  const item = catalog.getItem(id);
  if (!item || !item.available) throw new Error('Available media item required');
  if (item.reviewStatus !== 'reviewed' || item.priority === 'UNREVIEWED' || item.privacy === 'UNREVIEWED' || item.rights === 'UNREVIEWED') throw new Error('Review priority, privacy and rights before Eagle preparation');
  if (!['local-original','bookmark'].includes(mode)) throw new Error('Unsupported handoff mode');
  const root = catalog.getSetting('root');
  const { handle, info, full } = await openSource(root, item.relativePath);
  await handle.close();
  const recorded = catalog.db.prepare('SELECT fingerprint FROM assets WHERE id=?').get(id);
  if (fingerprint(info) !== recorded.fingerprint) throw new Error('Source changed; rescan and review before handoff');
  const marker = 'masa-media-' + createHash('sha256').update(root + '\0' + id).digest('hex').slice(0, 24);
  const tags = ['MASA-Media-Hub', marker, item.category, 'priority:' + item.priority, ...(item.tags || [])];
  let transport;
  if (mode === 'bookmark') {
    if (!verifiedPhotoUrl(verifiedUrl) || verifiedUrl !== item.sourceUrl) throw new Error('A manually verified, durable Photos photo URL is required; export links alone are unverified');
    transport = { api: 'Eagle Plugin API', method: 'eagle.item.addBookmark', args: [verifiedUrl, { name: item.filename, tags, annotation: marker }] };
  } else {
    if (!approveLocalCopy) throw new Error('Selected original copy needs --approve-local-copy; no automatic whole-library copies');
    transport = { api: 'Eagle localhost HTTP API', method: 'POST /api/item/addFromPath',
      body: { path: full, name: item.filename, tags, annotation: marker } };
  }
  const plan = { id, marker, mode, bytesToCopy: mode === 'bookmark' ? 0 : item.bytes,
    fingerprint: recorded.fingerprint, reviewedAt: item.reviewedAt, transport,
    gate: 'real-takeout-canary-and-single-item-approval', executionEnabled: false };
  const previous = catalog.db.prepare('SELECT data FROM eagle_queue WHERE id=?').get(id);
  if (previous) {
    const saved = JSON.parse(previous.data);
    if (saved.fingerprint === plan.fingerprint && saved.reviewedAt === plan.reviewedAt && saved.mode === plan.mode) return saved;
  }
  plan.preparedAt = new Date().toISOString();
  // Pending means prepared, never delivered. An eventual adapter must reconcile marker receipts
  // after a timeout/crash instead of blindly repeating a possibly successful write.
  catalog.db.prepare('INSERT OR REPLACE INTO eagle_queue VALUES (?,?,?)').run(id, 'pending', JSON.stringify(plan));
  return plan;
}

export function eagleQueue(catalog) {
  return catalog.db.prepare('SELECT id,state,data FROM eagle_queue ORDER BY id LIMIT 100').all().map(row => ({ id: row.id, state: row.state, ...JSON.parse(row.data) }));
}
