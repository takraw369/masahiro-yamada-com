#!/usr/bin/env node
import { mkdirSync, readFileSync, writeFileSync, renameSync, rmSync, realpathSync } from 'node:fs';
import { resolve, relative, dirname, isAbsolute } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { buildHarvest, loadInput, renderMarkdown } from './lib/notebooklm-harvest.mjs';

export function main(argv) {
  const options = { inputs: [], sourceIds: [], dryRun: true };
  if (argv.includes('--dry-run') && argv.includes('--write-local')) throw new Error('conflicting_write_modes');
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--dry-run') options.dryRun = true;
    else if (arg === '--write-local') options.dryRun = false;
    else if (arg === '--help') {
      console.log('Offline NotebookLM → existing Knowledge review packet.\n--input <index.json|export.md|export.txt|drive.json> (repeatable)\n--source-id <id> (repeatable, index selection only)\n--annotations <json> --previous <receipt.json> --existing <snapshot.json>\n--dry-run (default, no writes) | --write-local --out <new-private-directory>\nNo login, network, database writes, canonical promotion or deployment.'); return;
    } else {
      if (!['--input', '--source-id', '--annotations', '--previous', '--existing', '--out'].includes(arg)) throw new Error('unknown_argument');
      const value = argv[++i]; if (!value || value.startsWith('--')) throw new Error('argument_value_required');
      if (arg === '--input') options.inputs.push(value);
      else if (arg === '--source-id') options.sourceIds.push(value);
      else options[arg.slice(2)] = value;
    }
  }
  if (!options.inputs.length) throw new Error('input_required');
  const json = p => p ? JSON.parse(readFileSync(p, 'utf8')) : null;
  const loaded = options.inputs.map(p => loadInput(p, options));
  const packet = buildHarvest(loaded.flatMap(x => x.documents), {
    annotations: json(options.annotations) || {}, previous: json(options.previous),
    existing: json(options.existing) || [], skipped: loaded.flatMap(x => x.skipped),
  });
  // Source filters must not silently look successful when a selection is misspelled.
  const found = new Set([...packet.candidates.flatMap(c => c.occurrences.map(o => o.sourceId)), ...packet.skipped.map(s => s.sourceId)]);
  if (options.sourceIds.some(id => !found.has(id))) throw new Error('selected_source_id_not_found');
  if (!options.dryRun) {
    if (!options.out) throw new Error('private_output_directory_required');
    const out = resolve(options.out);
    const repo = realpathSync(fileURLToPath(new URL('..', import.meta.url)));
    const parent = realpathSync(dirname(out));
    const actual = resolve(parent, out.split('/').at(-1));
    const rel = relative(repo, actual);
    if (!rel.startsWith(`work/`) && rel !== '..' && !rel.startsWith('../') && !isAbsolute(rel)) throw new Error('output_in_git_repository_refused_use_work');
    for (const input of options.inputs) {
      const source = realpathSync(input);
      if (actual === source || actual.startsWith(`${dirname(source)}/`)) throw new Error('output_inside_source_directory_refused');
    }
    // Exclusive new directory + same-directory rename; never overwrite sources or prior receipts.
    mkdirSync(actual, { mode: 0o700 });
    try {
      for (const [name, data] of [['receipt.json', JSON.stringify(packet, null, 2) + '\n'], ['knowledge-candidates.md', renderMarkdown(packet)]]) {
        const temp = resolve(actual, `.${name}.tmp`);
        writeFileSync(temp, data, { flag: 'wx', mode: 0o600 }); renameSync(temp, resolve(actual, name));
      }
    } catch (error) { rmSync(actual, { recursive: true, force: true }); throw error; }
  }
  console.log(JSON.stringify({ schema: packet.schema, dryRun: options.dryRun, counts: packet.counts, liveWrites: 0, missingPrevious: packet.missingPreviousIds.length }));
  return packet;
}

if (import.meta.url === pathToFileURL(process.argv[1] || '').href) {
  try { main(process.argv.slice(2)); }
  catch (error) { console.error(`harvest_failed: ${error.code || error.message}`); process.exitCode = 1; }
}
