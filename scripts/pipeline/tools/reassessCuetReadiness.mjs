// Read-only bank reassessment under the current contract. No release, publication or dispute writes.
import {readFileSync,writeFileSync,mkdirSync,existsSync} from 'node:fs';
import {loadEnvFile} from 'node:process';
import {BudgetLedger} from '../lib/budgetLedger.mjs';
import {createFactoryTransport} from '../lib/factoryTransport.mjs';
import {validateFactoryCandidateV7} from '../lib/verifyV7.mjs';
import {FACTORY_VERIFIER_VERSION_V7,V7_PROMPT_HASH,TOPOLOGIES} from '../lib/factoryEvidenceV7.mjs';
import {sourceMaterial} from '../lib/factoryEvidence.mjs';
import {validationContractV7} from '../lib/contractV7.mjs';
import {assertCampaignBudget,maximumRequestMicro,requestNeedsReservation} from '../lib/campaignExecutionV7.mjs';
import {contentHash} from '../../../data/content_evidence.js';
import {bodyCandidateId,scopedAccounting} from '../lib/scopedAccounting.mjs';
import {hashJSON} from '../../../data/question_factory_policy.mjs';
import {claimBankWorker,releaseBankWorker} from '../lib/bankWorkerRecoveryGuard.mjs';
try{loadEnvFile('.env.local');}catch{}
if(!process.argv.includes('--measurement-only'))throw Error('explicit_readonly_measurement_required');
const arg=(n,d)=>{const i=process.argv.indexOf(n);return i<0?d:process.argv[i+1];};
const capUsd=Number(arg('--cap-usd',9)),concurrency=Math.min(8,Math.max(1,Number(arg('--concurrency',8))));
if(!Number.isFinite(capUsd)||capUsd<=0||capUsd>10)throw Error('bounded_reassessment_cap_required');
const dir='artifacts/question-factory/cuet-readiness-2026-10-08/reassessment',read=p=>JSON.parse(readFileSync(p,'utf8'));
mkdirSync(dir,{recursive:true});const registry=read('data/source_registry.json'),rows=read('artifacts/question-factory/continuation-500/approved-published.json');
const items=rows.map(r=>r.candidate||r),contract=validationContractV7(),profile={verifier:FACTORY_VERIFIER_VERSION_V7,prompt:V7_PROMPT_HASH,contract,topology:'dual_blind',cap_usd:capUsd,denominator:items.length,publication:'never',content_hashes:items.map(q=>[q.id,contentHash(q)]),source_refs_hash:hashJSON(items.map(q=>q.source_refs))};
if(existsSync(dir+'/profile.json')&&hashJSON(read(dir+'/profile.json'))!==hashJSON(profile))throw Error('reassessment_contract_changed_use_new_versioned_directory');
writeFileSync(dir+'/profile.json',JSON.stringify(profile,null,2)+'\n');
const resultsPath=dir+'/results.jsonl',saved=existsSync(resultsPath)?readFileSync(resultsPath,'utf8').trim().split('\n').filter(Boolean).map(JSON.parse):[];
const done=new Set(saved.filter(r=>r.verifier===profile.verifier&&r.content_hash===profile.content_hashes.find(([id])=>id===r.id)?.[1]&&r.state!=='provider_error').map(r=>r.id));
const ledger=new BudgetLedger('data/pipeline-budget.sqlite'),native=createFactoryTransport({ledger,realtimeStages:['blind_solution','independent_evaluation','explanation_support'],flexStages:['blind_solution','explanation_support']});
let pendingMaximum=0,index=0,stop=false,failure=null;
const phasePrefix=`reassessment:${contract}:`,phaseCost=()=>scopedAccounting(ledger,phasePrefix);
const stopSignal=()=>{stop=true;};process.on('SIGINT',stopSignal);process.on('SIGTERM',stopSignal);
const transport={generate:async(provider,body,options)=>{
 const key=hashJSON({reassessment:contract,prior:options.key});
 if(!requestNeedsReservation(ledger,key))return native.generate(provider,body,{...options,key});
 const maximum=maximumRequestMicro(provider,body,read('data/pipeline-prices.json'));
 const candidateId=options.candidate_id||bodyCandidateId(provider,body);if(!candidateId)throw Error('reassessment_candidate_attribution_required');
 assertCampaignBudget(phaseCost().committed_micro+pendingMaximum,maximum,capUsd);pendingMaximum+=maximum;
 try{return await native.generate(provider,body,{...options,purpose:'reassessment',candidate_id:phasePrefix+candidateId,key});}finally{pendingMaximum-=maximum;}
}};
const recoverErrorsOnly=process.argv.includes('--recover-errors-only'),latestSaved=new Map(saved.map(r=>[r.id,r]));
if(recoverErrorsOnly){
 // Require a just-observed full-bank owner; an older temporary-cap PID does
 // not prove that a restarted current worker has drained.
 const originalOwner=Number(arg('--original-owner-pid',0));
 if(!Number.isSafeInteger(originalOwner)||originalOwner<=0||originalOwner===process.pid)throw Error('verified_original_owner_pid_required');
 try{process.kill(originalOwner,0);throw Error('original_measurement_owner_still_live');}catch(e){if(e.code!=='ESRCH')throw e;}
}
const pending=items.filter(q=>!done.has(q.id)&&(!recoverErrorsOnly||latestSaved.get(q.id)?.state==='provider_error'));
function summary(){const current=existsSync(resultsPath)?readFileSync(resultsPath,'utf8').trim().split('\n').filter(Boolean).map(JSON.parse):[],latest=[...new Map(current.map(r=>[r.id,r])).values()];
 const costs=phaseCost();const out={at:new Date().toISOString(),...profile,completed:latest.filter(r=>r.state!=='provider_error').length,eligible_under_unreleased_contract:latest.filter(r=>r.state==='eligible').length,rejected:latest.filter(r=>r.state==='quarantined').length,provider_errors:latest.filter(r=>r.state==='provider_error').length,pending:items.length-latest.filter(r=>r.state!=='provider_error').length,settled_usd:costs.settled_micro/1e6,held_usd:costs.held_micro/1e6,committed_usd:costs.committed_micro/1e6,receipt_complete:costs.receipt_complete,production_writes:0,limit_stop:failure?.message||null};
 writeFileSync(dir+'/summary.json',JSON.stringify(out,null,2)+'\n');return out;
}
let bankLease;
try{if(process.argv.includes('--report')){console.log(JSON.stringify(summary()));}else{bankLease=claimBankWorker(ledger,{contract});await Promise.allSettled(Array.from({length:concurrency},async()=>{while(!stop&&!failure&&!existsSync(dir+'/STOP_AFTER_ITEM')){const q=pending[index++];if(!q)return;
 try{const {evidence,...candidate}=q,result=await validateFactoryCandidateV7(candidate,{registry,ledger,transport,topology:TOPOLOGIES.dual_blind,seen:new Set()});
 const record=result.question?.evidence?.record;const row={id:q.id,subject:q.subject,chapter:q.chapter,body:q.body,options:q.options,key:q.correct_answer,explanation:q.explanation,source_refs:q.source_refs,supporting_excerpts:sourceMaterial(registry,q.source_refs),original_evidence:q.evidence,verifier:profile.verifier,contract,content_hash:contentHash(q),state:result.state,reasons:result.reasons||[],failed_stage:result.failed_stage||null,result,new_evidence:record||null,at:new Date().toISOString()};
 writeFileSync(resultsPath,JSON.stringify(row)+'\n',{flag:'a'});const progress=summary();console.log(JSON.stringify({id:q.id,state:result.state,completed:progress.completed,eligible:progress.eligible_under_unreleased_contract,cost:progress.committed_usd}));
 }catch(e){if(/budget|pricing|history|credit|key_required/.test(e.message)){failure=e;return;}writeFileSync(resultsPath,JSON.stringify({id:q.id,verifier:profile.verifier,content_hash:contentHash(q),state:'provider_error',error:e.message})+'\n',{flag:'a'});}
 }}));console.log(JSON.stringify(summary()));if(failure)throw failure;}
}finally{if(bankLease)releaseBankWorker(ledger,bankLease);ledger.close();process.removeListener('SIGINT',stopSignal);process.removeListener('SIGTERM',stopSignal);}
