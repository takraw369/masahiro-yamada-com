import fs from 'fs';
import path from 'path';
import matter from 'gray-matter';

const VAULT_PATH = process.env.ACE_VAULT_PATH || `${process.env.HOME}/ドキュメント/Obsidian/ace-vault`;
const SYNC_DEST = path.join(process.cwd(), 'src/content/_publish_sync');
const CONTENT_ROOT = path.join(process.cwd(), 'src/content');

// Known collections that get synced directly into src/content/{name}/
const DIRECT_COLLECTIONS = new Set(['thoughts', 'tips']);

if (fs.existsSync(SYNC_DEST)) {
  fs.rmSync(SYNC_DEST, { recursive: true });
}
fs.mkdirSync(SYNC_DEST, { recursive: true });

function walk(dir: string, callback: (filepath: string) => void) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name.startsWith('.')) continue;
      walk(fullPath, callback);
    } else if (entry.name.endsWith('.md')) {
      callback(fullPath);
    }
  }
}

let synced = 0;
walk(VAULT_PATH, (filepath) => {
  let data: Record<string, unknown> = {};
  try {
    const raw = fs.readFileSync(filepath, 'utf8');
    ({ data } = matter(raw));
  } catch {
    // skip files with invalid frontmatter
    return;
  }
  if (data.publish !== true) return;

  const target = (data.publish_to as string) || 'thoughts';
  const filename = path.basename(filepath);
  const destDir = DIRECT_COLLECTIONS.has(target)
    ? path.join(CONTENT_ROOT, target)
    : path.join(SYNC_DEST, target);
  fs.mkdirSync(destDir, { recursive: true });
  fs.copyFileSync(filepath, path.join(destDir, filename));
  synced++;
});

console.log(`Synced ${synced} files from ace-vault to ${SYNC_DEST}`);
