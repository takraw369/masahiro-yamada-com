import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, readFileSync, existsSync, mkdirSync, symlinkSync, rmSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { canonicalUrl, parseExport, loadInput, buildHarvest, captureText } from '../scripts/lib/notebooklm-harvest.mjs';

const meta = {title:'Learning from feedback',source_url:'https://example.org/research',source_id:'source-1',notebook_id:'notebook-1'};
const body = 'A learner practises a task. Feedback follows practice.';
const ann = {summary:'Practice and feedback are described in the source.',principles:['Keep the task and feedback connected.'],
  statements:[{kind:'claim',text:'The author places feedback after practice.',quote:'Feedback follows practice.'}],
  relations:[{targetId:'existing-education',title:'Education',relation:'applies_to',rationale:'A learning design proposal.'}],
  reuse:[{area:'education',idea:'Compare a practice attempt with a reflection.'}],openQuestions:['Does this help in the target context?']};
const doc = () => parseExport(body, meta);
const build = (docs=[doc()], opts={}) => buildHarvest(docs,{annotations:{'source-1':ann},...opts});
function temp(t) {const p=mkdtempSync(join(tmpdir(),'notebooklm-harvest-'));t.after(()=>rmSync(p,{recursive:true,force:true}));return p;}
function run(args) {return spawnSync(process.execPath,['scripts/notebooklm-harvest.mjs',...args],{cwd:resolve(import.meta.dirname,'..'),encoding:'utf8'});}

test('canonical identity joins YouTube variants but keeps originals in provenance',()=>{
  const a='https://youtu.be/abcdefghijk?si=tracking',b='https://www.youtube.com/watch?v=abcdefghijk&list=playlist&t=23';
  assert.equal(canonicalUrl(a),canonicalUrl(b));
  const p=build([parseExport(body,{...meta,source_url:a}),parseExport(body,{...meta,source_url:b,source_id:'source-2',notebook_id:'notebook-2'})]);
  assert.equal(p.counts.uniqueSources,1);assert.equal(p.counts.duplicateRegistrations,1);
  assert.equal(p.candidates[0].occurrences.length,2);
  assert.deepEqual(p.candidates[0].occurrences.map(o=>o.originalUrl).sort(),[a,b].sort());
});
test('Drive/Docs identities match and meaningful web query arguments survive',()=>{
  assert.equal(canonicalUrl('https://docs.google.com/document/d/example_document/edit?usp=sharing'),canonicalUrl('https://drive.google.com/file/d/example_document/view'));
  assert.equal(canonicalUrl('https://example.org/article?lang=ja&utm_source=test#part'),'https://example.org/article?lang=ja');
});
test('duplicate identity is deterministic and retains annotations and older provenance',()=>{
  const one=doc(),two=parseExport(body,{...meta,source_id:'source-2',notebook_id:'notebook-2'});
  const a=build([one,two]),b=build([two,one]);
  assert.equal(a.candidates[0].revisionHash,b.candidates[0].revisionHash);
  assert.equal(a.counts.structuredCandidates,1);
  const next=build([two],{previous:a});assert.equal(next.candidates[0].occurrences.length,2);
  assert.equal(next.candidates[0].summary,ann.summary);
  const resumed=build(undefined,{previous:a,annotations:{}});assert.equal(resumed.candidates[0].summary,ann.summary);
});
test('sensitive URLs are rejected before special-provider identity normalization',()=>{
  for(const url of ['https://youtu.be/abcdefghijk?token=secret','https://docs.google.com/document/d/file/edit?resourcekey=private'])assert.throws(()=>canonicalUrl(url),/sensitive_url_query/);
});
test('wrapper metadata excluded from body; BOM and CRLF normalise',()=>{
  const raw='# Example\r\n\r\n<!-- Indexed/read-only export from NotebookLM -->\r\n\r\n- notebook_id: nb\r\n- source_id: src\r\n\r\n---\r\n\r\nActual body\r\n';
  const d=parseExport('\uFEFF'+raw);assert.equal(d.body,'Actual body');assert.equal(d.source.sourceId,'src');
});
test('plain Markdown horizontal rules are retained',()=>assert.equal(parseExport('# Title\n\ntext\n\n---\n\nmore',meta).body,'# Title\n\ntext\n\n---\n\nmore'));
test('manifest cannot silently relabel a wrapped source identity',()=>{
  const raw='# Source\n<!-- Indexed/read-only export from NotebookLM -->\n- notebook_id: original\n- source_id: src\n- source_url: https://example.org/original\n\n---\n\nBody';
  assert.throws(()=>parseExport(raw,{notebook_id:'different'}),/provenance_conflict/);
  assert.throws(()=>parseExport(raw,{source_url:'https://example.org/different'}),/url_conflict/);
});
test('source provenance, empty bodies, credentials and unsafe URLs fail closed',()=>{
  assert.throws(()=>parseExport('x',{title:'No provenance'}),/provenance_required/);
  assert.throws(()=>parseExport(' ',meta),/empty_source_body/);
  assert.throws(()=>parseExport('api_key = abcdefghijklmnopqrstuvwxyz',meta),/credentials/);
  for(const url of ['file:///tmp/private','https://user:password@example.org','https://example.org?access_token=abc'])assert.throws(()=>canonicalUrl(url));
});
test('exact quote offsets and hashes point back to the preserved source',()=>{
  const c=build().candidates[0],e=c.statements[0].evidence;
  assert.equal(c.sourceBody.slice(e.start,e.end),e.quote);assert.equal(e.sourceHash,c.contentHash);
  assert.equal(c.statements[0].verification,'unverified');
  assert.ok(captureText(c).includes(meta.source_url));assert.ok(captureText(c).includes('existing-education'));
});
test('unmatched AI evidence and externally factual claims are rejected',()=>{
  assert.throws(()=>build(undefined,{annotations:{'source-1':{...ann,statements:[{...ann.statements[0],quote:'Invented evidence'}]}}}),/quote_not_in_source/);
  assert.throws(()=>build(undefined,{annotations:{'source-1':{...ann,statements:[{...ann.statements[0],kind:'fact'}]}}}),/independent_verification/);
});
test('document observations have a distinct scope; authored/AI notes remain unverified',()=>{
  const p=build(undefined,{annotations:{'source-1':{...ann,statements:[{...ann.statements[0],kind:'fact',scope:'document_observation'}]}}});
  assert.equal(p.candidates[0].statements[0].verification,'source_text_observed');
  const n=parseExport(body,{...meta,note_id:'note-1'});
  assert.equal(n.source.factualStatus,'ai_or_authored_note_unverified');
  assert.notEqual(n.id,doc().id);
});
test('repeat import is unchanged, body changes are updates with a stable ID',()=>{
  const first=build(),again=build(undefined,{previous:first});
  assert.equal(again.counts.unchanged,1);assert.equal(again.candidates[0].integration.capturePreview,null);
  const changed=build([parseExport(body+' New paragraph.',meta)],{previous:first});
  assert.equal(changed.counts.update,1);assert.equal(changed.candidates[0].id,first.candidates[0].id);
  assert.ok(changed.candidates[0].delta.changedFields.includes('contentHash'));
  assert.equal(changed.candidates[0].integration.operation,'REVIEW_UPDATE');
  assert.equal(changed.candidates[0].integration.capturePreview,null);
});
test('annotation changes update, export timestamp alone does not',()=>{
  const first=build();
  const changed=build(undefined,{previous:first,annotations:{'source-1':{...ann,summary:'Revised annotation'}}});
  assert.equal(changed.counts.update,1);assert.deepEqual(changed.candidates[0].delta.changedFields,['summary']);
  const stamped=build([parseExport(body,{...meta,exported_at_utc:'2030-01-01'})],{previous:first});
  assert.equal(stamped.counts.unchanged,1);
});
test('conflicting bodies at same URL are held, not discarded or captured',()=>{
  const p=build([doc(),parseExport(body+' Different revision.',meta)]);
  assert.equal(p.counts.conflict,1);assert.equal(p.candidates[0].conflictingSources.length,2);
  assert.equal(p.candidates[0].integration.capturePreview,null);
});
test('existing canonical URL match generates LINK/MERGE with no insert preview',()=>{
  const p=build(undefined,{existing:[{id:'actual-knowledge-id',title:'Already known',source_url:meta.source_url+'?utm_source=x'}]});
  assert.equal(p.candidates[0].integration.operation,'LINK_OR_MERGE_EXISTING');
  assert.equal(p.candidates[0].integration.capturePreview,null);
  assert.equal(p.candidates[0].integration.existingMatches[0].id,'actual-knowledge-id');
});
test('partial batches never delete absent previous records',()=>{
  const p=buildHarvest([],{previous:build()});
  assert.equal(p.missingPreviousIds.length,1);assert.equal(p.liveWrites,0);
  assert.equal(p.counts.applied,0);
  const resumed=build(undefined,{previous:p});assert.equal(resumed.counts.unchanged,1);
  assert.equal(resumed.candidates[0].integration.capturePreview,null);
});
test('URL enrichment retains prior source identity and does not emit another insert',()=>{
  const first=build([parseExport(body,{...meta,source_url:null})]);
  const next=build(undefined,{previous:first});
  assert.equal(next.candidates[0].id,first.candidates[0].id);assert.equal(next.counts.update,1);
  assert.equal(next.candidates[0].integration.capturePreview,null);
});
test('a conflicting receipt remains held across partial reimports',()=>{
  const first=build([doc(),parseExport(body+' Another revision.',meta)]);
  const next=build(undefined,{previous:first});
  assert.equal(next.counts.conflict,1);assert.equal(next.candidates[0].integration.capturePreview,null);
  assert.equal(next.candidates[0].conflictingSources.length,2);
});
test('missing annotations stay pending instead of inventing knowledge',()=>{
  const p=build(undefined,{annotations:{}});assert.equal(p.counts.structuredCandidates,0);
  assert.equal(p.candidates[0].summary,null);assert.equal(p.candidates[0].integration.capturePreview,null);
});
test('oversized captures have no preview instead of silently losing fields',()=>{
  const p=build(undefined,{annotations:{'source-1':{...ann,summary:'x'.repeat(13000)}}});
  assert.equal(p.candidates[0].integration.capturePreview,null);
});
test('existing notebook index skips unavailable, preserves notes and filters source IDs',t=>{
  const dir=temp(t);mkdirSync(join(dir,'sources'));mkdirSync(join(dir,'notes'));
  writeFileSync(join(dir,'sources','one.md'),body);writeFileSync(join(dir,'notes','note.md'),body);
  const idx=join(dir,'index.json');
  writeFileSync(idx,JSON.stringify({notebook_id:'n',notebook_title:'Notebook',sources:[
    {id:'s',filename:'sources/one.md',status:'exported',title:'Source',source_url:meta.source_url},
    {id:'missing',status:'unavailable',reason:'indexed text empty'}],notes:[{id:'note',title:'Saved note',filename:'notes/note.md',status:'already_local'}]}));
  const r=loadInput(idx);assert.equal(r.documents.length,2);assert.equal(r.skipped.length,1);
  assert.equal(r.documents[1].source.kind,'note');
  assert.equal(loadInput(idx,{sourceIds:['s']}).documents.length,1);
});
test('manifest traversal and symlink escape cannot read outside the export',t=>{
  const dir=temp(t),source=join(dir,'export');mkdirSync(source);writeFileSync(join(dir,'outside.md'),body);
  const idx=join(source,'index.json');
  const manifest=f=>({notebook_id:'n',sources:[{id:'s',filename:f,title:'Source',status:'exported'}],notes:[]});
  writeFileSync(idx,JSON.stringify(manifest('../outside.md')));assert.throws(()=>loadInput(idx),/path_escape/);
  symlinkSync(join(dir,'outside.md'),join(source,'escape.md'));
  writeFileSync(idx,JSON.stringify(manifest('escape.md')));assert.throws(()=>loadInput(idx),/path_escape/);
});
test('Drive readable JSON and plain text sidecar import without network calls',t=>{
  const dir=temp(t),drive=join(dir,'drive.json'),txt=join(dir,'source.txt');
  writeFileSync(drive,JSON.stringify({title:'Drive source',content:body,id:'drive-id',url:'https://docs.google.com/document/d/example_document/edit'}));
  assert.equal(loadInput(drive).documents[0].source.sourceId,'drive-id');
  writeFileSync(txt,body);writeFileSync(txt+'.source.json',JSON.stringify(meta));
  assert.equal(loadInput(txt).documents[0].contentHash,doc().contentHash);
});
test('CLI dry-run is read-only and explicit local writes are exclusive/private',t=>{
  const dir=temp(t),sourceDir=join(dir,'sources');mkdirSync(sourceDir);
  const input=join(sourceDir,'input.txt');writeFileSync(input,body);writeFileSync(input+'.source.json',JSON.stringify(meta));
  const out=join(dir,'packet'),before=readFileSync(input,'utf8');
  const dry=run(['--input',input,'--out',out,'--dry-run']);assert.equal(dry.status,0,dry.stderr);assert.equal(existsSync(out),false);
  const save=run(['--input',input,'--out',out,'--write-local']);assert.equal(save.status,0,save.stderr);
  const receipt=JSON.parse(readFileSync(join(out,'receipt.json'),'utf8'));
  assert.equal(receipt.liveWrites,0);assert.equal(statSync(join(out,'receipt.json')).mode&0o777,0o600);
  assert.notEqual(run(['--input',input,'--out',out,'--write-local']).status,0);
  assert.equal(readFileSync(input,'utf8'),before);
});
test('CLI fails for unknown flags/selection and refuses output alongside source',t=>{
  const dir=temp(t),input=join(dir,'input.txt');writeFileSync(input,body);writeFileSync(input+'.source.json',JSON.stringify(meta));
  assert.notEqual(run(['--input',input,'--apply']).status,0);
  assert.notEqual(run(['--input',input,'--dry-run','--write-local']).status,0);
  assert.notEqual(run(['--input',input,'--source-id','mistyped']).status,0);
  assert.notEqual(run(['--input',input,'--out',join(dir,'output'),'--write-local']).status,0);
});
