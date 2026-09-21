import { spawn } from 'node:child_process';
import { createServer } from 'node:http';

const APP_SERVER_HOST = '127.0.0.1';
const APP_SERVER_PORT = 4500;
const BRIDGE_HOST = '127.0.0.1';
const BRIDGE_PORT = 4510;
const APP_SERVER_WS = `ws://${APP_SERVER_HOST}:${APP_SERVER_PORT}`;
const APP_SERVER_READY = `http://${APP_SERVER_HOST}:${APP_SERVER_PORT}/readyz`;

let codexProcess = null;
let upstream = null;
let upstreamReady = false;
const eventClients = new Set();

function log(message) {
  process.stdout.write(`[codex-bridge] ${message}\n`);
}

function isAllowedOrigin(origin) {
  if (!origin) return true;
  try {
    const url = new URL(origin);
    return url.protocol === 'http:' && (url.hostname === '127.0.0.1' || url.hostname === 'localhost');
  } catch {
    return false;
  }
}

function setCors(req, res) {
  const origin = req.headers.origin;
  if (origin && isAllowedOrigin(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Vary', 'Origin');
  }
  res.setHeader('Access-Control-Allow-Headers', 'content-type');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
}

function rejectOrigin(req, res) {
  const origin = req.headers.origin;
  if (!isAllowedOrigin(origin)) {
    res.writeHead(403, { 'Content-Type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify({ error: 'Only localhost browser origins are allowed.' }));
    return true;
  }
  return false;
}

async function appServerIsReady() {
  try {
    const response = await fetch(APP_SERVER_READY, { signal: AbortSignal.timeout(500) });
    return response.ok;
  } catch {
    return false;
  }
}

function spawnCodexAppServer() {
  if (codexProcess) return;
  log(`starting: codex app-server --listen ${APP_SERVER_WS}`);
  codexProcess = spawn('codex', ['app-server', '--listen', APP_SERVER_WS], {
    cwd: process.cwd(),
    stdio: ['ignore', 'pipe', 'pipe'],
    env: process.env,
  });

  codexProcess.stdout.on('data', (chunk) => process.stdout.write(`[codex] ${chunk}`));
  codexProcess.stderr.on('data', (chunk) => process.stderr.write(`[codex] ${chunk}`));
  codexProcess.on('error', (error) => {
    log(`failed to start codex: ${error.message}`);
  });
  codexProcess.on('exit', (code, signal) => {
    log(`codex app-server exited (${signal ?? code ?? 'unknown'})`);
    codexProcess = null;
  });
}

async function ensureAppServer() {
  if (await appServerIsReady()) return;
  spawnCodexAppServer();

  for (let attempt = 0; attempt < 40; attempt += 1) {
    await new Promise((resolve) => setTimeout(resolve, 250));
    if (await appServerIsReady()) return;
    if (codexProcess?.exitCode !== null && codexProcess?.exitCode !== undefined) break;
  }

  throw new Error('Codex App Server did not become ready on 127.0.0.1:4500. Is the codex CLI installed and logged in?');
}

function normalizeMessageData(data) {
  if (typeof data === 'string') return Promise.resolve(data);
  if (data instanceof Blob) return data.text();
  if (data instanceof ArrayBuffer) return Promise.resolve(Buffer.from(data).toString('utf8'));
  if (ArrayBuffer.isView(data)) return Promise.resolve(Buffer.from(data.buffer, data.byteOffset, data.byteLength).toString('utf8'));
  return Promise.resolve(String(data));
}

function broadcastRaw(raw) {
  const payload = `data: ${raw.replace(/\r?\n/g, '\\n')}\n\n`;
  for (const res of eventClients) {
    try {
      res.write(payload);
    } catch {
      eventClients.delete(res);
    }
  }
}

function closeUpstream() {
  upstreamReady = false;
  if (upstream) {
    try {
      upstream.close();
    } catch {
      // no-op
    }
  }
  upstream = null;
}

async function openFreshUpstream() {
  await ensureAppServer();
  closeUpstream();

  return new Promise((resolve, reject) => {
    // Node's WebSocket client does not add a browser Origin header. That is
    // intentional: Codex App Server rejects Origin-bearing WebSocket upgrades.
    const ws = new WebSocket(APP_SERVER_WS);
    upstream = ws;

    const timer = setTimeout(() => {
      try { ws.close(); } catch {}
      reject(new Error('Timed out connecting to Codex App Server.'));
    }, 4000);

    ws.addEventListener('open', () => {
      clearTimeout(timer);
      upstreamReady = true;
      log('upstream session connected');
      resolve();
    });

    ws.addEventListener('message', async (event) => {
      const raw = await normalizeMessageData(event.data);
      broadcastRaw(raw);
    });

    ws.addEventListener('error', () => {
      clearTimeout(timer);
      if (!upstreamReady) reject(new Error('WebSocket connection to Codex App Server failed.'));
    });

    ws.addEventListener('close', () => {
      upstreamReady = false;
      if (upstream === ws) upstream = null;
      log('upstream session closed');
    });
  });
}

async function readJsonBody(req, maxBytes = 1024 * 1024) {
  const chunks = [];
  let size = 0;
  for await (const chunk of req) {
    size += chunk.length;
    if (size > maxBytes) throw new Error('Request body too large.');
    chunks.push(chunk);
  }
  const text = Buffer.concat(chunks).toString('utf8');
  return JSON.parse(text || '{}');
}

function sendJson(res, status, body) {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify(body));
}

const server = createServer(async (req, res) => {
  setCors(req, res);

  if (req.method === 'OPTIONS') {
    if (rejectOrigin(req, res)) return;
    res.writeHead(204);
    res.end();
    return;
  }

  if (rejectOrigin(req, res)) return;

  const url = new URL(req.url ?? '/', `http://${BRIDGE_HOST}:${BRIDGE_PORT}`);

  if (req.method === 'GET' && url.pathname === '/health') {
    sendJson(res, 200, {
      bridge: 'ok',
      appServerReady: await appServerIsReady(),
      upstreamReady,
    });
    return;
  }

  if (req.method === 'GET' && url.pathname === '/events') {
    res.writeHead(200, {
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
    });
    res.write(': connected\n\n');
    eventClients.add(res);
    req.on('close', () => eventClients.delete(res));
    return;
  }

  if (req.method === 'POST' && url.pathname === '/session') {
    try {
      await openFreshUpstream();
      sendJson(res, 200, { ok: true });
    } catch (error) {
      sendJson(res, 503, { error: error instanceof Error ? error.message : String(error) });
    }
    return;
  }

  if (req.method === 'POST' && url.pathname === '/rpc') {
    if (!upstream || !upstreamReady || upstream.readyState !== WebSocket.OPEN) {
      sendJson(res, 409, { error: 'No active upstream session. Connect the dashboard first.' });
      return;
    }

    try {
      const message = await readJsonBody(req);
      upstream.send(JSON.stringify(message));
      sendJson(res, 202, { accepted: true });
    } catch (error) {
      sendJson(res, 400, { error: error instanceof Error ? error.message : String(error) });
    }
    return;
  }

  sendJson(res, 404, { error: 'Not found' });
});

server.listen(BRIDGE_PORT, BRIDGE_HOST, async () => {
  log(`dashboard bridge listening on http://${BRIDGE_HOST}:${BRIDGE_PORT}`);
  log('browser access is restricted to localhost origins');
  try {
    await ensureAppServer();
    log(`Codex App Server ready on ${APP_SERVER_WS}`);
  } catch (error) {
    log(error instanceof Error ? error.message : String(error));
  }
});

function shutdown() {
  closeUpstream();
  for (const res of eventClients) {
    try { res.end(); } catch {}
  }
  eventClients.clear();
  if (codexProcess && codexProcess.exitCode === null) {
    codexProcess.kill('SIGTERM');
  }
  server.close(() => process.exit(0));
  setTimeout(() => process.exit(0), 1000).unref();
}

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
