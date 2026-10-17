import http from 'node:http';
import { readFile, realpath } from 'node:fs/promises';
import { randomBytes } from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { LIMITATIONS } from './catalog.mjs';
import { openSource } from './files.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const contentTypes = {
  '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png', '.webp': 'image/webp', '.gif': 'image/gif',
  '.heic': 'image/heic', '.heif': 'image/heif', '.avif': 'image/avif', '.tif': 'image/tiff', '.tiff': 'image/tiff',
  '.bmp': 'image/bmp', '.mov': 'video/quicktime', '.mp4': 'video/mp4', '.m4v': 'video/mp4',
  '.webm': 'video/webm', '.mkv': 'video/x-matroska', '.avi': 'video/x-msvideo', '.3gp': 'video/3gpp',
  '.mts': 'video/mp2t', '.m2ts': 'video/mp2t'
};
const json = (r, status, obj) => { r.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' }); r.end(JSON.stringify(obj)); };

export async function startLocalMediaHub(index, { port = 0 } = {}) {
  const isCatalog = typeof index.query === 'function';
  const rootReal = await realpath(isCatalog ? index.getSetting('root') : index.root);
  const token = randomBytes(24).toString('hex');
  const itemById = isCatalog ? null : new Map(index.items.map(x => [x.id, x]));
  const base = '/' + token;
  const server = http.createServer(async (req, res) => {
    res.setHeader('Cache-Control', 'private, no-store');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Referrer-Policy', 'no-referrer');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('Cross-Origin-Resource-Policy', 'same-origin');
    res.setHeader('Content-Security-Policy', "default-src 'none'; script-src 'self'; style-src 'self'; img-src 'self' data:; media-src 'self'; connect-src 'self'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'");
    if (req.method !== 'GET' || !/^(127\.0\.0\.1|localhost)(:\d+)?$/.test(req.headers.host || '')) return json(res, 403, { error: 'Access denied' });
    let url;
    try { url = new URL(req.url, 'http://127.0.0.1'); } catch { return json(res, 400, { error: 'Bad URL' }); }
    if (!url.pathname.startsWith(base + '/') && url.pathname !== base) return json(res, 404, { error: 'Not found' });
    const endpoint = url.pathname.slice(base.length);
    try {
      if (endpoint === '' || endpoint === '/') {
        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
        res.end(await readFile(path.join(here, 'index.html')));
        return;
      }
      if (endpoint === '/app.js' || endpoint === '/app.css') {
        res.writeHead(200, { 'Content-Type': endpoint.endsWith('.css') ? 'text/css; charset=utf-8' : 'text/javascript; charset=utf-8' });
        res.end(await readFile(path.join(here, endpoint.slice(1))));
        return;
      }
      if (endpoint === '/api/summary') return json(res, 200, {
        summary: isCatalog ? index.summary() : index.summary, limitations: isCatalog ? LIMITATIONS : index.limitations,
        createdAt: isCatalog ? index.getSetting('scan')?.startedAt : index.createdAt, warnings: isCatalog ? [] : index.warnings.slice(0, 20)
      });
      if (endpoint === '/api/items') {
        const q = (url.searchParams.get('q') || '').toLocaleLowerCase().slice(0, 180);
        const category = url.searchParams.get('category') || '';
        const kind = url.searchParams.get('kind') || '';
        const dup = url.searchParams.get('duplicates') || '';
        const offset = Math.max(0, Math.min(1000000, Number.parseInt(url.searchParams.get('offset') || '0', 10) || 0));
        const limit = Math.max(1, Math.min(72, Number.parseInt(url.searchParams.get('limit') || '48', 10) || 48));
        if (isCatalog) return json(res, 200, index.query({ q, category, kind, duplicates: dup, offset, limit, priority: url.searchParams.get('priority') || '' }));
        const filtered = index.items.filter(item => (!q || (item.filename + ' ' + item.relativePath + ' ' + item.description).toLocaleLowerCase().includes(q))
          && (!category || item.category === category) && (!kind || item.kind === kind)
          && (!dup || item.duplicateStatus !== 'none'));
        return json(res, 200, { total: filtered.length, offset, limit, items: filtered.slice(offset, offset + limit) });
      }
      if (endpoint.startsWith('/media/')) {
        const id = endpoint.slice('/media/'.length);
        if (!/^[a-f0-9]{24}$/.test(id)) return json(res, 400, { error: 'Invalid ID' });
        const item = isCatalog ? index.getItem(id) : itemById.get(id);
        if (!item) return json(res, 404, { error: 'Not found' });
        const mime = contentTypes[path.extname(item.relativePath).toLowerCase()];
        if (!mime) return json(res, 415, { error: 'Unsupported preview' });
        const { handle, info: fileStat } = await openSource(rootReal, item.relativePath);
        // Stream the verified open descriptor, not a path that can be replaced between checks.
        const stream = options => {
          const source = handle.createReadStream(options);
          res.once('close', () => source.destroy());
          source.on('error', () => res.destroy()).pipe(res);
        };
        const size = fileStat.size;
        const range = req.headers.range;
        if (range) {
          const match = /^bytes=(\d+)-(\d*)$/.exec(range);
          if (!match || size === 0) { await handle.close(); res.writeHead(416, { 'Content-Range': 'bytes */' + size }); return res.end(); }
          const start = Number(match[1]);
          const end = match[2] ? Math.min(size - 1, Number(match[2])) : size - 1;
          if (!Number.isSafeInteger(start) || !Number.isSafeInteger(end) || start >= size || end < start) {
            await handle.close();
            res.writeHead(416, { 'Content-Range': 'bytes */' + size }); return res.end();
          }
          res.writeHead(206, { 'Content-Type': mime, 'Content-Range': 'bytes ' + start + '-' + end + '/' + size, 'Content-Length': end - start + 1, 'Accept-Ranges': 'bytes' });
          return stream({ start, end });
        }
        res.writeHead(200, { 'Content-Type': mime, 'Content-Length': size, 'Accept-Ranges': 'bytes' });
        return stream({});
      }
      json(res, 404, { error: 'Not found' });
    } catch (e) { if (!res.headersSent) json(res, 500, { error: 'Local file unavailable' }); else res.destroy(); }
  });
  await new Promise((resolve, reject) => { server.once('error', reject); server.listen(port, '127.0.0.1', resolve); });
  return { server, url: 'http://127.0.0.1:' + server.address().port + base + '/' };
}
