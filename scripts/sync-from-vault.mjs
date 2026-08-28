import fs from 'node:fs';
import path from 'node:path';

const home = process.env.HOME || '';
const candidates = [
  process.env.ACE_VAULT_PATH,
  path.join(home, 'Documents', 'Obsidian', 'ace-vault'),
  path.join(home, 'ドキュメント', 'Obsidian', 'ace-vault'),
  path.resolve(process.cwd(), '../ace-vault'),
].filter(Boolean);

const vaultPath = candidates.find((candidate) => fs.existsSync(candidate));
const destDir = path.join(process.cwd(), 'src', 'content', 'tips');

if (!vaultPath) {
  console.log('[ACE Tips] ace-vault not found. Keeping mirrored Tips already in the site repository.');
  process.exit(0);
}

const sourceDir = path.join(vaultPath, '_publish', 'tips');
if (!fs.existsSync(sourceDir)) {
  console.log(`[ACE Tips] ${sourceDir} not found. Nothing to sync.`);
  process.exit(0);
}

fs.mkdirSync(destDir, { recursive: true });

function frontmatter(raw) {
  if (!raw.startsWith('---')) return '';
  const end = raw.indexOf('\n---', 3);
  return end === -1 ? '' : raw.slice(3, end);
}

function isPublishedTip(raw) {
  const fm = frontmatter(raw);
  return /^publish:\s*true\s*$/m.test(fm) && /^publish_to:\s*tips\s*$/m.test(fm);
}

// Remove only files previously mirrored from the Vault. Site-native Tips stay untouched.
for (const name of fs.readdirSync(destDir)) {
  if (!name.endsWith('.md')) continue;
  const target = path.join(destDir, name);
  const raw = fs.readFileSync(target, 'utf8');
  if (/^publish_to:\s*tips\s*$/m.test(frontmatter(raw))) {
    fs.rmSync(target);
  }
}

let synced = 0;
for (const entry of fs.readdirSync(sourceDir, { withFileTypes: true })) {
  if (!entry.isFile() || !entry.name.endsWith('.md') || entry.name.startsWith('_')) continue;
  const source = path.join(sourceDir, entry.name);
  const raw = fs.readFileSync(source, 'utf8');
  if (!isPublishedTip(raw)) continue;
  fs.copyFileSync(source, path.join(destDir, entry.name));
  synced += 1;
}

console.log(`[ACE Tips] Synced ${synced} published Tips from ${sourceDir}`);
