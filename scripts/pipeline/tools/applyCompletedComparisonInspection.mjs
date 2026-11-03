// Apply only hash-pinned automatic measurement exclusions; no publication or provider calls.
import {DatabaseSync} from 'node:sqlite';
import {readFileSync,writeFileSync,existsSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {hashJSON} from '../../../data/question_factory_policy.mjs';
const dir='artifacts/question-factory/completed-ab-inspection-2026-10-08',path=dir+'/measurement-inspection.json';
const bytes=readFileSync(path),sha=createHash('sha256').update(bytes).digest('hex'),proof=JSON.parse(bytes);
if(proof.read_only!==true||proof.project_ref!=='onwkqxmjqjrhfbjjdydu'||proof.comparisons?.length!==2||proof.publication_writes!==0)throw Error('completed_comparison_proof_required');
const db=new DatabaseSync('data/pipeline-budget.sqlite'),journalPath=dir+'/local-withholding-applied.json';
const live=owner=>{const pid=Number(String(owner||'').split(':')[0]);if(!Number.isSafeInteger(pid)||pid<=0)return false;try{process.kill(pid,0);return true;}catch(e){return e.code==='EPERM';}};
const backup=[],changes=[];db.exec('BEGIN IMMEDIATE');
try{
 for(const [table,query]of [['factory_worker','SELECT owner FROM factory_worker WHERE id=1'],['factory_campaign_controller','SELECT owner FROM factory_campaign_controller WHERE id=1']]){
  if(db.prepare("SELECT 1 FROM sqlite_master WHERE type='table' AND name=?").get(table)&&live(db.prepare(query).get()?.owner))throw Error('measurement_writer_must_drain_before_withholding');
 }
 for(const arm of proof.comparisons){
  const ids=arm.registered_contract.approved_candidate_ids;
  if(arm.denominator!==100||arm.preinspection.states.eligible!==ids.length||arm.accounting.pending!==0)throw Error('fixed_terminal_comparison_required');
  const saved=JSON.parse(readFileSync('artifacts/question-factory/'+arm.campaign_id+'/all-candidates.json','utf8'));
  if(hashJSON(saved.map(j=>({id:j.id,candidate:j.candidate,result:j.result})))!==arm.content_hash)throw Error('comparison_export_changed');
  for(const decision of arm.proposed.decisions){
   if(decision.reason!=='duplicate_lexical_target'||!ids.includes(decision.id))throw Error('reviewed_duplicate_decision_required');
   const row=db.prepare('SELECT value FROM factory_candidates WHERE id=?').get(decision.id);
   if(!row)throw Error('candidate_missing');const item=JSON.parse(row.value),original=saved.find(j=>j.id===decision.id);
   if(item.inspection_withholding?.proof_sha256===sha){changes.push({id:item.id,already_applied:true});continue;}
   if(item.state!=='eligible'||hashJSON({candidate:item.candidate,result:item.result})!==hashJSON({candidate:original.candidate,result:original.result}))throw Error('candidate_changed_since_inspection');
   backup.push({id:item.id,value:row.value});
   item.state='quarantined';item.result={...item.result,state:'quarantined',reasons:[decision.reason],inspection:decision};
   item.inspection_withholding={proof_sha256:sha,at:new Date().toISOString(),original_verdict:original.result,reason:decision.reason};
   if(db.prepare('UPDATE factory_candidates SET value=? WHERE id=? AND value=?').run(JSON.stringify(item),item.id,row.value).changes!==1)throw Error('candidate_cas_failed');
   changes.push({id:item.id,arm:arm.arm,reason:decision.reason,duplicate_of:decision.duplicate_of});
  }
 }
 if(!existsSync(dir+'/local-candidates-before-withholding.json'))writeFileSync(dir+'/local-candidates-before-withholding.json',JSON.stringify({proof_sha256:sha,backup},null,2)+'\n',{flag:'wx'});
 db.exec('COMMIT');
 writeFileSync(journalPath,JSON.stringify({at:new Date().toISOString(),proof_sha256:sha,changes,provider_calls:0,staging_writes:0,production_writes:0,cost_changes:0},null,2)+'\n');
 console.log(JSON.stringify({journal:journalPath,changes:changes.length,provider_calls:0,production_writes:0}));
}catch(e){db.exec('ROLLBACK');throw e;}finally{db.close();}
