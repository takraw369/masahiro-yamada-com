(() => {
  'use strict';
  const root = document.getElementById('flow-frame');
  if (!root) return;

  const byId = (id) => document.getElementById(id);
  const formats = {
    instagram: { label: 'Instagram 4:5', width: 1080, height: 1350 },
    square: { label: 'X / 正方形', width: 1080, height: 1080 },
    story: { label: 'Story 9:16', width: 1080, height: 1920 },
    note: { label: 'note 横長', width: 1280, height: 670 },
    appstoreMedium: { label: 'App Store 6.3″（必須サイズ）', width: 1179, height: 2556 },
    appstore: { label: 'App Store 6.9″（参考）', width: 1320, height: 2868 },
  };
  const themes = {
    orange: { a: '#261c16', b: '#7b3e1b', c: '#ee7800', ink: '#fff8ed', muted: '#ffe0b6', screen: '#211914' },
    cream: { a: '#fff9ee', b: '#f6e5cf', c: '#ee7800', ink: '#2d2823', muted: '#63584d', screen: '#e6dfd6' },
    night: { a: '#0e1725', b: '#253a56', c: '#ff9c42', ink: '#f5f7fd', muted: '#bcd2e4', screen: '#121c2a' },
    green: { a: '#0b2925', b: '#256954', c: '#ef9c48', ink: '#f3f7e8', muted: '#c4ddc2', screen: '#18392f' },
  };
  const fileEl = byId('ff-file');
  const drop = byId('ff-drop');
  const nameEl = byId('ff-file-name');
  const preview = byId('ff-preview');
  const status = byId('ff-status');
  const label = byId('ff-size-label');
  const pngButton = byId('ff-export');
  const zipButton = byId('ff-zip');
  const watched = ['ff-brand', 'ff-title', 'ff-description', 'ff-cta', 'ff-source-url', 'ff-theme', 'ff-fit', 'ff-frame'];
  let current = 'instagram';
  let sourceImage = null;
  let imageName = '';
  let busy = false;
  let scheduled = false;

  const read = (id) => (byId(id).value || '').trim();
  const currentTheme = () => themes[read('ff-theme')] || themes.orange;
  const setStatus = (value) => { status.textContent = value; };

  function roundedPath(ctx, x, y, w, h, r) {
    const radius = Math.max(0, Math.min(r, w / 2, h / 2));
    ctx.beginPath();
    ctx.moveTo(x + radius, y);
    ctx.lineTo(x + w - radius, y);
    ctx.quadraticCurveTo(x + w, y, x + w, y + radius);
    ctx.lineTo(x + w, y + h - radius);
    ctx.quadraticCurveTo(x + w, y + h, x + w - radius, y + h);
    ctx.lineTo(x + radius, y + h);
    ctx.quadraticCurveTo(x, y + h, x, y + h - radius);
    ctx.lineTo(x, y + radius);
    ctx.quadraticCurveTo(x, y, x + radius, y);
    ctx.closePath();
  }

  function fitImage(ctx, img, x, y, w, h, mode) {
    const rw = img.naturalWidth / img.naturalHeight;
    const target = w / h;
    let dw, dh, dx, dy;
    if ((mode === 'cover' && rw > target) || (mode !== 'cover' && rw < target)) {
      dh = h; dw = dh * rw; dx = x + (w - dw) / 2; dy = y;
    } else {
      dw = w; dh = dw / rw; dx = x; dy = y + (h - dh) / 2;
    }
    ctx.drawImage(img, dx, dy, dw, dh);
  }

  function putText(ctx, text, x, y, width, lineHeight, maxLines) {
    if (!text) return y;
    // Breaking by code points supports Japanese titles without requiring spaces.
    const segments = [...text.replace(/\r/g, '')];
    const lines = [];
    let line = '';
    for (const char of segments) {
      if (char === '\n') {
        lines.push(line);
        line = '';
        continue;
      }
      if (ctx.measureText(line + char).width > width && line) {
        lines.push(line);
        line = char;
      } else {
        line += char;
      }
    }
    if (line) lines.push(line);
    const visible = lines.slice(0, maxLines);
    if (lines.length > maxLines && visible.length) {
      const last = visible.length - 1;
      let str = visible[last];
      while (str && ctx.measureText(str + '…').width > width) str = str.slice(0, -1);
      visible[last] = str + '…';
    }
    for (const textLine of visible) {
      ctx.fillText(textLine, x, y);
      y += lineHeight;
    }
    return y;
  }

  function background(ctx, width, height, colors) {
    const grd = ctx.createLinearGradient(0, 0, width, height);
    grd.addColorStop(0, colors.a);
    grd.addColorStop(1, colors.b);
    ctx.fillStyle = grd;
    ctx.fillRect(0, 0, width, height);
    ctx.save();
    ctx.globalAlpha = .17;
    const x = width * .93;
    const y = height * .20;
    const r = width * 1.05;
    const glow = ctx.createRadialGradient(x, y, 0, x, y, r);
    glow.addColorStop(0, colors.c);
    glow.addColorStop(1, 'transparent');
    ctx.fillStyle = glow;
    ctx.fillRect(0, 0, width, height);
    ctx.restore();
    ctx.strokeStyle = colors.c;
    ctx.globalAlpha = .20;
    ctx.lineWidth = Math.max(2, width / 350);
    ctx.beginPath();
    ctx.arc(width * .99, height * .86, width * .34, 0, Math.PI * 2);
    ctx.stroke();
    ctx.globalAlpha = 1;
  }

  function drawMock(ctx, x, y, w, h, theme) {
    ctx.fillStyle = theme.screen;
    ctx.fillRect(x, y, w, h);
    ctx.globalAlpha = .36;
    ctx.fillStyle = theme.muted;
    for (let i = 0; i < 4; i++) {
      roundedPath(ctx, x + w * .12, y + h * (.22 + i * .15), w * (i % 2 ? .52 : .74), Math.max(8, h * .024), 7);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
    ctx.fillStyle = theme.c;
    roundedPath(ctx, x + w * .12, y + h * .80, w * .76, h * .075, h * .02);
    ctx.fill();
  }

  function drawMedia(ctx, rect, style, fit, colors, s) {
    const x = rect.x, y = rect.y, w = rect.w, h = rect.h;
    ctx.save();
    ctx.shadowColor = 'rgba(0,0,0,.38)';
    ctx.shadowBlur = 34 * s;
    ctx.shadowOffsetY = 15 * s;
    const border = style === 'phone' ? Math.max(10 * s, w * .032) : Math.max(7 * s, w * .018);
    const radius = style === 'phone' ? Math.min(w * .13, 65 * s) : 24 * s;
    roundedPath(ctx, x, y, w, h, radius);
    ctx.fillStyle = style === 'phone' ? '#111319' : '#ffffff';
    ctx.fill();
    ctx.restore();
    ctx.save();
    const inX = x + border, inY = y + border, inW = w - 2 * border, inH = h - 2 * border;
    roundedPath(ctx, inX, inY, inW, inH, Math.max(10 * s, radius - border));
    ctx.clip();
    ctx.fillStyle = colors.screen;
    ctx.fillRect(inX, inY, inW, inH);
    if (sourceImage) fitImage(ctx, sourceImage, inX, inY, inW, inH, fit);
    else drawMock(ctx, inX, inY, inW, inH, colors);
    ctx.restore();
    if (style === 'phone') {
      ctx.fillStyle = '#131519';
      roundedPath(ctx, x + w * .345, y + border * .7, w * .31, Math.max(border * 1.3, h * .018), h * .013);
      ctx.fill();
    }
  }

  function drawScene(canvas, key) {
    const format = formats[key];
    if (!format) return;
    const w = format.width, h = format.height;
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d', { alpha: false });
    if (!ctx) throw new Error('Canvasを使えるブラウザが必要です。');
    const colors = currentTheme();
    const scale = w / 1080;
    const title = read('ff-title');
    const desc = read('ff-description');
    const brand = read('ff-brand');
    const cta = read('ff-cta');
    const mode = read('ff-frame');
    const imageStyle = mode === 'auto' ? (key.startsWith('appstore') ? 'phone' : 'card') : mode;
    const fit = read('ff-fit');
    background(ctx, w, h, colors);
    ctx.textBaseline = 'alphabetic';
    ctx.fillStyle = colors.ink;

    const edge = w * .075;
    const fontFamily = '"Zen Kaku Gothic New", "Hiragino Kaku Gothic ProN", sans-serif';
    const heading = key === 'note' ? 65 * scale : key.startsWith('appstore') ? 89 * scale : 78 * scale;
    const bodySize = key === 'note' ? 23 * scale : 29 * scale;
    const baseline = key === 'note' ? h * .17 : h * .087;

    // Header
    ctx.fillStyle = colors.c;
    roundedPath(ctx, edge, baseline - 22 * scale, 10 * scale, 32 * scale, 4 * scale);
    ctx.fill();
    ctx.fillStyle = colors.ink;
    ctx.font = '700 ' + 23 * scale + 'px ' + fontFamily;
    ctx.fillText(brand || 'FLOW FRAME', edge + 27 * scale, baseline + 4 * scale, w * .77);

    const textX = edge;
    const titleY = key === 'note' ? h * .29 : key.startsWith('appstore') ? h * .124 : h * .174;
    const titleWidth = key === 'note' ? w * .48 : w * .86;
    ctx.font = '700 ' + heading + 'px ' + fontFamily;
    ctx.fillStyle = colors.ink;
    const afterTitle = putText(ctx, title, textX, titleY, titleWidth, heading * 1.29, key === 'note' ? 3 : 2);
    ctx.fillStyle = colors.muted;
    ctx.font = '500 ' + bodySize + 'px ' + fontFamily;
    putText(ctx, desc, textX, afterTitle + 10 * scale, titleWidth, bodySize * 1.65, key === 'note' ? 2 : 2);

    let rect;
    if (key === 'note') {
      rect = { x: w * .62, y: h * .125, w: w * .29, h: h * .75 };
    } else if (key.startsWith('appstore')) {
      rect = { x: w * .17, y: h * .27, w: w * .66, h: h * .622 };
    } else if (key === 'story') {
      rect = { x: w * .155, y: h * .402, w: w * .69, h: h * .48 };
    } else if (key === 'square') {
      rect = { x: w * .23, y: h * .422, w: w * .54, h: h * .45 };
    } else {
      rect = { x: w * .19, y: h * .386, w: w * .62, h: h * .48 };
    }
    drawMedia(ctx, rect, imageStyle, fit, colors, scale);

    // Footer always remains outside the image frame.
    ctx.fillStyle = colors.c;
    roundedPath(ctx, edge, h * .944, 43 * scale, 5 * scale, 2 * scale);
    ctx.fill();
    ctx.fillStyle = colors.ink;
    ctx.font = '700 ' + 21 * scale + 'px ' + fontFamily;
    const sourceUrl = read('ff-source-url');
    let sourceLabel = '';
    if (sourceUrl) {
      try { sourceLabel = new URL(sourceUrl).hostname.replace(/^www\./, ''); }
      catch { sourceLabel = ''; }
    }
    ctx.fillText(cta || 'SUN LOVES FLOW', edge, h * .971, sourceLabel ? w * .57 : w * .80);
    if (sourceLabel) {
      ctx.font = '500 ' + 15 * scale + 'px ' + fontFamily;
      ctx.fillStyle = colors.muted;
      ctx.textAlign = 'right';
      ctx.fillText(sourceLabel, w - edge, h * .971, w * .28);
      ctx.textAlign = 'left';
    }
    return canvas;
  }

  function render() {
    scheduled = false;
    try {
      drawScene(preview, current);
      const selected = formats[current];
      label.textContent = selected.label + ' · ' + selected.width + ' × ' + selected.height + 'px';
    } catch (error) {
      setStatus('プレビューに失敗しました: ' + (error.message || error));
    }
  }
  function queueRender() {
    if (!scheduled) {
      scheduled = true;
      requestAnimationFrame(render);
    }
  }
  function setBusy(value) {
    busy = value;
    pngButton.disabled = value || !sourceImage;
    zipButton.disabled = value || !sourceImage;
    pngButton.textContent = value ? '生成中…' : 'このサイズをPNG保存 ↓';
    zipButton.textContent = value ? '生成中…' : '6種類をZIPで一括保存 ↓';
  }

  async function loadFile(file) {
    if (!file) return;
    if (!/^image\/(png|jpeg|webp|avif)$/i.test(file.type)) {
      setStatus('PNG・JPEG・WebP・AVIFの画像を指定してください。');
      return;
    }
    if (file.size > 18 * 1024 * 1024) {
      setStatus('画像は18 MB以内にしてください。');
      return;
    }
    setStatus('画像を読み込み中…');
    const objectUrl = URL.createObjectURL(file);
    const img = new Image();
    try {
      await new Promise((resolve, reject) => {
        img.onload = resolve;
        img.onerror = () => reject(new Error('読み込めない画像です。'));
        img.src = objectUrl;
      });
      if (!img.naturalWidth || !img.naturalHeight) throw new Error('画像の寸法を読み取れません。');
      sourceImage = img;
      imageName = file.name || 'pasted-image.png';
      nameEl.textContent = imageName + ' · ' + img.naturalWidth + '×' + img.naturalHeight;
      setBusy(false);
      await document.fonts.ready;
      queueRender();
      setStatus('準備OK。サイズを確認して保存できます。');
    } catch (e) {
      setStatus(e.message || '画像を開けませんでした。');
    } finally {
      URL.revokeObjectURL(objectUrl);
    }
  }

  const canvasBlob = (canvas) => new Promise((resolve, reject) => {
    canvas.toBlob((blob) => blob ? resolve(blob) : reject(new Error('PNGへの変換に失敗しました。')), 'image/png');
  });
  const download = (blob, filename) => {
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 15000);
  };

  const zipCrcTable = (() => {
    const table = new Uint32Array(256);
    for (let n = 0; n < 256; n++) {
      let c = n;
      for (let k = 0; k < 8; k++) c = (c & 1) ? (0xedb88320 ^ (c >>> 1)) : (c >>> 1);
      table[n] = c >>> 0;
    }
    return table;
  })();
  function crc32(bytes) {
    let crc = -1;
    for (let i = 0; i < bytes.length; i++) crc = zipCrcTable[(crc ^ bytes[i]) & 0xff] ^ (crc >>> 8);
    return (crc ^ -1) >>> 0;
  }
  // Dependency-free ZIP writer with STORE entries, UTF-8 filenames and CRC32.
  async function buildZip(files) {
    const encoder = new TextEncoder();
    const localParts = [], centralParts = [];
    let offset = 0;
    let centralSize = 0;
    for (const file of files) {
      const name = encoder.encode(file.name);
      const data = new Uint8Array(await file.blob.arrayBuffer());
      const crc = crc32(data);
      const local = new Uint8Array(30 + name.length);
      const a = new DataView(local.buffer);
      a.setUint32(0, 0x04034b50, true);
      a.setUint16(4, 20, true);
      a.setUint16(6, 0x0800, true);
      a.setUint32(14, crc, true);
      a.setUint32(18, data.length, true);
      a.setUint32(22, data.length, true);
      a.setUint16(26, name.length, true);
      local.set(name, 30);
      localParts.push(local, data);
      const central = new Uint8Array(46 + name.length);
      const b = new DataView(central.buffer);
      b.setUint32(0, 0x02014b50, true);
      b.setUint16(4, 20, true);
      b.setUint16(6, 20, true);
      b.setUint16(8, 0x0800, true);
      b.setUint32(16, crc, true);
      b.setUint32(20, data.length, true);
      b.setUint32(24, data.length, true);
      b.setUint16(28, name.length, true);
      b.setUint32(42, offset, true);
      central.set(name, 46);
      centralParts.push(central);
      centralSize += central.length;
      offset += local.length + data.length;
    }
    const end = new Uint8Array(22);
    const v = new DataView(end.buffer);
    v.setUint32(0, 0x06054b50, true);
    v.setUint16(8, files.length, true);
    v.setUint16(10, files.length, true);
    v.setUint32(12, centralSize, true);
    v.setUint32(16, offset, true);
    return new Blob([...localParts, ...centralParts, end], { type: 'application/zip' });
  }

  async function exportFile(zipAll) {
    if (busy || !sourceImage) return;
    setBusy(true);
    try {
      await document.fonts.ready;
      if (zipAll) {
        const files = [];
        for (const key of Object.keys(formats)) {
          const surface = document.createElement('canvas');
          drawScene(surface, key);
          files.push({ name: 'flow-frame-' + key + '.png', blob: await canvasBlob(surface) });
        }
        const zip = await buildZip(files);
        download(zip, 'flow-frame-6-formats.zip');
        setStatus('6種類のPNGをZIPにまとめました。保存先を確認してください。');
      } else {
        const surface = document.createElement('canvas');
        drawScene(surface, current);
        download(await canvasBlob(surface), 'flow-frame-' + current + '.png');
        setStatus(formats[current].label + 'のPNGを出力しました。');
      }
    } catch (e) {
      setStatus('出力失敗: ' + (e.message || e));
    } finally {
      setBusy(false);
    }
  }

  for (const id of watched) byId(id).addEventListener('input', queueRender);
  for (const button of root.querySelectorAll('[data-ff-size]')) {
    button.addEventListener('click', () => {
      current = button.dataset.ffSize;
      for (const other of root.querySelectorAll('[data-ff-size]')) {
        const active = other === button;
        other.classList.toggle('active', active);
        other.setAttribute('aria-pressed', String(active));
      }
      queueRender();
    });
  }
  fileEl.addEventListener('change', () => loadFile(fileEl.files && fileEl.files[0]));
  for (const name of ['dragenter', 'dragover']) {
    drop.addEventListener(name, (e) => { e.preventDefault(); drop.classList.add('dragging'); });
  }
  for (const name of ['dragleave', 'drop']) {
    drop.addEventListener(name, (e) => { e.preventDefault(); drop.classList.remove('dragging'); });
  }
  drop.addEventListener('drop', (e) => {
    const files = e.dataTransfer && e.dataTransfer.files;
    if (files && files.length) loadFile(files[0]);
  });
  document.addEventListener('paste', (e) => {
    if (!root.isConnected) return;
    const target = e.target;
    if (target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement) return;
    for (const item of e.clipboardData ? e.clipboardData.items : []) {
      if (item.type.startsWith('image/')) {
        const file = item.getAsFile();
        if (file) { e.preventDefault(); loadFile(file); break; }
      }
    }
  });
  pngButton.addEventListener('click', () => exportFile(false));
  zipButton.addEventListener('click', () => exportFile(true));
  document.fonts.ready.then(queueRender);
  queueRender();
})();