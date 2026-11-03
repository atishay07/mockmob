// Receipt-only export of the stopped V7.12 measurement pilot. Reads the frozen
// campaign/state and provider ledger in read-only mode. Never reserves, polls,
// submits, acquires/releases a lease, or changes candidate state.
import {createHash} from 'node:crypto';
import {existsSync,mkdirSync,readFileSync,writeFileSync} from 'node:fs';
import {DatabaseSync} from 'node:sqlite';

const campaignDir='artifacts/question-factory/cuet-pilot-v712-40-2026-10-09';
const campaignPath=`${campaignDir}/campaign.json`;
const statePath=`${campaignDir}/state.json`;
const preregPath=`${campaignDir}/PREREGISTRATION.json`;
const ledgerPath=process.env.CUET_BUDGET_LEDGER||'data/pipeline-budget.sqlite';
const outDir='artifacts/question-factory/cuet-readiness-2026-10-09/execution/final-pass-v713';
const hash=value=>createHash('sha256').update(value).digest('hex');
const readBytes=path=>readFileSync(path);
const parseJson=(bytes,path)=>{try{return JSON.parse(bytes.toString('utf8'));}catch(error){throw Error(`invalid_json:${path}:${error.message}`);}};
const campaignBytes=readBytes(campaignPath),stateBytes=readBytes(statePath),preregBytes=readBytes(preregPath);
const campaign=parseJson(campaignBytes,campaignPath),state=parseJson(stateBytes,statePath),prereg=parseJson(preregBytes,preregPath);
const jobs=campaign.jobs||[],ids=jobs.map(job=>job.id);
if(campaign.id!=='cuet-pilot-v712-40-2026-10-09'||jobs.length!==40||new Set(ids).size!==40||state.campaign_id!==campaign.id)throw Error('frozen_pilot_identity_mismatch');
if(!state.jobs||Object.keys(state.jobs).length!==40||ids.some(id=>!state.jobs[id]))throw Error('frozen_pilot_state_denominator_mismatch');

const db=new DatabaseSync(ledgerPath,{readOnly:true});
let ledgerSnapshot,providerRows,receiptOnlyRows,leases,workerRows,controllerRows;
try{
  db.exec('BEGIN');
  const tableExists=name=>Boolean(db.prepare('SELECT 1 FROM sqlite_master WHERE type=? AND name=?').get('table',name));
  const required=['requests','provider_requests','provider_batches','factory_measurement_leases_vnext','factory_worker','factory_campaign_controller'];
  if(required.some(name=>!tableExists(name)))throw Error('required_read_only_ledger_tables_missing');
  leases=db.prepare('SELECT campaign_id,owner,owner_pid,state,expires,contract_hash FROM factory_measurement_leases_vnext WHERE campaign_id=?').all(campaign.id);
  workerRows=db.prepare('SELECT * FROM factory_worker').all();
  controllerRows=db.prepare('SELECT * FROM factory_campaign_controller').all();
  const ownerAlive=pid=>{if(!Number.isSafeInteger(pid)||pid<=0)return false;try{process.kill(pid,0);return true;}catch(error){return error.code==='EPERM';}};
  if(leases.some(row=>row.state==='active'&&(row.owner||ownerAlive(row.owner_pid))))throw Error('pilot_measurement_lease_active_refuse_export');

  providerRows=db.prepare(`SELECT r.id AS reservation_id,r.model,r.reserved,r.actual,r.state AS request_state,r.created_at,r.receipt_json,
      p.id AS request_key,p.provider,p.provider_id,p.state AS provider_state,p.request_json,p.response_json,'batch' AS transport
    FROM provider_batches p JOIN requests r ON r.id=p.reservation_id
    UNION ALL
    SELECT r.id AS reservation_id,r.model,r.reserved,r.actual,r.state AS request_state,r.created_at,r.receipt_json,
      p.id AS request_key,p.provider,NULL AS provider_id,p.state AS provider_state,p.request_json,p.response_json,'realtime' AS transport
    FROM provider_requests p JOIN requests r ON r.id=p.reservation_id`).all();
  receiptOnlyRows=db.prepare(`SELECT id AS reservation_id,model,reserved,actual,state AS request_state,created_at,receipt_json
    FROM requests WHERE receipt_json IS NOT NULL`).all();
  ledgerSnapshot=db.prepare(`SELECT (SELECT limit_micro FROM budget WHERE id=1) AS limit_micro,
      COALESCE(SUM(CASE WHEN state='settled' THEN actual ELSE MAX(reserved,COALESCE(actual,0)) END),0) AS committed_micro,
      SUM(CASE WHEN state='settled' THEN actual ELSE 0 END) AS settled_or_zero_micro,
      SUM(CASE WHEN state='settled' THEN 0 ELSE MAX(reserved,COALESCE(actual,0)) END) AS held_micro,
      COUNT(*) AS request_count,
      SUM(CASE WHEN state='unresolved' THEN 1 ELSE 0 END) AS unresolved_count
    FROM requests`).get();
  db.exec('COMMIT');
}catch(error){try{db.exec('ROLLBACK');}catch{}throw error;}finally{db.close();}

const bodyCandidateId=(provider,body)=>{
  if(!body||typeof body!=='object')return null;
  const raw=provider==='openai'?body.input?.find(row=>row.role==='user')?.content:
    provider==='anthropic'?body.messages?.[0]?.content:body.contents?.[0]?.parts?.[0]?.text;
  try{const parsed=JSON.parse(raw);return parsed.candidate_id||parsed.job_id||parsed.candidate?.id||null;}catch{return null;}
};
const idsSet=new Set(ids),campaignPrefix=`${campaign.id}:`,requestsByCandidate=new Map(ids.map(id=>[id,[]])),seenReservations=new Set();
const unprefix=id=>typeof id==='string'&&id.startsWith(campaignPrefix)?id.slice(campaignPrefix.length):id;
for(const row of providerRows){
  let saved;try{saved=JSON.parse(row.request_json||'null');}catch{continue;}
  const config=saved?.config||{},candidateId=bodyCandidateId(config.provider||row.provider,saved?.body)||unprefix(config.candidate_id);
  if(!idsSet.has(candidateId)||seenReservations.has(row.reservation_id))continue;
  seenReservations.add(row.reservation_id);
  let receipt=null,response=null;
  try{receipt=row.receipt_json?JSON.parse(row.receipt_json):null;}catch{}
  try{response=row.response_json?JSON.parse(row.response_json):null;}catch{}
  const committed=row.request_state==='settled'?(row.actual||0):Math.max(row.reserved||0,row.actual||0);
  const item={candidate_id:candidateId,request_key:row.request_key,transport:row.transport,provider:row.provider,model:row.model,
    stage:config.stage||null,purpose:config.purpose||null,provider_id:row.provider_id||null,provider_state:row.provider_state,
    reservation_id:row.reservation_id,request_state:row.request_state,reserved_micro:row.reserved,actual_micro:row.actual,
    settled_micro:row.request_state==='settled'?(row.actual||0):0,held_micro:row.request_state==='settled'?0:committed,
    created_at:row.created_at,request_body_sha256:saved?.body?hash(JSON.stringify(saved.body)):null,
    receipt,response_saved:Boolean(response),provider_response_id:response?.responseId||response?.id||response?.response?.responseId||null};
  requestsByCandidate.get(candidateId).push(item);
}
for(const row of receiptOnlyRows){
  if(seenReservations.has(row.reservation_id))continue;
  let receipt=null;try{receipt=row.receipt_json?JSON.parse(row.receipt_json):null;}catch{}
  const candidateId=unprefix(receipt?.candidate_id);
  if(!idsSet.has(candidateId))continue;
  seenReservations.add(row.reservation_id);
  const committed=row.request_state==='settled'?(row.actual||0):Math.max(row.reserved||0,row.actual||0);
  requestsByCandidate.get(candidateId).push({candidate_id:candidateId,request_key:receipt?.idempotency_key||null,transport:'receipt_only',
    provider:receipt?.provider||null,model:row.model,stage:receipt?.stage||null,purpose:receipt?.purpose||null,provider_id:receipt?.provider_batch_id||null,
    provider_state:null,reservation_id:row.reservation_id,request_state:row.request_state,reserved_micro:row.reserved,actual_micro:row.actual,
    settled_micro:row.request_state==='settled'?(row.actual||0):0,held_micro:row.request_state==='settled'?0:committed,created_at:row.created_at,
    request_body_sha256:null,receipt,response_saved:false,provider_response_id:receipt?.provider_request_id||null});
}

const summaryCounts={},bySubject={};
const rows=jobs.map(job=>{
  const original=state.jobs[job.id],requests=requestsByCandidate.get(job.id).sort((a,b)=>(a.stage||'').localeCompare(b.stage||'')||(a.request_key||'').localeCompare(b.request_key||''));
  const result=original.result||{};
  const settled=requests.reduce((sum,row)=>sum+row.settled_micro,0),held=requests.reduce((sum,row)=>sum+row.held_micro,0);
  const originalState=original.state||'queued';
  summaryCounts[originalState]=(summaryCounts[originalState]||0)+1;
  const subject=job.subject;
  bySubject[subject]??={denominator:0,states:{},settled_micro:0,held_micro:0};
  bySubject[subject].denominator++;
  bySubject[subject].states[originalState]=(bySubject[subject].states[originalState]||0)+1;
  bySubject[subject].settled_micro+=settled;bySubject[subject].held_micro+=held;
  return {candidate_id:job.id,number:job.number,subject,chapter:job.chapter,format_intended:job.format,difficulty_intended:job.difficulty,
    original_state:originalState,repair_count:original.repair_count||0,original_result:result,
    original_failure:original.author_failure||null,original_candidate:original.candidate||null,
    pending_key:original.pending||null,request_keys:requests.map(row=>row.request_key).filter(Boolean),
    rejection_reasons:originalState==='quarantined'?(result.reasons||[]):[],provider_error:result.provider_error===true,
    failed_stage:result.failed_stage||null,error_reason:result.provider_error===true?(result.reasons||[]).join('; ')||result.error||'provider_error':null,
    requests,request_count:requests.length,settled_micro:settled,held_micro:held,committed_micro:settled+held,
    settled_usd:settled/1e6,held_usd:held/1e6,committed_usd:(settled+held)/1e6};
});
const totals=rows.reduce((acc,row)=>({settled_micro:acc.settled_micro+row.settled_micro,held_micro:acc.held_micro+row.held_micro,
  committed_micro:acc.committed_micro+row.committed_micro,requests:acc.requests+row.request_count}),{settled_micro:0,held_micro:0,committed_micro:0,requests:0});
const report={schema:'stopped-v712-pilot-receipt-export-v1',captured_at:new Date().toISOString(),campaign_id:campaign.id,
  mode:'receipt_only_read_only',side_effects:{provider_calls:0,ledger_writes:0,lease_changes:0,candidate_state_changes:0,publication_writes:0},
  source_hashes:{campaign_sha256:hash(campaignBytes),state_sha256:hash(stateBytes),preregistration_sha256:hash(preregBytes)},
  registration:{denominator:jobs.length,contract:campaign.contract||null,cap_usd:prereg.cap_usd??campaign.cap_usd??null,stop_reason:state.stop_reason||null,
    preregistration_sha256:hash(preregBytes),original_state_sha256:hash(stateBytes)},
  state_counts:summaryCounts,by_subject:bySubject,totals:{...totals,settled_usd:totals.settled_micro/1e6,held_usd:totals.held_micro/1e6,
    committed_usd:totals.committed_micro/1e6,receipt_complete:rows.every(row=>row.requests.every(request=>request.request_state==='settled'))},
  ledger_snapshot:{limit_micro:ledgerSnapshot.limit_micro,committed_micro:ledgerSnapshot.committed_micro,settled_micro:ledgerSnapshot.settled_or_zero_micro,
    held_micro:ledgerSnapshot.held_micro,request_count:ledgerSnapshot.request_count,unresolved_count:ledgerSnapshot.unresolved_count},
  process_and_lease_snapshot:{worker_rows:workerRows,controller_rows:controllerRows,measurement_leases:leases,active_pilot_lease:false,
    note:'Process inventory is external to this export; this tool checks the durable pilot lease read-only and refuses to export when an owner is present.'},
  candidates:rows};
if(report.candidates.length!==40||report.candidates.reduce((n,row)=>n+row.request_count,0)!==totals.requests)throw Error('export_denominator_or_cost_conservation_failed');

const csvCell=value=>'"'+String(value&&typeof value==='object'?JSON.stringify(value):value??'').replaceAll('"','""')+'"';
const columns=['number','candidate_id','subject','chapter','format_intended','difficulty_intended','original_state','repair_count','failed_stage','provider_error','rejection_reasons','pending_key','request_keys','request_count','settled_usd','held_usd','committed_usd','original_candidate'];
const csv=[columns,...rows.map(row=>columns.map(column=>{
  const value=column==='original_candidate'?row.original_candidate:column==='settled_usd'||column==='held_usd'||column==='committed_usd'?row[column]:row[column];
  return csvCell(value);
}))].map(line=>line.join(',')).join('\r\n')+'\r\n';
mkdirSync(outDir,{recursive:true});
const stamp=new Date().toISOString().replace(/[-:.]/g,'');
const base=`${outDir}/v712-pilot-receipt-export-${stamp}`;
for(const path of [`${base}.json`,`${base}.csv`])if(existsSync(path))throw Error('export_output_collision');
writeFileSync(`${base}.json`,JSON.stringify(report,null,2)+'\n',{flag:'wx'});
writeFileSync(`${base}.csv`,csv,{flag:'wx'});
console.log(JSON.stringify({schema:report.schema,campaign_id:report.campaign_id,candidate_count:rows.length,state_counts:summaryCounts,
  requests:totals.requests,settled_usd:report.totals.settled_usd,held_usd:report.totals.held_usd,committed_usd:report.totals.committed_usd,
  receipt_complete:report.totals.receipt_complete,outputs:[`${base}.json`,`${base}.csv`],side_effects:report.side_effects}));
