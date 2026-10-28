import {readFileSync,writeFileSync,existsSync,mkdirSync,copyFileSync,unlinkSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {DatabaseSync} from 'node:sqlite';
import {bindBenchmarkFixtureFamily,FIXTURE_ENVELOPE_CONTRACT} from '../lib/benchmarkFixtureEnvelope.mjs';
import {saveAtomicArtifact} from '../lib/atomicArtifact.mjs';
const dir='artifacts/question-factory/cuet-readiness-2026-10-08/benchmark/fresh-full-v6-source-keyed',run=dir+'/run';
const read=p=>JSON.parse(readFileSync(p,'utf8')),sha=p=>createHash('sha256').update(readFileSync(p)).digest('hex');
const frozen=read(dir+'/frozen.json'),plan=read(run+'/execution-plan.json'),results=read(run+'/results.json');
if(existsSync(run+'/fixture-envelope-resume.json'))throw Error('resume_certificate_already_exists');
const ledger=new DatabaseSync('data/pipeline-budget.sqlite',{readOnly:true});
try{
 const active=ledger.prepare("SELECT pr.id,r.owner_pid FROM provider_requests pr JOIN requests r ON r.id=pr.reservation_id WHERE json_extract(pr.request_json,'$.config.candidate_id') LIKE ? AND (r.state='reserved' OR pr.state='dispatching')").all(frozen.id+':%');
 if(active.length)throw Error('benchmark_requests_not_drained');
 for(const f of frozen.fixtures)bindBenchmarkFixtureFamily(f.candidate,plan.source_registry);
 if(results.topologies.dual_blind.some(r=>r.state!=='quarantined'||JSON.stringify(r.reasons)!=='["adaptation_family_mismatch"]'||Object.keys(r.checks||{}).length))throw Error('academic_outcomes_cannot_be_reset');
 const history=run+'/checkpoint-history';mkdirSync(history,{recursive:true});const previousSHA=sha(run+'/results.json');
 const backup=history+'/family-envelope-failure-'+previousSHA+'.json';copyFileSync(run+'/results.json',backup);
 const cleared=[];for(const[id,providers]of Object.entries(results.evaluations))for(const[provider,value]of Object.entries(providers)){if(value.status!=='error')continue;if(value.error!=='fresh_study_stopping')throw Error('academic_provider_error_cannot_be_reset');cleared.push({id,provider,reason:'Guard refused dispatch during cooperative drain; saved accepted responses replay at their original IDs.'});delete providers[provider];}
 const certificate={contract:FIXTURE_ENVELOPE_CONTRACT,at:new Date().toISOString(),payload_hash:frozen.payload_hash,helper_sha256:sha('scripts/pipeline/lib/benchmarkFixtureEnvelope.mjs'),candidate_count:96,question_and_blind_content_unchanged:true,prior_results_sha256:previousSHA,prior_results_path:backup,prior_metadata_outcomes:results.topologies.dual_blind.length,cleared_pre_dispatch_guard_errors:cleared,academic_labels_prompts_and_criteria_changed:false,paid_calls:0,limitation:'This repairs a fixture envelope after early local provenance rejection. Existing blind model judgments are retained; the unchanged body/key/source contract does not become independent source-family evidence.'};
 results.topologies.dual_blind=[];results.harness_contract=FIXTURE_ENVELOPE_CONTRACT;results.harness_resume=certificate;
 saveAtomicArtifact(run+'/results.json',results);saveAtomicArtifact(run+'/fixture-envelope-resume.json',certificate);
 if(existsSync(run+'/STOP_AFTER_REQUEST')){copyFileSync(run+'/STOP_AFTER_REQUEST',history+'/drain-before-family-envelope.txt');unlinkSync(run+'/STOP_AFTER_REQUEST');}
 console.log(JSON.stringify({registered:true,prior_metadata_outcomes:certificate.prior_metadata_outcomes,retained_blind_cases:Object.keys(results.evaluations).length,paid_calls:0}));
}finally{ledger.close();}
