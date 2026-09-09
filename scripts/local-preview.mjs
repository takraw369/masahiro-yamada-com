import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { resolve, join } from 'node:path';

function isolatedEnvironment(configPath) {
  // Allowlist process environment: never inherit production service credentials.
  const env = Object.fromEntries(
    ['PATH', 'HOME', 'TMPDIR', 'SystemRoot']
      .filter((key) => process.env[key])
      .map((key) => [key, process.env[key]]),
  );
  env.CLOUDFLARE_VITE_WRANGLER_CONFIG_PATH = configPath;
  env.CLOUDFLARE_LOAD_DEV_VARS_FROM_DOT_ENV = 'false';
  env.CLOUDFLARE_INCLUDE_PROCESS_ENV = 'false';
  env.WRANGLER_SEND_METRICS = 'false';
  return env;
}

async function buildIsolatedPreview(root, env) {
  const child = spawn(join(root, 'node_modules/.bin/astro'), ['build'], {
    cwd: root,
    env,
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  let logs = '';
  child.stdout.on('data', (chunk) => { logs = (logs + chunk).slice(-12000); });
  child.stderr.on('data', (chunk) => { logs = (logs + chunk).slice(-12000); });
  const [code, signal] = await once(child, 'exit');
  if (code !== 0) {
    throw new Error(`Isolated Astro preview build failed (${signal || code}).\n${logs}`);
  }
}

export async function startPreview(port = 8787, { vars = {} } = {}) {
  const root = process.cwd();
  await mkdir('work', { recursive: true });
  const directory = await mkdtemp(resolve('work/preview-'));

  try {
    const config = JSON.parse(await readFile('wrangler.preview.jsonc', 'utf8'));
    // The temporary config is intentionally outside the project root so local
    // production .dev.vars files cannot be discovered. Keep assets rooted at the
    // actual project build directory while leaving Astro's unified entrypoint bare
    // for the Cloudflare Vite plugin to resolve.
    if (typeof config.assets?.directory === 'string') {
      config.assets.directory = resolve(root, config.assets.directory);
    }
    delete config.$schema;
    config.vars = { ...config.vars, ...vars }; // Explicit synthetic test bindings only.

    const configPath = join(directory, 'wrangler.json');
    await writeFile(configPath, JSON.stringify(config, null, 2));
    await writeFile(join(directory, '.dev.vars'), '');

    const env = isolatedEnvironment(configPath);
    await buildIsolatedPreview(root, env);

    const child = spawn(
      join(root, 'node_modules/.bin/astro'),
      ['preview', '--host', '127.0.0.1', '--port', String(port)],
      { cwd: root, env, stdio: ['ignore', 'pipe', 'pipe'] },
    );

    const cleanup = () => { void rm(directory, { recursive: true, force: true }); };
    child.once('exit', cleanup);
    child.once('error', cleanup);
    return child;
  } catch (error) {
    await rm(directory, { recursive: true, force: true });
    throw error;
  }
}
