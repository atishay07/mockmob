// Remove only a verified ended process's temporary reservation cap. Holds/history
// stay in the ledger; the USD50 lifetime constraint is never changed.
import {DatabaseSync} from 'node:sqlite';
import {writeFileSync} from 'node:fs';
import {removeTemporaryOwnerBudgetCaps} from '../lib/temporaryOwnerBudgetGuard.mjs';
const pid=Number(process.argv[2]),expectedCap=Number(process.argv[3]);
if(![6916,37712].includes(pid)||!Number.isSafeInteger(expectedCap)||expectedCap<=0)throw Error('recorded_measurement_owner_required');
function ended(){try{process.kill(pid,0);}catch(e){if(e.code==='ESRCH')return true;throw e;}throw Error('measurement_owner_still_live');}
ended();const db=new DatabaseSync('data/pipeline-budget.sqlite');
try{
 if(db.prepare('SELECT limit_micro FROM budget WHERE id=1').get().limit_micro!==50000000)throw Error('global_budget_drift');
 const before=db.prepare('SELECT owner_pid,cap_micro FROM temporary_owner_budget_caps ORDER BY owner_pid').all();
 if(before.find(r=>r.owner_pid===pid)?.cap_micro!==expectedCap)throw Error('temporary_owner_cap_mismatch');
 const active=db.prepare(`SELECT r.id FROM requests r WHERE r.owner_pid=? AND
  (r.state='reserved' OR EXISTS(SELECT 1 FROM provider_requests p WHERE p.reservation_id=r.id AND p.state='dispatching')
   OR EXISTS(SELECT 1 FROM provider_batches p WHERE p.reservation_id=r.id AND p.state='dispatching'))`).all(pid);
 if(active.length)throw Error('accepted_calls_not_drained');
 const rows=db.prepare('SELECT id,state,reserved,actual FROM requests WHERE owner_pid=? ORDER BY id').all(pid);
 ended();removeTemporaryOwnerBudgetCaps(db,[pid]);
 const after=db.prepare('SELECT owner_pid,cap_micro FROM temporary_owner_budget_caps ORDER BY owner_pid').all();
 if(JSON.stringify(after)!==JSON.stringify(before.filter(r=>r.owner_pid!==pid)))throw Error('unrelated_owner_caps_changed');
 if(JSON.stringify(rows)!==JSON.stringify(db.prepare('SELECT id,state,reserved,actual FROM requests WHERE owner_pid=? ORDER BY id').all(pid)))throw Error('request_history_changed');
 const proof={at:new Date().toISOString(),owner_pid:pid,ended:true,accepted_calls_drained:true,removed_cap_micro:expectedCap,global_limit_micro:50000000,owner_requests_retained:rows.length,history_changes:0,other_caps_unchanged:true};
 writeFileSync(`artifacts/question-factory/cuet-readiness-2026-10-08/temporary-owner-cap-cleared-${pid}.json`,JSON.stringify(proof,null,2)+'\n',{flag:'wx'});console.log(JSON.stringify(proof));
}finally{db.close();}
