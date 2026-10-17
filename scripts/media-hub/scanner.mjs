import { randomUUID } from 'node:crypto';
import { lstat, mkdir, open, opendir, realpath, stat, statfs, unlink } from 'node:fs/promises';
import path from 'node:path';
import { MediaCatalog } from './catalog.mjs';
import { categorySuggestion, sourceUrlFromSidecar } from './core.mjs';
import { fingerprint, hashSource, PHOTO_EXT, VIDEO_EXT, SKIP_DIRS, readMetadata, safePath, stableId } from './files.mjs';

function dateMetadata(meta, mtime) {
  for (const [value, source] of [[meta?.photoTakenTime?.timestamp, 'takeout'], [meta?.creationTime?.timestamp, 'takeout-created']]) {
    if (value === undefined || value === null || value === '') continue;
    const n = Number(value);
    if (Number.isFinite(n) && n >= 0 && n < 5000000000) return { takenAt: new Date(n * 1000).toISOString(), dateSource: source };
  }
  return { takenAt: new Date(mtime).toISOString(), dateSource: 'file-mtime' };
}
function safeError(e) {
  return ['EACCES','ENOENT','ENOSPC','EPERM','EIO','ELOOP','EMFILE'].includes(e.code) ? e.code :
    ['symlink','outside-root','unsafe-path','source-changed','oversized-sidecar','invalid-sidecar'].includes(e.message) ? e.message : 'read-error';
}

async function matchSidecar(catalog, rel, run) {
  const folder = path.posix.dirname(rel), name = path.posix.basename(rel);
  const duplicate = /^(.*)(\(\d+\))(\.[^.]+)$/.exec(name);
  const bases = [name, ...(duplicate ? [duplicate[1] + duplicate[3] + duplicate[2]] : [])];
  for (const base of bases) for (const suffix of ['.supplemental-metadata.json', '.json']) {
    const row = catalog.db.prepare('SELECT * FROM sidecars WHERE path=? AND run=?').get(path.posix.join(folder === '.' ? '' : folder, base + suffix), run);
    if (row && (!row.used_by || row.used_by === rel)) return { meta: JSON.parse(row.data), path: row.path, status: 'filename' };
  }
  // Truncated names are accepted only with an exact, unique metadata title in this folder.
  // Duplicate/edited filenames are never inferred from a shared title alone.
  const rows = catalog.db.prepare('SELECT * FROM sidecars WHERE folder=? AND title=? AND run=? LIMIT 2').all(folder, name.normalize('NFC'), run);
  if (rows.length === 1 && (!rows[0].used_by || rows[0].used_by === rel)) return { meta: JSON.parse(rows[0].data), path: rows[0].path, status: 'unique-title' };
  return { meta: null, path: null, status: rows.length > 1 ? 'ambiguous' : 'missing' };
}

async function outputDirectory(root, outDir) {
  const requested = path.resolve(outDir);
  let ancestor = requested;
  const tail = [];
  while (true) {
    try { ancestor = await realpath(ancestor); break; }
    catch (e) { if (e.code !== 'ENOENT') throw e; tail.unshift(path.basename(ancestor)); ancestor = path.dirname(ancestor); }
  }
  const dest = path.join(ancestor, ...tail);
  if (dest === root || dest.startsWith(root + path.sep)) throw new Error('Report directory must be outside the Takeout source');
  await mkdir(dest, { recursive: true, mode: 0o700 });
  return dest;
}

export async function scanCatalog(rootArg, { outDir, limit = 500, resume = false, hashMaxBytes = 128 * 1024 * 1024,
  hashBudgetBytes = 1024 * 1024 * 1024, minFreeBytes = 512 * 1024 * 1024, signal, onProgress = () => {} } = {}) {
  for (const [key, n] of Object.entries({ limit, hashMaxBytes, hashBudgetBytes, minFreeBytes })) if (!Number.isSafeInteger(n) || n < 0) throw new Error('Invalid ' + key);
  const root = await realpath(rootArg);
  if (!(await stat(root)).isDirectory()) throw new Error('Input must be an extracted Takeout directory');
  if (!outDir) throw new Error('Private report directory required');
  const dest = await outputDirectory(root, outDir);
  const filename = path.join(dest, 'media-index.sqlite');
  const lockPath = filename + '.scan.lock';
  let lock;
  try { lock = await open(lockPath, 'wx', 0o600); }
  catch (e) { if (e.code === 'EEXIST') throw new Error('Scan lock exists. Ensure no scanner is running before removing media-index.sqlite.scan.lock, then --resume'); throw e; }
  let catalog, scan;
  try {
    await lock.writeFile(String(process.pid));
    catalog = new MediaCatalog(filename);
    if (catalog.getSetting('root') && catalog.getSetting('root') !== root) throw new Error('Catalog belongs to another source; choose a separate report directory');
    catalog.setSetting('root', root);
    const previous = catalog.getSetting('scan');
    if (resume && !previous) throw new Error('No scan to resume');
    if (resume && previous.state === 'complete') throw new Error('Scan is complete; omit --resume for an incremental rescan');
    scan = resume ? { ...previous, discovered: catalog.db.prepare("SELECT count(*) n FROM tasks WHERE type='media'").get().n,
      state: 'running', phase: previous.state === 'incomplete' ? 'inventory' : previous.phase, limit, resumedAt: new Date().toISOString() } : {
      id: randomUUID(), state: 'running', phase: 'inventory', startedAt: new Date().toISOString(), limit, discovered: 0, processed: 0, reused: 0, hashedBytes: 0
    };
    if (resume) catalog.db.exec('UPDATE tasks SET done=0 WHERE done=2');
    if (!resume) catalog.transaction(() => {
      catalog.db.exec("DELETE FROM tasks; DELETE FROM audit; INSERT INTO tasks(path,type) VALUES ('','dir')");
      catalog.db.exec('UPDATE sidecars SET used_by=NULL');
    });
    catalog.setSetting('scan', scan);
    let budget = hashBudgetBytes, ticks = 0, lastDiscoveryProgress = 0;
    const checkpoint = () => { catalog.setSetting('scan', scan); onProgress({ ...scan }); };
    const diskCheck = async () => {
      const fs = await statfs(dest);
      if (fs.bavail * fs.bsize < minFreeBytes) throw new Error('Insufficient free space; scan can be resumed after freeing report disk space');
    };
    await diskCheck();
    while (!signal?.aborted && scan.phase === 'inventory') {
      const task = catalog.db.prepare("SELECT path,type FROM tasks WHERE done=0 AND type IN ('dir','media') ORDER BY path LIMIT 1").get();
      if (!task) { scan.phase = 'duplicates'; break; }
      if (limit && scan.processed >= limit) { scan.state = 'limited'; break; }
      if (task.type === 'dir') {
        let directory;
        try {
          const full = task.path ? await safePath(root, task.path) : root;
          directory = await opendir(full);
        } catch (e) {
          catalog.transaction(() => { catalog.audit(task.path, 'directory-' + safeError(e)); catalog.db.prepare('UPDATE tasks SET done=2 WHERE path=?').run(task.path); });
          continue;
        }
        let batch = [];
        const flush = () => {
          let discovered = scan.discovered;
          catalog.transaction(() => {
          for (const entry of batch) {
            if (entry.audit) catalog.audit(entry.rel, entry.audit);
            if (entry.type) {
              const added = catalog.db.prepare('INSERT OR IGNORE INTO tasks(path,type,done) VALUES (?,?,?)').run(entry.rel, entry.type, entry.type === 'sidecar' ? 1 : 0);
              if (entry.type === 'media') discovered += added.changes;
            }
            if (entry.sidecar) catalog.db.prepare('INSERT OR REPLACE INTO sidecars VALUES (?,?,?,?,?,?,?)').run(entry.rel, path.posix.dirname(entry.rel), entry.sidecar.title, entry.fingerprint, JSON.stringify(entry.sidecar), null, scan.id);
          }
          batch = [];
          catalog.setSetting('scan', { ...scan, discovered });
          });
          scan.discovered = discovered;
          if (Date.now() - lastDiscoveryProgress >= 1000) { onProgress({ ...scan, phase: 'discovery' }); lastDiscoveryProgress = Date.now(); }
        };
        for await (const entry of directory) {
          if (signal?.aborted) break;
          const rel = task.path ? task.path + '/' + entry.name : entry.name;
          // macOS writes AppleDouble resource forks on ExFAT/other volumes.
          // Their photo/JSON suffix does not make them media or Takeout sidecars.
          if (entry.name.startsWith('._')) batch.push({ rel, audit: 'skipped-appledouble' });
          else if (entry.isSymbolicLink()) batch.push({ rel, audit: 'skipped-symlink' });
          else if (entry.isDirectory()) {
            if (!entry.name.startsWith('.') && !SKIP_DIRS.has(entry.name)) batch.push({ rel, type: 'dir' });
          } else if (entry.isFile()) {
            const ext = path.extname(entry.name).toLowerCase();
            if (PHOTO_EXT.has(ext) || VIDEO_EXT.has(ext)) batch.push({ rel, type: 'media' });
            else if (ext === '.json') {
              try {
                const fp = fingerprint(await lstat(await safePath(root, rel)));
                const cached = catalog.db.prepare('SELECT fingerprint,data FROM sidecars WHERE path=?').get(rel);
                const unchanged = cached?.fingerprint === fp;
                const meta = unchanged ? JSON.parse(cached.data) : await readMetadata(root, rel);
                const timestamp = field => ['string','number'].includes(typeof field?.timestamp) ? { timestamp: String(field.timestamp).slice(0, 40) } : undefined;
                const sidecar = { title: typeof meta.title === 'string' ? meta.title.normalize('NFC').slice(0, 1000) : null,
                  description: typeof meta.description === 'string' ? meta.description.slice(0, 1200) : '',
                  photoTakenTime: timestamp(meta.photoTakenTime), creationTime: timestamp(meta.creationTime), url: sourceUrlFromSidecar(meta),
                  album: unchanged ? meta.album : (entry.name === 'metadata.json' && typeof meta.title === 'string' && typeof meta.access === 'string' ? { title: meta.title.slice(0, 240), evidence: 'takeout-album-metadata' } : null) };
                batch.push({ rel, type: 'sidecar', sidecar, fingerprint: fp });
              } catch (e) { batch.push({ rel, audit: e instanceof SyntaxError ? 'malformed-sidecar' : 'sidecar-' + safeError(e) }); }
            } else if (!entry.name.startsWith('.')) batch.push({ rel, audit: 'unsupported-file' });
          }
          if (batch.length >= 256) { flush(); await diskCheck(); }
        }
        flush();
        if (!signal?.aborted) catalog.db.prepare('UPDATE tasks SET done=1 WHERE path=?').run(task.path);
      } else {
        try {
          const info = await lstat(await safePath(root, task.path));
          if (!info.isFile()) throw new Error('source-changed');
          const fp = fingerprint(info), id = stableId(task.path);
          const existing = catalog.db.prepare('SELECT fingerprint,hash,data FROM assets WHERE id=?').get(id);
          const match = await matchSidecar(catalog, task.path, scan.id);
          const ext = path.extname(task.path).toLowerCase();
          const [category, categoryReason] = categorySuggestion(task.path);
          const folder = path.posix.dirname(task.path);
          const albumMeta = catalog.db.prepare('SELECT data FROM sidecars WHERE path=? AND run=?').get(path.posix.join(folder === '.' ? '' : folder, 'metadata.json'), scan.id);
          const exportedAlbum = albumMeta ? JSON.parse(albumMeta.data).album : null;
          const automaticYear = value => /^(?:photos from )?\d{4}(?:年の写真)?$/i.test(value);
          const album = exportedAlbum && !automaticYear(path.posix.basename(folder)) && !automaticYear(exportedAlbum.title) ? exportedAlbum : null;
          const sourceUrl = sourceUrlFromSidecar(match.meta);
          const item = { id, relativePath: task.path, filename: path.posix.basename(task.path), kind: VIDEO_EXT.has(ext) ? 'video' : 'photo',
            ext, bytes: info.size, ...dateMetadata(match.meta, info.mtimeMs), category, categoryReason, priority: 'UNREVIEWED',
            description: match.meta?.description || '', sourceFolder: folder, albums: album ? [album] : [],
            metadataStatus: match.status, sourceUrl, sourceUrlStatus: sourceUrl ? 'export-supplied-unverified' : 'unavailable',
            privacy: 'UNREVIEWED', rights: 'UNREVIEWED', useStatus: 'UNREVIEWED', duplicateGroup: null, duplicateStatus: 'none' };
          const serialized = JSON.stringify(item);
          const unchanged = existing?.fingerprint === fp && existing.data === serialized;
          const next = { ...scan, processed: scan.processed + 1, reused: scan.reused + (existing?.fingerprint === fp ? 1 : 0) };
          catalog.transaction(() => {
            if (unchanged) catalog.db.prepare('UPDATE assets SET run=? WHERE id=?').run(scan.id, id);
            else catalog.db.prepare(`INSERT INTO assets(id,path,bytes,kind,category,fingerprint,hash,run,data) VALUES (?,?,?,?,?,?,?,?,?)
              ON CONFLICT(id) DO UPDATE SET bytes=excluded.bytes,kind=excluded.kind,category=excluded.category,
              fingerprint=excluded.fingerprint,hash=excluded.hash,run=excluded.run,data=excluded.data,duplicate_status='none',duplicate_group=NULL`)
              .run(id, task.path, info.size, item.kind, category, fp, existing?.fingerprint === fp ? existing.hash : null, scan.id, serialized);
            if (match.path) catalog.db.prepare('UPDATE sidecars SET used_by=? WHERE path=?').run(task.path, match.path);
            else catalog.audit(task.path, match.status + '-sidecar');
            if (info.size === 0) catalog.audit(task.path, 'empty-media');
            catalog.db.prepare('UPDATE tasks SET done=1 WHERE path=?').run(task.path);
            if (!unchanged) catalog.reindex(id);
            catalog.setSetting('scan', next);
          });
          scan = next;
        } catch (e) {
          // Database/disk failures must stop and preserve pending work, never masquerade as unreadable media.
          if (e.code?.startsWith('ERR_SQLITE') || e.code === 'ENOSPC') throw e;
          catalog.transaction(() => { catalog.audit(task.path, 'media-' + safeError(e)); catalog.db.prepare('UPDATE tasks SET done=2 WHERE path=?').run(task.path); });
        }
      }
      if (++ticks % 100 === 0) { await diskCheck(); checkpoint(); }
    }
    if ((scan.phase === 'duplicates' || scan.state === 'limited') && !signal?.aborted) {
      catalog.db.exec("UPDATE assets SET duplicate_status='none',duplicate_group=NULL");
      catalog.db.prepare(`UPDATE assets SET duplicate_status='same-size-unverified' WHERE bytes>0 AND run=?
        AND bytes IN (SELECT bytes FROM assets WHERE run=? GROUP BY bytes HAVING count(*)>1)`).run(scan.id, scan.id);
      let cursor = '';
      while (!signal?.aborted) {
        const rows = catalog.db.prepare(`SELECT id,path,bytes,fingerprint,hash FROM assets WHERE id>? AND run=? AND duplicate_status='same-size-unverified' ORDER BY id LIMIT 128`).all(cursor, scan.id);
        if (!rows.length) break;
        for (const row of rows) {
          if (signal?.aborted) break;
          cursor = row.id;
          if (row.hash) {
            try {
              if (fingerprint(await lstat(await safePath(root, row.path))) !== row.fingerprint) throw new Error('source-changed');
            } catch (e) {
              catalog.db.prepare('UPDATE assets SET hash=NULL WHERE id=?').run(row.id);
              catalog.audit(row.path, 'hash-' + safeError(e));
            }
            continue;
          }
          if (!hashMaxBytes || row.bytes > hashMaxBytes || row.bytes > budget) continue;
          try {
            const hash = await hashSource(root, row.path, row.fingerprint, signal);
            catalog.db.prepare('UPDATE assets SET hash=? WHERE id=?').run(hash, row.id);
            scan.hashedBytes += row.bytes; budget -= row.bytes;
          } catch (e) { if (!signal?.aborted) catalog.audit(row.path, 'hash-' + safeError(e)); }
        }
        await diskCheck(); checkpoint();
      }
      catalog.db.prepare(`UPDATE assets SET duplicate_status='sha256-identical',duplicate_group=substr(hash,1,20)
        WHERE run=? AND hash IN (SELECT hash FROM assets WHERE run=? AND hash IS NOT NULL GROUP BY hash HAVING count(*)>1)`).run(scan.id, scan.id);
      catalog.db.prepare(`UPDATE assets SET duplicate_status='none' WHERE run=? AND hash IS NOT NULL AND duplicate_status='same-size-unverified'
        AND bytes NOT IN (SELECT bytes FROM assets WHERE run=? AND hash IS NULL)`).run(scan.id, scan.id);
      if (!signal?.aborted && scan.state !== 'limited') {
        catalog.db.prepare("INSERT OR IGNORE INTO audit SELECT path,'unmatched-sidecar' FROM sidecars WHERE run=? AND used_by IS NULL AND json_extract(data,'$.album') IS NULL").run(scan.id);
        scan.state = catalog.db.prepare('SELECT count(*) n FROM tasks WHERE done=2').get().n ? 'incomplete' : 'complete';
      }
    }
    if (signal?.aborted) scan.state = 'cancelled';
    scan.updatedAt = new Date().toISOString(); checkpoint();
    return { filename, summary: catalog.summary() };
  } catch (e) {
    if (catalog && scan) { scan.state = 'failed'; try { catalog.setSetting('scan', scan); } catch {} }
    throw e;
  } finally {
    catalog?.close();
    await lock.close(); await unlink(lockPath);
  }
}
