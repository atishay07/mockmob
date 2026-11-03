// Reconstruct the failed final report write from immutable inputs and saved results.
// No BudgetLedger constructor, provider transport, reservation, cache mutation or runner resume.
import {readFileSync,writeFileSync,existsSync,mkdirSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {DatabaseSync} from 'node:sqlite';
import {expectedReleaseBindingV77,verifyV77Freeze,verifyV77TransportFreeze,V77_TRANSPORT_DEPENDENCIES,qualificationAccountingV77} from '../../../../scripts/pipeline/lib/freshCuetReadinessV77Guards.mjs';
import {assessReleaseEvidenceV77} from '../../../../scripts/pipeline/lib/releaseEvidenceV77.mjs';
const root='artifacts/question-factory/cuet-readiness-2026-10-09',studyRoot=root+'/v77-qualification';
const read=p=>JSON.parse(readFileSync(p)),sha=p=>createHash('sha256').update(readFileSync(p)).digest('hex');
if(existsSync('data/question-factory-runtime/v77-qualification-owner.json'))throw Error('existing_worker_owner_present');
verifyV77Freeze('.');verifyV77TransportFreeze('.',V77_TRANSPORT_DEPENDENCIES);
const auth=read(root+'/execution/v77-final-execution-authorization.json'),binding=expectedReleaseBindingV77();
const frozen={},results={},inputBindings={};
for(const role of ['fresh','regression']){
 const dir=`${studyRoot}/v77-qualification-2026-10-09-final-${role}-integrated`;
 const path=dir+'/frozen.json',rpath=dir+'/run/results.json';
 if(sha(path)!==auth.study_payloads[role].frozen_sha256)throw Error('authorization_frozen_hash_mismatch:'+role);
 frozen[role]=read(path);results[role]=read(rpath);
 if(JSON.stringify(frozen[role].contract_binding)!==JSON.stringify(binding)||JSON.stringify(results[role].contract_binding)!==JSON.stringify(binding)||results[role].benchmark?.payload_hash!==frozen[role].payload_hash)throw Error('result_binding_mismatch:'+role);
 inputBindings[role]={frozen_sha256:sha(path),results_sha256:sha(rpath)};
}
const db=new DatabaseSync('data/pipeline-budget.sqlite',{readOnly:true});
const pending=db.prepare("SELECT COUNT(*) count FROM provider_requests WHERE json_extract(request_json,'$.config.candidate_id') LIKE 'v77-qualification-2026-10-09-%' AND state!='complete'").get().count;
if(pending){db.close();throw Error('submitted_requests_still_pending');}
const accounting=qualificationAccountingV77({db});db.close();
if(!accounting.receipt_complete||accounting.held_micro!==0)throw Error('preserve_unsettled_receipts');
const executionFinished=['fresh','regression'].every(role=>{
 const expected=frozen[role].fixtures.map(x=>x.id),rows=results[role].topologies?.dual_blind||[];
 return rows.length===expected.length&&expected.every(id=>rows.some(x=>x.id===id&&['eligible','quarantined'].includes(x.state)))&&expected.every(id=>['openai','gemini'].every(p=>results[role].evaluations?.[id]?.[p]?.status==='judged'));
});
const assessment=assessReleaseEvidenceV77({resultFresh:results.fresh,frozenFresh:frozen.fresh,resultRegression:results.regression,frozenRegression:frozen.regression,binding,accounting,receiptComplete:true,executionFinished});
const dir=studyRoot+'/execution',path=dir+'/v77-release-assessment.json';
if(existsSync(path))throw Error('preserve_existing_assessment');
mkdirSync(dir,{recursive:true});
writeFileSync(path,JSON.stringify(assessment,null,2)+'\n',{flag:'wx'});
writeFileSync(dir+'/v77-release-assessment-reconstruction.json',JSON.stringify({at:new Date().toISOString(),scope:'Receipt-only reconstruction of final report after original ENOENT directory error; no native execution or qualification change',original_runner:'scripts/pipeline/tools/runFreshCuetReadinessV77Integrated.mjs',original_runner_sha256:sha('scripts/pipeline/tools/runFreshCuetReadinessV77Integrated.mjs'),original_execution_log_sha256:sha(root+'/execution/v77-final-native-execution.log'),inputBindings,execution_finished:executionFinished,accounting,assessment_sha256:sha(path),helper_sha256:sha(new URL(import.meta.url))},null,2)+'\n',{flag:'wx'});
console.log(JSON.stringify({assessment,provider_requests:accounting.requests.length,settled_usd:accounting.settled_micro/1e6,held_usd:accounting.held_micro/1e6}));
