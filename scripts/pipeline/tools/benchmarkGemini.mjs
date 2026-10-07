import { loadEnvFile } from 'node:process';
import { readFileSync,writeFileSync,mkdirSync } from 'node:fs';
import { BudgetLedger } from '../lib/budgetLedger.mjs';
import { FactoryStore } from '../lib/factoryStore.mjs';
import { createFactoryTransport,BatchPending,FACTORY_MODELS,BENCHMARK_GEMINI_MODELS } from '../lib/factoryTransport.mjs';
import { createFactoryEvidence,FACTORY_VERIFIER_VERSION } from '../lib/factoryEvidence.mjs';
import { validateCalibrationManifest } from '../lib/factoryCalibration.mjs';
import { blindView } from '../lib/evidencePipeline.mjs';
import { currentRegistry } from '../../../data/evidence_registry.js';
import { factoryCostReport } from '../lib/factoryCosts.mjs';

try{loadEnvFile('.env.local');}catch{ /* inherited credentials */ }
const path=process.env.CUET_BUDGET_LEDGER || 'data/pipeline-budget.sqlite',ledger=new BudgetLedger(path),store=new FactoryStore(ledger,path);
const models=[FACTORY_MODELS.gemini,...BENCHMARK_GEMINI_MODELS],report={at:new Date().toISOString(),scope:'independent_evaluator_comparison_only',verifier_version:FACTORY_VERIFIER_VERSION,promotes_publication:false,models:{}};
let heartbeat;
try {
  store.claim();heartbeat=setInterval(()=>store.claim(),30000);
  const key=process.env.CUET_FACTORY_GEMINI_KEY || process.env.GEMINI_API_KEY;
  if(!key)throw new Error('gemini_factory_key_required');
  for(const model of models) {
    try {
      const response=await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}`,{headers:{'x-goog-api-key':key},redirect:'error',signal:AbortSignal.timeout(30000)});
      const body=await response.json();report.models[model]={http_status:response.status,accessible:response.ok,batch_supported:response.ok && body.supportedGenerationMethods?.includes('batchGenerateContent'),effort:model==='gemini-3.1-flash-lite'?'high':'medium',observations:[],pending:[]};
    }catch{report.models[model]={accessible:false,reason:'network_or_response_unavailable',observations:[],pending:[]};}
  }
  const fixturePath=process.argv[2];if(!fixturePath)throw new Error('officially_keyed_fixture_manifest_required');
  const registry=currentRegistry(),manifest=JSON.parse(readFileSync(fixturePath,'utf8'));
  validateCalibrationManifest(manifest,registry);ledger.assertHistoryReconciled();
  for(const model of models) {
    const entry=report.models[model];if(!entry.accessible || !entry.batch_supported)continue;
    const transport=createFactoryTransport({ledger,geminiModel:model});
    for(const batch of ledger.db.prepare("SELECT id,request_json FROM provider_batches WHERE state IN ('submitted','unresolved') AND provider_id IS NOT NULL").all())if(JSON.parse(batch.request_json).config.model===model)await transport.reconcile(batch.id);
    const calibrationTransport={generate:(provider,body,options)=>transport.generate(provider,body,{...options,purpose:'calibration'})};
    const adapters=createFactoryEvidence({registry,ledger,transport:calibrationTransport,geminiModel:model});
    for(const fixture of manifest.held_out) {
      try {
        const result=await adapters.independent_evaluation(blindView(fixture.question,fixture.question.source_refs || []));
        entry.observations.push({id:fixture.id,subject:fixture.question.subject,category:fixture.category,valid:fixture.valid,official_answer:fixture.provenance.final_answer,solved_key:result.solved_key,
          answer_correct:result.solved_key===fixture.provenance.final_answer,evaluator_accepts:result.passed && result.solved_key===fixture.question.correct_answer,
          explanation_audit_measured:false,reasons:result.reasons});
      }catch(error){if(error instanceof BatchPending)entry.pending.push({id:fixture.id,batch_id:error.batchId});else entry.observations.push({id:fixture.id,error:error.message,valid:fixture.valid});}
    }
    const valid=entry.observations.filter(o=>o.valid);entry.blind_answer_accuracy=valid.length?valid.filter(o=>o.answer_correct).length/valid.length:null;
    entry.by_subject=Object.fromEntries(['english','accountancy','business_studies','economics'].map(subject=>{
      const sample=valid.filter(o=>o.subject===subject);return [subject,{sample_size:sample.length,answer_accuracy:sample.length?sample.filter(o=>o.answer_correct).length/sample.length:null}];
    }));
    // A blind evaluator never receives an author's explanation, so it cannot
    // be credited with detecting that explanation's deliberately false claim.
    const defects=entry.observations.filter(o=>!o.valid&&o.category!=='unsupported_explanation');
    entry.defect_observations=defects.length;entry.defect_accepts=defects.filter(o=>o.evaluator_accepts).map(o=>o.id);
    entry.valid_sample_size=valid.length;entry.valid_acceptance=valid.filter(o=>o.evaluator_accepts).length;
    entry.complete=entry.pending.length===0 && valid.length===manifest.held_out.filter(f=>f.valid).length;
    entry.academic_defect_accepts=defects.filter(o=>!['option_collision','orphan_passage','false_citation'].includes(o.category)&&o.evaluator_accepts).map(o=>o.id);
    entry.benchmark_gate_passed=entry.complete && entry.blind_answer_accuracy>=.95 && entry.valid_acceptance/valid.length>=.95 && entry.defect_accepts.length===0;
  }
}catch(error){report.blocker=error.message;}
finally {
  clearInterval(heartbeat);report.budget=ledger.snapshot();report.costs=factoryCostReport(ledger);store.release();ledger.close();
  report.limitations=['No model switch or publication release follows this comparison.','An independent blind evaluator cannot audit a withheld author explanation; the Luna explanation stage still applies.','API token cost is gross; promotional credit application requires billing evidence.'];
  mkdirSync('artifacts/question-factory/gemini-benchmark-history',{recursive:true});
  writeFileSync(`artifacts/question-factory/gemini-benchmark-history/${report.at.replaceAll(':','-')}.json`,JSON.stringify(report,null,2));
  writeFileSync('artifacts/question-factory/gemini-benchmark.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));
}
