import assert from 'node:assert/strict';
import test from 'node:test';
import { execFileSync } from 'node:child_process';
import { copyFile, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
function findChrome() {
  for (const name of [process.env.CHROME_BIN, 'google-chrome', 'google-chrome-stable', 'chromium', 'chromium-browser'].filter(Boolean)) {
    try {
      const found = execFileSync('which', [name], { encoding: 'utf8' }).trim();
      if (found) return found;
    } catch { /* try next */ }
  }
  return null;
}

const fixture = String.raw`<!doctype html><html lang="ja"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><link rel="stylesheet" href="./flow-frame.css"></head>
<body><main id="flow-frame" class="ff">
  <label id="ff-drop"><input id="ff-file" type="file" accept="image/png,image/jpeg,image/webp,image/avif"><span id="ff-file-name"></span></label>
  <input id="ff-brand" value="SUN LOVES FLOW"><textarea id="ff-title">迷いから自信へ</textarea>
  <textarea id="ff-description">今日の小さな一歩を、明日へ。</textarea><input id="ff-cta" value="FLOW">
  <input id="ff-source-url" value="">
  <select id="ff-theme"><option value="orange">Orange</option><option value="cream">Cream</option><option value="night">Night</option><option value="green">Forest</option></select>
  <select id="ff-fit"><option value="contain">Contain</option><option value="cover">Cover</option></select>
  <select id="ff-frame"><option value="auto">Auto</option><option value="card">Card</option><option value="phone">Phone</option></select>
  <div class="ff-tabs"><button data-ff-size="instagram">IG</button><button data-ff-size="square">Square</button><button data-ff-size="story">Story</button><button data-ff-size="note">Note</button><button data-ff-size="appstoreMedium">App Store required</button><button data-ff-size="appstore">App Store extra</button></div>
  <div class="ff-preview-stage"><canvas id="ff-preview" width="1080" height="1350"></canvas></div>
  <strong id="ff-size-label"></strong><span id="ff-status"></span>
  <button id="ff-export" disabled>PNG</button><button id="ff-zip" disabled>ZIP</button>
</main><pre id="ff-browser-result">pending</pre><script src="./flow-frame.js" defer></script>
<script>
window.addEventListener('load', async () => {
  const report = document.getElementById('ff-browser-result');
  const downloads = [];
  HTMLAnchorElement.prototype.click = function() {
    if (this.download) downloads.push({ name: this.download, promise: fetch(this.href).then(r => r.arrayBuffer()) });
  };
  const waitFor = async (f, description) => {
    for (let i = 0; i < 200; i++) {
      if (f()) return;
      await new Promise(resolve => setTimeout(resolve, 30));
    }
    throw new Error('Timeout: ' + description);
  };
  const assert = (value, why) => { if (!value) throw new Error(why); };
  const verifyPng = (bytes, w, h) => {
    const view = new DataView(bytes);
    assert(view.getUint32(0) === 0x89504e47 && view.getUint32(4) === 0x0d0a1a0a, 'PNG signature');
    assert(view.getUint32(16) === w && view.getUint32(20) === h, 'PNG dimensions ' + w + 'x' + h);
  };
  try {
    assert(document.getElementById('ff-export').disabled, 'disabled before image input');
    const sample = document.createElement('canvas');
    sample.width = 150; sample.height = 280;
    const ctx = sample.getContext('2d');
    ctx.fillStyle = '#ee7800'; ctx.fillRect(0, 0, 150, 280);
    ctx.fillStyle = '#ffffff'; ctx.fillRect(25, 40, 100, 170);
    const blob = await new Promise(resolve => sample.toBlob(resolve, 'image/png'));
    assert(!!blob, 'sample PNG could not be created');
    const file = new File([blob], 'sample.png', { type: 'image/png' });
    const dt = new DataTransfer();
    dt.items.add(file);
    const fileInput = document.getElementById('ff-file');
    fileInput.files = dt.files;
    fileInput.dispatchEvent(new Event('change', { bubbles: true }));
    await waitFor(() => !document.getElementById('ff-export').disabled, 'upload');
    const canvas = document.getElementById('ff-preview');
    const modes = [
      ['instagram', 1080, 1350], ['square', 1080, 1080], ['story', 1080, 1920],
      ['note', 1280, 670], ['appstoreMedium', 1179, 2556], ['appstore', 1320, 2868],
    ];
    for (const [mode, w, h] of modes) {
      document.querySelector('[data-ff-size="' + mode + '"]').click();
      await waitFor(() => canvas.width === w && canvas.height === h, 'canvas ' + mode);
      document.getElementById('ff-export').click();
      await waitFor(() => downloads.some(d => d.name === 'flow-frame-' + mode + '.png'), 'png download ' + mode);
      const data = await downloads.at(-1).promise;
      verifyPng(data, w, h);
    }
    document.getElementById('ff-zip').click();
    await waitFor(() => downloads.some(d => d.name.endsWith('.zip')), 'zip download');
    const zip = new DataView(await downloads.at(-1).promise);
    let offset = 0;
    for (const [mode, w, h] of modes) {
      assert(zip.getUint32(offset, true) === 0x04034b50, 'ZIP local header ' + mode);
      const size = zip.getUint32(offset + 18, true);
      const nameLength = zip.getUint16(offset + 26, true);
      const extraLength = zip.getUint16(offset + 28, true);
      const name = new TextDecoder().decode(new Uint8Array(zip.buffer, offset + 30, nameLength));
      assert(name === 'flow-frame-' + mode + '.png', 'ZIP name ' + mode);
      const start = offset + 30 + nameLength + extraLength;
      verifyPng(zip.buffer.slice(start, start + size), w, h);
      offset = start + size;
    }
    assert(zip.getUint32(offset, true) === 0x02014b50, 'ZIP central directory');
    report.textContent = 'PASS: 6 PNG exports + 6 ZIP entries, correct dimensions and signatures';
    report.dataset.result = 'pass';
  } catch (e) {
    report.textContent = 'FAIL: ' + (e.stack || e.message || e);
    report.dataset.result = 'fail';
  }
});
</script></body></html>`;

test('FLOW FRAME real-Chrome screenshot-to-PNG-and-ZIP smoke', { timeout: 60_000 }, async (t) => {
  const chrome = findChrome();
  if (!chrome) return t.skip('Chrome/Chromium unavailable: no real-browser smoke in this environment');
  const dir = await mkdtemp(join(tmpdir(), 'ff-browser-'));
  try {
    await copyFile(join(root, 'public/scripts/flow-frame.js'), join(dir, 'flow-frame.js'));
    await copyFile(join(root, 'public/styles/flow-frame.css'), join(dir, 'flow-frame.css'));
    const htmlFile = join(dir, 'fixture.html');
    await writeFile(htmlFile, fixture, 'utf8');
    const output = execFileSync(chrome, [
      '--no-sandbox', '--headless=new', '--disable-gpu', '--disable-dev-shm-usage',
      '--disable-extensions', '--no-first-run', '--virtual-time-budget=22000',
      '--dump-dom', pathToFileURL(htmlFile).href,
    ], { encoding: 'utf8', timeout: 50_000, maxBuffer: 3_000_000, stdio: ['ignore', 'pipe', 'ignore'] });
    assert.match(output, /data-result="pass"/, output.match(/<pre id="ff-browser-result"[^>]*>[\s\S]*?<\/pre>/)?.[0] || 'No result from browser');
    assert.match(output, /6 PNG exports \+ 6 ZIP entries/);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});