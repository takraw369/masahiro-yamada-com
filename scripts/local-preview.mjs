import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { mkdir, mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { resolve, join, isAbsolute } from 'node:path';
import { fileURLToPath } from 'node:url';

export async function startPreview(port = 8787) {
  const root = process.cwd();
  await mkdir('work', { recursive: true });
  const directory = await mkdtemp(resolve('work/preview-'));
  const config = JSON.parse(await readFile('wrangler.preview.jsonc', 'utf8'));

  // The isolated Wrangler config lives under work/preview-*, so bare package
  // entrypoints can no longer be resolved relative to the project root. Keep
  // production config canonical, but resolve its package entrypoint before
  // copying the preview config into the isolated directory.
  if (isAbsolute(config.main) || config.main.startsWith('./') || config.main.startsWith('../')) {
    config.main = resolve(config.main);
  } else {
    config.main = fileURLToPath(import.meta.resolve(config.main));
  }
  config.assets.directory = resolve(config.assets.directory);
  delete config.$schema;
  await writeFile(join(directory, 'wrangler.json'), JSON.stringify(config));
  await writeFile(join(directory, '.dev.vars'), '');

  // Allowlist process environment: never inherit production service credentials.
  const env = Object.fromEntries(['PATH', 'HOME', 'TMPDIR', 'SystemRoot'].filter((key) => process.env[key]).map((key) => [key, process.env[key]]));
  env.CLOUDFLARE_LOAD_DEV_VARS_FROM_DOT_ENV = 'false';
  env.WRANGLER_SEND_METRICS = 'false';
  return spawn(join(root, 'node_modules/.bin/wrangler'), ['dev', '--local', '--config', join(directory, 'wrangler.json'), '--ip', '127.0.0.1', '--port', String(port)], { cwd: directory, env, stdio: ['ignore', 'pipe', 'pipe'] });
}
