import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import test from 'node:test';

const require = createRequire(import.meta.url);
const wranglerRequire = createRequire(require.resolve('wrangler/package.json'));
const pluginRequire = createRequire(import.meta.resolve('@cloudflare/vite-plugin'));

// Exercise each toolchain's native decoder using a synthetic image only.
for (const [name, entry] of [
  ['Miniflare', require.resolve('miniflare')],
  ['Wrangler Miniflare', wranglerRequire.resolve('miniflare')],
  ['Vite plugin Miniflare', pluginRequire.resolve('miniflare')],
]) {
  test(`${name} decodes AVIF with patched sharp/libheif`, async () => {
    const sharp = createRequire(entry)('sharp');
    assert.equal(sharp.versions.sharp, '0.35.4');
    assert.equal(sharp.versions.heif, '1.23.2');
    const encoded = await sharp({ create: {
      width: 2, height: 2, channels: 3, background: { r: 32, g: 64, b: 128 },
    } }).avif({ lossless: true }).toBuffer();
    const { info } = await sharp(encoded).png().toBuffer({ resolveWithObject: true });
    assert.equal(info.width, 2);
    assert.equal(info.height, 2);
    assert.equal(info.format, 'png');
  });
}
