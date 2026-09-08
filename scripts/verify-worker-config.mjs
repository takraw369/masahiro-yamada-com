import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';

// Validate the generated artifact Wrangler would deploy, not just source config.
const redirectPath = '.wrangler/deploy/config.json';
const redirect = JSON.parse(readFileSync(redirectPath, 'utf8'));
const configPath = resolve(dirname(redirectPath), redirect.configPath);
const config = JSON.parse(readFileSync(configPath, 'utf8'));
const source = readFileSync('wrangler.toml', 'utf8');
const scalar = (key) => source.match(new RegExp(`^${key}\\s*=\\s*"([^"]+)"`, 'm'))?.[1];
assert.equal(config.name, scalar('name'), 'never deploy the isolated preview artifact');
assert.equal(config.compatibility_date, scalar('compatibility_date'));
assert.deepEqual(config.compatibility_flags, JSON.parse(source.match(/^compatibility_flags\s*=\s*(\[[^\n]+\])/m)[1]));
assert.deepEqual(config.routes.map(({ pattern }) => pattern).sort(), [...source.matchAll(/^pattern\s*=\s*"([^"]+)"/gm)].map((m) => m[1]).sort());
assert.equal(config.assets.binding, 'ASSETS');
assert.ok(existsSync(resolve(dirname(configPath), config.main)), 'built Worker entrypoint exists');
assert.ok(existsSync(resolve(dirname(configPath), config.assets.directory)), 'built assets exist');
assert.equal(config.d1_databases.length, 1);
assert.equal(config.d1_databases[0].binding, 'DB');
assert.equal(config.d1_databases[0].database_id, scalar('database_id'));
assert.equal((config.kv_namespaces || []).length, 0, 'no unused SESSION KV provisioning');
assert.ok(!config.images, 'no unrequested Images binding');
assert.ok(!config.vars?.DASHBOARD_PASSWORD, 'test signing secret must never enter production artifact');
console.log('Production Worker artifact config PASS: routes, compatibility, ASSETS/DB; no new KV/Images or test credentials.');
