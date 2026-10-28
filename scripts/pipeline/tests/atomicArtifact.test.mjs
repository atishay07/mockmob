import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,readFileSync,writeFileSync,renameSync,readdirSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {saveAtomicArtifact,drainConcurrent} from '../lib/atomicArtifact.mjs';

test('temporary Windows reader lock retries without truncating the last checkpoint',()=>{
  const dir=mkdtempSync(join(tmpdir(),'mm-checkpoint-')),path=join(dir,'state.json');
  writeFileSync(path,'{"old":true}');let renames=0,waits=0;
  saveAtomicArtifact(path,{complete:true},{rename:(from,to)=>{
    renames++;if(renames<3){assert.equal(readFileSync(to,'utf8'),'{"old":true}');throw Object.assign(Error('locked'),{code:'EPERM'});}renameSync(from,to);
  },wait:()=>{waits++;}});
  assert.equal(renames,3);assert.equal(waits,2);assert.deepEqual(JSON.parse(readFileSync(path)),{complete:true});
  assert.deepEqual(readdirSync(dir),['state.json']);
});

test('persistent checkpoint failure retains both the original and complete recoverable replacement',()=>{
  const dir=mkdtempSync(join(tmpdir(),'mm-checkpoint-')),path=join(dir,'state.json');writeFileSync(path,'{"old":true}');
  let failure;try{saveAtomicArtifact(path,{receipt:'saved'},{attempts:2,rename:()=>{throw Object.assign(Error('locked'),{code:'EBUSY'});},wait:()=>{}});}catch(e){failure=e;}
  assert.match(failure.message,/artifact_checkpoint_blocked:EBUSY/);assert.equal(readFileSync(path,'utf8'),'{"old":true}');
  assert.deepEqual(JSON.parse(readFileSync(failure.checkpoint)),{receipt:'saved'});
});

test('checkpoint failure stops scheduling but drains all accepted concurrent work before returning',async()=>{
  let release;const pending=new Promise(resolve=>{release=resolve;});const started=[],finished=[];
  const execution=drainConcurrent([1,2,3,4,5],async item=>{started.push(item);if(item===1)throw Error('checkpoint_failed');await pending;finished.push(item);},{concurrency:3});
  await Promise.resolve();assert.deepEqual(started,[1,2,3]);let returned=false;execution.catch(()=>{returned=true;});
  await Promise.resolve();assert.equal(returned,false);release();await assert.rejects(execution,/checkpoint_failed/);
  assert.deepEqual(finished,[2,3]);assert.deepEqual(started,[1,2,3]);
});
