import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawn } from 'node:child_process';
import { BudgetLedger, budgetedFetch } from '../lib/budgetLedger.mjs';
import { contentHash, evidenceSignature, evaluateEvidence } from '../../../data/content_evidence.js';

test('restart retains reservations; zero yield pauses; missing usage prevents dispatch', () => {
  const file=join(mkdtempSync(join(tmpdir(),'mockmob-budget-')),'ledger.sqlite');
  let ledger=new BudgetLedger(file,0.1); const id=ledger.reserve('fixture',60000); ledger.close();
  ledger=new BudgetLedger(file,10); assert.equal(ledger.snapshot().limit_micro,100000);
  assert.throws(()=>ledger.reserve('fixture',50000),/exhausted/);
  ledger.recordBatch('english',0); ledger.close(); ledger=new BudgetLedger(file);
  ledger.recordBatch('english',0); assert.throws(()=>ledger.assertRoute('english'),/paused/);
  ledger.settle(id,null); assert.throws(()=>ledger.reserve('fixture',1),/unresolved/);
  assert.equal(ledger.claimRepair('candidate'),true); assert.equal(ledger.claimRepair('candidate'),false);
  ledger.close();
});
test('concurrent processes cannot reserve beyond a shared ceiling', async () => {
  const file=join(mkdtempSync(join(tmpdir(),'mockmob-concurrent-')),'ledger.sqlite');
  const ledger=new BudgetLedger(file,0.1); ledger.close();
  const ledgerModule=new URL('../lib/budgetLedger.mjs',import.meta.url).href;
  const script=`import {BudgetLedger} from ${JSON.stringify(ledgerModule)}; const l=new BudgetLedger(process.argv[1]); try{l.reserve('fixture',60000);console.log('reserved')}catch{console.log('blocked')}finally{l.close()}`;
  const run=()=>new Promise((resolve,reject)=>{ const child=spawn(process.execPath,['--input-type=module','-e',script,file]);let out='';child.stdout.on('data',s=>out+=s);child.on('error',reject);child.on('exit',code=>code===0?resolve(out.trim()):reject(new Error('child failed'))); });
  assert.deepEqual((await Promise.all([run(),run(),run()])).sort(),['blocked','blocked','reserved']);
});

test('transport counts every request and stops on absent usage, unknown prices or wrong provider',async()=>{
 const ledger=new BudgetLedger(join(mkdtempSync(join(tmpdir(),'mockmob-transport-')),'ledger.sqlite'));
 let calls=0,usage={prompt_tokens:10,completion_tokens:5};
 const price={provider_host:'fixture.invalid',input_per_million:1,output_per_million:2,max_input_tokens:1000};
 const prices={expires_at:'2099-01-01',source_url:'https://fixture.invalid/prices',models:{fixture:price}};
 const dispatch=budgetedFetch(async()=>{calls++;return Response.json({usage});},{getPrices:()=>prices,getLedger:()=>ledger});
 const body=JSON.stringify({model:'fixture',max_tokens:20,messages:[]});
 try{
  await assert.rejects(dispatch('https://other.invalid/chat/completions',{body}),/pricing/);assert.equal(calls,0);
  await assert.rejects(dispatch('https://fixture.invalid/chat/completions',{body:JSON.stringify({model:'unknown',max_tokens:20})}),/pricing/);assert.equal(calls,0);
  await dispatch('https://fixture.invalid/chat/completions',{body});await dispatch('https://fixture.invalid/chat/completions',{body});
  assert.equal(ledger.snapshot().requests,2);assert.equal(ledger.snapshot().committed_micro,40);
  usage=undefined;await assert.rejects(dispatch('https://fixture.invalid/chat/completions',{body}),/usage_unresolved/);
  await assert.rejects(dispatch('https://fixture.invalid/chat/completions',{body}),/budget_usage_unresolved/);assert.equal(calls,3);
 }finally{ledger.close();}
});

function fixture() {
  const q={id:'easy',family_id:'f',subject:'economics',chapter:'Fixture',body:'Which listed value equals 2 + 2?',options:['4','5','6','7'],correctIndex:0,explanation:'Adding two to two gives four.'};
  const registry={secret:'test-only',sources:{s:{state:'active',version:'1',reuse_permitted:true,supports:{'p1':'support'}}},families:{f:{state:'active',version:'1'}}};
  const record={candidate_id:q.id,content_hash:contentHash(q),state:'eligible',route:'numerical',verifier_version:'fixture-v1',verified_at:new Date().toISOString(),expires_at:'2099-01-01',family_id:'f',family_version:'1',solved_key:'A',sources:[{id:'s',version:'1',locator:'p1',support_hash:'support'}],checks:{}};
  for(const name of ['schema','dedupe','source_support','blind_solution','alternatives','explanation_support','exam_fit','independent_solver','boundary_cases']) record.checks[name]={passed:true,evidence_hash:'result',candidate_id:q.id,content_hash:record.content_hash};
  q.evidence={record,signature:evidenceSignature(record,registry.secret)};
  return {q,registry};
}
test('complete direct-recall fixture passes without a conceptual-depth requirement',()=>{ const {q,registry}=fixture(); assert.equal(evaluateEvidence(q,registry).eligible,true); });
test('missing, swapped, mock, changed, false citation and quarantined family evidence fails',()=>{
  const mutations=[(q)=>delete q.evidence.record.checks.blind_solution,(q)=>q.evidence.record.candidate_id='other',
    (q)=>q.evidence.record.mock=true,(q)=>q.body+=' changed',
    (q)=>q.evidence.record.sources[0].support_hash='false',
    (_q,r)=>r.families.f.state='quarantined'];
  for(const mutate of mutations){const {q,registry}=fixture();mutate(q,registry);q.evidence.signature=evidenceSignature(q.evidence.record,registry.secret);assert.equal(evaluateEvidence(q,registry).eligible,false);}
  const {q,registry}=fixture();delete q.evidence;assert.equal(evaluateEvidence(q,registry).eligible,false);
});
