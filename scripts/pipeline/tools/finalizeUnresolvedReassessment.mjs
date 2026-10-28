// Quarantine unavailable verification after the writer drains. This never
// dispatches, settles spending, changes native request state or publishes.
import {readFileSync,writeFileSync} from 'node:fs';
import {DatabaseSync} from 'node:sqlite';
import {assertBankWorkersDrained} from '../lib/bankWorkerRecoveryGuard.mjs';
import {unresolvedReassessmentDecision} from '../lib/unresolvedReassessment.mjs';
import {validationContractV7} from '../lib/contractV7.mjs';
import {sourceMaterial} from '../lib/factoryEvidence.mjs';
const root='artifacts/question-factory/cuet-readiness-2026-10-08/reassessment',read=p=>JSON.parse(readFileSync(p,'utf8'));
const profile=read(root+'/profile.json'),registry=read('data/source_registry.json');
if(profile.contract!==validationContractV7()||profile.publication!=='never')throw Error('frozen_reassessment_contract_changed');
const raw=readFileSync(root+'/results.jsonl','utf8');if(!raw.endsWith('\n'))throw Error('reassessment_append_not_drained');
const latest=new Map(raw.split('\n').filter(Boolean).map(JSON.parse).map(r=>[r.id,r])),bank=read('artifacts/question-factory/continuation-500/approved-published.json').map(r=>r.candidate||r);
const db=new DatabaseSync('data/pipeline-budget.sqlite',{readOnly:true});
try{
  if(process.argv.includes('--apply'))assertBankWorkersDrained(db);
  const decisions=[];
  for(const question of bank){
    const row=latest.get(question.id);if(row?.state!=='provider_error'||row.error!=='provider_request_unresolved_do_not_resubmit')continue;
    const requests=db.prepare(`SELECT r.*,p.id provider_key,p.provider,p.state provider_state,p.request_json,p.response_json,h.maximum_micro,h.proof_json
      FROM requests r JOIN provider_requests p ON p.reservation_id=r.id LEFT JOIN conservative_holds h ON h.reservation_id=r.id
      WHERE json_extract(p.request_json,'$.config.candidate_id')=?`).all('reassessment:'+profile.contract+':'+question.id);
    const decision=unresolvedReassessmentDecision(question,row,profile,requests);
    const complete={...decision,subject:question.subject,chapter:question.chapter,body:question.body,options:question.options,key:question.correct_answer,
      explanation:question.explanation,passage_text:question.passage_text||null,source_refs:question.source_refs,
      supporting_excerpts:sourceMaterial(registry,question.source_refs),original_evidence:question.evidence,at:new Date().toISOString()};
    decisions.push(complete);
    if(process.argv.includes('--apply'))writeFileSync(root+'/results.jsonl',JSON.stringify(complete)+'\n',{flag:'a'});
  }
  const proof={at:new Date().toISOString(),mode:process.argv.includes('--apply')?'applied_local_quarantine':'dry_run',decisions,
    provider_calls:0,ledger_writes:0,publication_writes:0,production_writes:0,native_usage_resolved:false};
  writeFileSync(root+'/unresolved-quarantine-'+(process.argv.includes('--apply')?'applied':'dry-run')+'.json',JSON.stringify(proof,null,2)+'\n');
  console.log(JSON.stringify({mode:proof.mode,quarantined:decisions.length,held_micro:decisions.flatMap(r=>r.unresolved_requests).reduce((n,r)=>n+r.maximum_micro,0),provider_calls:0,ledger_writes:0,publication_writes:0}));
}finally{db.close();}
