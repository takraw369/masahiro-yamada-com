import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,existsSync,mkdirSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
const run=args=>spawnSync(process.execPath,['scripts/media-hub/cli.mjs',...args],{encoding:'utf8'});
function fixture(t){const dir=mkdtempSync(path.join(tmpdir(),'media-cli-'));t.after(()=>rmSync(dir,{recursive:true,force:true}));return dir;}
test('scan rejects a misspelled or repeated flag before creating/resetting a catalog',t=>{
 const dir=fixture(t),source=path.join(dir,'source'),out=path.join(dir,'out');mkdirSync(source);
 for(const flags of [['--resum'],['--limit','5','--limit','0'],['--limit']]){
  const r=run(['scan',source,'--out',out,...flags]);assert.equal(r.status,1);assert.match(r.stderr,/Unknown option|Repeated option|Missing value/);assert.equal(existsSync(out),false);
 }
});
test('readonly catalog commands never create an empty database for a mistyped path',t=>{
 const dir=fixture(t),missing=path.join(dir,'missing.sqlite');
 for(const cmd of ['status','query','audit','eagle-queue']){assert.equal(run([cmd,missing]).status,1);assert.equal(existsSync(missing),false);}
});
test('help succeeds and Eagle diagnosis rejects extraneous input before network access',()=>{
 assert.equal(run(['--help']).status,0);const r=run(['eagle-check','--token','secret-not-a-real-token']);assert.equal(r.status,1);assert.match(r.stderr,/takes no arguments/);
});
test('incomplete scan exits nonzero and retains a resumable catalog', {skip:process.platform==='win32'||process.getuid?.()===0}, t=>{
 const dir=fixture(t),source=path.join(dir,'source'),blocked=path.join(source,'blocked'),out=path.join(dir,'out');mkdirSync(blocked,{recursive:true});
 // A real unreadable synthetic directory exercises CLI status, not a mocked scanner.
 const {status}=run(['--help']);assert.equal(status,0);
 const chmod=spawnSync('chmod',['000',blocked]);assert.equal(chmod.status,0);
 t.after(()=>spawnSync('chmod',['700',blocked]));
 const r=run(['scan',source,'--out',out,'--limit','0']);assert.equal(r.status,1,r.stderr);assert.equal(JSON.parse(r.stdout).summary.scan.state,'incomplete');assert.equal(existsSync(path.join(out,'media-index.sqlite')),true);
 spawnSync('chmod',['700',blocked]);const resumed=run(['scan',source,'--out',out,'--limit','0','--resume']);assert.equal(resumed.status,0,resumed.stderr);assert.equal(JSON.parse(resumed.stdout).summary.scan.state,'complete');
});
