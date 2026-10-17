// Rebuildable local media index; MASA OS remains the knowledge/content canonical.
// Node 22.18+ bundled SQLite, no server or additional dependency.
import { DatabaseSync } from 'node:sqlite';
import { closeSync, constants, fstatSync, lstatSync, mkdirSync, openSync, chmodSync } from 'node:fs';
import path from 'node:path';
import { normalize } from './files.mjs';

const CATEGORIES = ['LIFE', 'KNOWLEDGE', 'CREATIVE', 'EVIDENCE', 'UNSORTED'];
export const LIMITATIONS = ['ローカル・原本読み取り専用', '分類はファイル名等による暫定推定（画像内容のAI解析は未実装）', 'TakeoutのsourceUrlは未検証。原本同期やアルバム操作は未実装', '同サイズのみの重複候補は未確認'];
const parse = row => row ? JSON.parse(row.data) : null;

export class MediaCatalog {
  constructor(filename) {
    this.filename = filename;
    if (filename !== ':memory:') {
      mkdirSync(path.dirname(filename), { recursive: true, mode: 0o700 });
      // Reject links rather than chmod/write their target, including private state.
      const parent = lstatSync(path.dirname(filename));
      if (!parent.isDirectory() || parent.isSymbolicLink()) throw new Error('Catalog directory must not be a symlink');
      chmodSync(path.dirname(filename), 0o700);
      if (process.platform !== 'win32' && (lstatSync(path.dirname(filename)).mode & 0o077)) throw new Error('Report filesystem must enforce private permissions; choose an APFS/private report directory');
      const fd = openSync(filename, constants.O_CREAT | constants.O_RDWR | constants.O_NOFOLLOW, 0o600);
      try { if (!fstatSync(fd).isFile() || fstatSync(fd).nlink !== 1) throw new Error('Catalog must be a private regular file, without hard links'); }
      finally { closeSync(fd); }
      if (!lstatSync(filename).isFile()) throw new Error('Catalog must be a regular file');
      chmodSync(filename, 0o600);
      if (process.platform !== 'win32' && (lstatSync(filename).mode & 0o077)) throw new Error('Catalog filesystem cannot enforce private permissions');
    }
    this.db = new DatabaseSync(filename);
    this.db.exec(`PRAGMA journal_mode=DELETE; PRAGMA synchronous=FULL; PRAGMA foreign_keys=ON;
      PRAGMA busy_timeout=1000; PRAGMA cache_size=-8192; PRAGMA temp_store=FILE;
      PRAGMA max_page_count=524288;
      CREATE TABLE IF NOT EXISTS settings(key TEXT PRIMARY KEY, data TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS tasks(path TEXT PRIMARY KEY, type TEXT NOT NULL, done INTEGER NOT NULL DEFAULT 0);
      CREATE INDEX IF NOT EXISTS task_pending ON tasks(done,type,path);
      CREATE INDEX IF NOT EXISTS task_order ON tasks(done,path);
      CREATE TABLE IF NOT EXISTS sidecars(path TEXT PRIMARY KEY, folder TEXT, title TEXT, fingerprint TEXT, data TEXT, used_by TEXT, run TEXT);
      CREATE INDEX IF NOT EXISTS sidecar_title ON sidecars(folder,title,run);
      CREATE TABLE IF NOT EXISTS assets(id TEXT PRIMARY KEY, path TEXT UNIQUE, bytes INTEGER, kind TEXT,
        category TEXT, fingerprint TEXT, hash TEXT, duplicate_status TEXT DEFAULT 'none', duplicate_group TEXT,
        run TEXT, data TEXT NOT NULL);
      CREATE INDEX IF NOT EXISTS asset_path ON assets(path);
      CREATE INDEX IF NOT EXISTS asset_bytes ON assets(bytes);
      CREATE INDEX IF NOT EXISTS asset_hash ON assets(hash);
      CREATE INDEX IF NOT EXISTS asset_run ON assets(run);
      CREATE INDEX IF NOT EXISTS asset_run_cursor ON assets(run,id);
      CREATE TABLE IF NOT EXISTS reviews(id TEXT PRIMARY KEY REFERENCES assets(id), data TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS audit(path TEXT, code TEXT, PRIMARY KEY(path,code));
      CREATE VIRTUAL TABLE IF NOT EXISTS search USING fts5(id UNINDEXED,text,tokenize='trigram');
      CREATE TABLE IF NOT EXISTS eagle_queue(id TEXT PRIMARY KEY REFERENCES assets(id), state TEXT NOT NULL, data TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS photos_actions(id TEXT PRIMARY KEY, asset_id TEXT REFERENCES assets(id), state TEXT, data TEXT NOT NULL);`);
    const version = this.getSetting('schemaVersion');
    if (version && version !== 2) { this.close(); throw new Error('Unsupported catalog schema'); }
    this.setSetting('schemaVersion', 2);
  }
  close() { this.db.close(); }
  getSetting(key) { return parse(this.db.prepare('SELECT data FROM settings WHERE key=?').get(key)); }
  setSetting(key, data) { this.db.prepare('INSERT OR REPLACE INTO settings VALUES (?,?)').run(key, JSON.stringify(data)); }
  transaction(fn) {
    this.db.exec('BEGIN IMMEDIATE');
    try { const result = fn(); this.db.exec('COMMIT'); return result; }
    catch (e) {
      // SQLITE_FULL/IOERR may already roll back the transaction. Preserve the original error.
      try { this.db.exec('ROLLBACK'); } catch {}
      throw e;
    }
  }
  audit(rel, code) { this.db.prepare('INSERT OR IGNORE INTO audit VALUES (?,?)').run(rel, code); }
  audits({ offset = 0, limit = 100 } = {}) {
    return this.db.prepare('SELECT path,code FROM audit ORDER BY path,code LIMIT ? OFFSET ?').all(Math.min(500, Math.max(1, limit)), Math.max(0, offset));
  }
  getItem(id) {
    const row = this.db.prepare(`SELECT a.*,r.data review FROM assets a LEFT JOIN reviews r ON r.id=a.id WHERE a.id=?`).get(id);
    if (!row) return null;
    const scan = this.getSetting('scan');
    const review = row.review ? JSON.parse(row.review) : null;
    return { ...JSON.parse(row.data), available: scan?.state !== 'complete' || scan.id === row.run,
      duplicateStatus: row.duplicate_status, duplicateGroup: row.duplicate_group,
      ...(review ? { ...review, ...(review.category ? { categoryReason: '手動確認' } : {}), reviewStatus: review.reviewedFingerprint === row.fingerprint ? 'reviewed' : 'stale' } : { reviewStatus: 'suggested' }),
      categoryReviewStatus: review?.category ? 'reviewed' : 'suggested' };
  }
  reindex(id) {
    const item = this.getItem(id);
    const { rowid } = this.db.prepare('SELECT rowid FROM assets WHERE id=?').get(id);
    this.db.prepare('DELETE FROM search WHERE rowid=?').run(rowid);
    this.db.prepare('INSERT INTO search(rowid,id,text) VALUES (?,?,?)').run(rowid, id, normalize([
      item.filename, item.relativePath, item.description, item.category, ...(item.tags || []), item.project || '', item.topic || '', ...(item.albums || []).map(a => a.title)
    ].join(' ')));
  }
  review(id, patch) {
    if (!this.getItem(id)) throw new Error('Unknown media ID');
    const allowed = new Set(['category', 'priority', 'tags', 'project', 'topic', 'privacy', 'rights', 'useStatus']);
    if (!patch || Array.isArray(patch) || typeof patch !== 'object' || Object.keys(patch).some(k => !allowed.has(k))) throw new Error('Invalid review fields');
    if (patch.category !== undefined && !CATEGORIES.includes(patch.category)) throw new Error('Invalid category');
    if (patch.priority !== undefined && !['S','A','B','C','UNREVIEWED'].includes(patch.priority)) throw new Error('Invalid priority');
    if (patch.tags !== undefined && (!Array.isArray(patch.tags) || patch.tags.length > 30 || patch.tags.some(t => typeof t !== 'string' || !t.trim() || t.length > 80))) throw new Error('Invalid tags');
    for (const key of ['project','topic','privacy','rights','useStatus']) if (patch[key] !== undefined && (typeof patch[key] !== 'string' || patch[key].length > 240)) throw new Error('Invalid review text');
    this.transaction(() => {
      const previous = parse(this.db.prepare('SELECT data FROM reviews WHERE id=?').get(id)) || {};
      const { fingerprint } = this.db.prepare('SELECT fingerprint FROM assets WHERE id=?').get(id);
      this.db.prepare('INSERT OR REPLACE INTO reviews VALUES (?,?)').run(id, JSON.stringify({ ...previous, ...patch, reviewedFingerprint: fingerprint, reviewedAt: new Date().toISOString() }));
      this.reindex(id);
    });
    return this.getItem(id);
  }
  query({ q = '', category = '', kind = '', duplicates = '', priority = '', offset = 0, limit = 48 } = {}) {
    q = normalize(q).slice(0, 180);
    offset = Number.isSafeInteger(+offset) ? Math.max(0, +offset) : 0;
    limit = Number.isSafeInteger(+limit) ? Math.max(1, Math.min(72, +limit)) : 48;
    const where = [], params = [];
    const scan = this.getSetting('scan');
    if (scan?.state === 'complete') { where.push('a.run=?'); params.push(scan.id); }
    if (q) {
      // Trigram FTS preserves Japanese substring search; short queries use bounded-memory SQL.
      if ([...q].length >= 3) { where.push('a.id IN (SELECT id FROM search WHERE text MATCH ?)'); params.push('"' + q.replaceAll('"', '""') + '"'); }
      else { where.push('a.id IN (SELECT id FROM search WHERE instr(text,?)>0)'); params.push(q); }
    }
    if (category) { where.push("coalesce(json_extract(r.data,'$.category'),a.category)=?"); params.push(category); }
    if (kind) { where.push('a.kind=?'); params.push(kind); }
    if (priority) { where.push("coalesce(json_extract(r.data,'$.priority'),'UNREVIEWED')=?"); params.push(priority); }
    if (duplicates) where.push("a.duplicate_status<>'none'");
    const from = `FROM assets a LEFT JOIN reviews r ON r.id=a.id ${where.length ? 'WHERE ' + where.join(' AND ') : ''}`;
    const total = this.db.prepare('SELECT count(*) n ' + from).get(...params).n;
    const rows = this.db.prepare('SELECT a.id ' + from + ' ORDER BY a.path LIMIT ? OFFSET ?').all(...params, limit, offset);
    return { total, offset, limit, items: rows.map(r => this.getItem(r.id)) };
  }
  summary() {
    const scan = this.getSetting('scan');
    const active = scan?.state === 'complete' ? ' WHERE a.run=?' : '';
    const args = scan?.state === 'complete' ? [scan.id] : [];
    const categories = Object.fromEntries(CATEGORIES.map(k => [k, 0]));
    for (const r of this.db.prepare("SELECT coalesce(json_extract(r.data,'$.category'),a.category) category,count(*) n FROM assets a LEFT JOIN reviews r ON a.id=r.id" + active + ' GROUP BY 1').all(...args)) categories[r.category] = r.n;
    const kinds = { photo: 0, video: 0 };
    for (const r of this.db.prepare('SELECT kind,count(*) n FROM assets a' + active + ' GROUP BY kind').all(...args)) kinds[r.kind] = r.n;
    const totals = this.db.prepare('SELECT count(*) count,coalesce(sum(bytes),0) totalBytes FROM assets a' + active).get(...args);
    const countGroups = sql => this.db.prepare('SELECT count(*) n FROM (' + sql + ')').get(...args).n;
    const condition = active ? active + ' AND ' : ' WHERE ';
    return { ...totals, categories, kinds,
      candidateGroups: countGroups('SELECT bytes FROM assets a' + condition + 'bytes>0 GROUP BY bytes HAVING count(*)>1'),
      confirmedGroups: countGroups('SELECT hash FROM assets a' + condition + "duplicate_status='sha256-identical' GROUP BY hash HAVING count(*)>1"),
      checkedGroups: countGroups('SELECT bytes FROM assets a' + active + ' GROUP BY bytes HAVING count(*)>1 AND count(hash)=count(*)'),
      limited: scan?.state === 'limited', scan,
      auditCounts: this.db.prepare('SELECT code,count(*) count FROM audit GROUP BY code ORDER BY code').all(),
      reviewed: this.db.prepare('SELECT count(*) n FROM reviews r JOIN assets a ON a.id=r.id' + active).get(...args).n,
      selectedSA: this.db.prepare('SELECT count(*) n FROM reviews r JOIN assets a ON a.id=r.id' + condition + "json_extract(r.data,'$.priority') IN ('S','A')").get(...args).n,
      missing: scan?.state === 'complete' ? this.db.prepare('SELECT count(*) n FROM assets WHERE run<>?').get(scan.id).n : null };
  }
}
