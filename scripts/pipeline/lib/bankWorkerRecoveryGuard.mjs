import {execFileSync} from 'node:child_process';
import {randomUUID} from 'node:crypto';

const TABLE='bank_reassessment_worker_lease';
export const pidAlive=pid=>{try{process.kill(pid,0);return true;}catch(e){if(e.code==='ESRCH')return false;if(e.code==='EPERM')return true;throw e;}};

// Read the current process inventory rather than trusting a saved PID. An old
// owner can have exited while a restarted worker is processing the same bank.
export function readBankWorkerProcesses(){
  if(process.platform!=='win32')throw Error('bank_process_inventory_platform_unavailable');
  const raw=execFileSync('powershell.exe',['-NoProfile','-NonInteractive','-Command',
    "Get-CimInstance Win32_Process -Filter \"Name = 'node.exe'\" | Select-Object ProcessId,CommandLine | ConvertTo-Json -Depth 3"],
    {encoding:'utf8',windowsHide:true,timeout:20000});
  const value=raw.trim()?JSON.parse(raw):[];
  return (Array.isArray(value)?value:[value]).map(p=>({pid:Number(p.ProcessId),command:String(p.CommandLine||'')}));
}

export function currentBankWorkers(processes,{selfPid=process.pid,fullOnly=false}={}){
  if(!Array.isArray(processes))throw Error('current_bank_process_inventory_required');
  return processes.filter(p=>p.pid!==selfPid&&Number.isSafeInteger(p.pid)&&p.pid>0&&
    /(?:^|[\s"\\/])reassessCuetReadiness\.mjs(?:[\s"]|$)/i.test(p.command)&&
    !/(?:^|\s)--report(?:\s|$)/.test(p.command)&&
    (!fullOnly||!/(?:^|\s)--recover-errors-only(?:\s|$)/.test(p.command)));
}

export function activeBankRequests(db){
  return db.prepare(`SELECT DISTINCT r.id,r.owner_pid FROM requests r JOIN
    (SELECT reservation_id,state,request_json FROM provider_requests UNION ALL
     SELECT reservation_id,state,request_json FROM provider_batches) p ON p.reservation_id=r.id
    WHERE json_extract(p.request_json,'$.config.candidate_id') LIKE 'reassessment:%'
      AND (r.state='reserved' OR p.state='dispatching')`).all();
}

export function assertBankWorkersDrained(db,{processes=readBankWorkerProcesses(),selfPid=process.pid}={}){
  const workers=currentBankWorkers(processes,{selfPid});
  if(workers.length)throw Error('current_bank_worker_still_live:'+workers.map(p=>p.pid).join(','));
  if(activeBankRequests(db).length)throw Error('bank_requests_not_drained');
}

// The SQLite transaction also closes the simultaneous-start race. Unresolved
// calls remain held by BudgetLedger; they are not active requests and are never
// resent by this lease or counted as zero-cost work.
export function claimBankWorker(ledger,{contract,readProcesses=readBankWorkerProcesses,isAlive=pidAlive,selfPid=process.pid}={}){
  if(typeof contract!=='string'||!contract)throw Error('bank_worker_contract_required');
  const db=ledger.db;
  db.exec(`CREATE TABLE IF NOT EXISTS ${TABLE}(id INTEGER PRIMARY KEY CHECK(id=1),owner TEXT,owner_pid INTEGER,contract TEXT)`);
  return ledger.transaction(()=>{
    const prior=db.prepare(`SELECT * FROM ${TABLE} WHERE id=1`).get();
    if(prior?.owner&&isAlive(prior.owner_pid))throw Error('bank_worker_lease_still_live');
    assertBankWorkersDrained(db,{processes:readProcesses(),selfPid});
    const owner=selfPid+':'+randomUUID();
    db.prepare(`INSERT INTO ${TABLE} VALUES(1,?,?,?) ON CONFLICT(id) DO UPDATE SET owner=excluded.owner,owner_pid=excluded.owner_pid,contract=excluded.contract`).run(owner,selfPid,contract);
    return {owner,contract};
  });
}

export function releaseBankWorker(ledger,lease){
  if(!lease?.owner)throw Error('bank_worker_lease_owner_required');
  const result=ledger.db.prepare(`UPDATE ${TABLE} SET owner=NULL,owner_pid=NULL WHERE id=1 AND owner=? AND contract=?`).run(lease.owner,lease.contract);
  if(Number(result.changes)!==1)throw Error('bank_worker_release_owner_mismatch');
}
