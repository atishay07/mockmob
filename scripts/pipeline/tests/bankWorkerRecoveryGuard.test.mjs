import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {spawnSync} from 'node:child_process';
import {BudgetLedger} from '../lib/budgetLedger.mjs';
import {currentBankWorkers,assertBankWorkersDrained,claimBankWorker,releaseBankWorker} from '../lib/bankWorkerRecoveryGuard.mjs';
const path=()=>join(mkdtempSync(join(tmpdir(),'mm-bank-guard-')),'budget.sqlite');
const worker=(pid,args='')=>({pid,command:'node --use-system-ca scripts/pipeline/tools/reassessCuetReadiness.mjs --measurement-only '+args});

test('a restarted current bank owner blocks recovery even when the saved original PID has ended',()=>{
  const ledger=new BudgetLedger(path());try{
    let dispatches=0;
    assert.throws(()=>{claimBankWorker(ledger,{contract:'frozen',selfPid:42612,readProcesses:()=>[worker(32888)],isAlive:()=>false});dispatches++;},/current_bank_worker_still_live:32888/);
    assert.equal(dispatches,0);assert.equal(ledger.snapshot().committed_micro,0);
    assert.equal(currentBankWorkers([worker(32888),worker(42612,'--recover-errors-only')],{selfPid:42612,fullOnly:true}).length,1);
  }finally{ledger.close();}
});
test('unrelated comparison and report processes do not block a drained bank; every other bank writer does',()=>{
  const ledger=new BudgetLedger(path());try{
    const other={pid:8048,command:'node scripts/pipeline/tools/cuetFitFactory.mjs worker --staging'};
    assertBankWorkersDrained(ledger.db,{processes:[other,worker(3,'--report')]});
    assert.throws(()=>assertBankWorkersDrained(ledger.db,{processes:[worker(4,'--recover-errors-only')]}),/current_bank_worker_still_live/);
  }finally{ledger.close();}
});
test('dispatching bank calls block recovery independently of process inventory',()=>{
  const ledger=new BudgetLedger(path());try{
    ledger.db.prepare("INSERT INTO requests(id,model,reserved,state,owner_pid) VALUES('active','gpt-6-luna',1000,'reserved',1)").run();
    ledger.db.prepare("INSERT INTO provider_requests VALUES('key','active','openai','dispatching',?,NULL)").run(JSON.stringify({config:{candidate_id:'reassessment:frozen:item'}}));
    assert.throws(()=>assertBankWorkersDrained(ledger.db,{processes:[]}),/bank_requests_not_drained/);
  }finally{ledger.close();}
});
test('a bounded unresolved reservation permits unrelated continuation without erasing the hold or increasing the lifetime ceiling',()=>{
  const ledger=new BudgetLedger(path());try{
    ledger.reconcileHistory({spent_usd:49.98,basis:'isolated recovery test; no paid calls',confirmed_at:new Date().toISOString()});
    const reservation=ledger.reserve('gpt-6-luna',10000);
    ledger.db.prepare("UPDATE requests SET state='unresolved' WHERE id=?").run(reservation);
    ledger.db.prepare("INSERT INTO conservative_holds VALUES(?,10000,?)").run(reservation,JSON.stringify({maximum:10000}));
    ledger.db.prepare("INSERT INTO provider_requests VALUES('unknown',?,'openai','unresolved',?,NULL)").run(reservation,JSON.stringify({config:{candidate_id:'reassessment:frozen:item'}}));
    const lease=claimBankWorker(ledger,{contract:'frozen',readProcesses:()=>[]});
    assert.throws(()=>ledger.reserve('gpt-6-luna',11000),/budget_exhausted/);
    assert.equal(ledger.snapshot().committed_micro,49990000);assert.equal(ledger.snapshot().limit_micro,50000000);
    assert.equal(ledger.db.prepare('SELECT maximum_micro FROM conservative_holds').get().maximum_micro,10000);
    releaseBankWorker(ledger,lease);
  }finally{ledger.close();}
});
test('independent processes serialize the same bank lease and cannot displace a live owner',()=>{
  const file=path(),ledger=new BudgetLedger(file);try{
    const lease=claimBankWorker(ledger,{contract:'frozen',readProcesses:()=>[]});
    const code=`import {BudgetLedger} from ${JSON.stringify(new URL('../lib/budgetLedger.mjs',import.meta.url).href)};import {claimBankWorker} from ${JSON.stringify(new URL('../lib/bankWorkerRecoveryGuard.mjs',import.meta.url).href)};const l=new BudgetLedger(${JSON.stringify(file)});try{claimBankWorker(l,{contract:'frozen',readProcesses:()=>[]});process.exitCode=1;}catch(e){process.stdout.write(e.message);process.exitCode=2;}finally{l.close();}`;
    const child=spawnSync(process.execPath,['--input-type=module','-e',code],{encoding:'utf8'});
    assert.equal(child.status,2,child.stderr);assert.match(child.stdout,/bank_worker_lease_still_live/);
    releaseBankWorker(ledger,lease);
    const resumed=claimBankWorker(ledger,{contract:'frozen',readProcesses:()=>[]});releaseBankWorker(ledger,resumed);
  }finally{ledger.close();}
});
