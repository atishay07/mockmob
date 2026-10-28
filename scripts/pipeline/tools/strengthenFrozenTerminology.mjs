import {readFileSync,writeFileSync} from 'node:fs';import assert from 'node:assert/strict';
import {validationContract} from '../lib/compactBenchmark.mjs';import {presentationLint} from '../../../data/question_presentation.mjs';import {BudgetLedger} from '../lib/budgetLedger.mjs';
const dir='artifacts/question-factory/execution-2026-10-07',read=p=>JSON.parse(readFileSync(p)),save=(p,v)=>writeFileSync(p,JSON.stringify(v,null,2)+'\n');
const benchmark=read(dir+'/benchmark.json'),results=read(dir+'/benchmark-results.json');
assert.equal(results.complete,true);assert.equal(results.critical_false_accepts,0);assert.equal(results.valid_survival,1);
const old=benchmark.registration.contract_hash,next=validationContract();assert.notEqual(old,next);
// The only contract-file edit is a rejecting terminology rule. Check its exact
// source diff against the frozen snapshot, not a claim that it is harmless.
const now=readFileSync('data/question_presentation.mjs','utf8');
const addition="  // Undefined hybrids cannot serve as meaningful economic propositions, even\n  // when they were transcribed faithfully from an authenticated paper.\n  if (/\\bex[ -]+(?:ante[ -]+post|post[ -]+ante)\\b/i.test(body + ' ' + options.join(' '))) issues.push('undefined_economic_term');\n";
const snapshotPath='.cache/factory-v62/data/question_presentation.mjs';
writeFileSync(snapshotPath,now.replace(addition,'').replace("issues.push('unseen_reference');\n","issues.push('unseen_reference');\r\n"));
const frozenModule=await import('../../../.cache/factory-v62/scripts/pipeline/lib/compactBenchmark.mjs');
assert.equal(frozenModule.validationContract(),old,'Reconstructed snapshot must match the exact preregistered contract hash');
for(const path of ['factoryCore.mjs','factoryEvidence.mjs','evidencePipeline.mjs','focusedCoverage.mjs','focusedSources.mjs','compactBenchmark.mjs'])assert.equal(readFileSync('scripts/pipeline/lib/'+path,'utf8'),readFileSync('.cache/factory-v62/scripts/pipeline/lib/'+path,'utf8'));
for(const path of ['content_evidence.js','question_factory_policy.mjs','question_factory_criteria.mjs'])assert.equal(readFileSync('data/'+path,'utf8'),readFileSync('.cache/factory-v62/data/'+path,'utf8'));
assert.ok(benchmark.fixtures.every(f=>!presentationLint(f.candidate).includes('undefined_economic_term')));
save(dir+'/benchmark-before-terminology-guard.json',benchmark);save(dir+'/benchmark-results-before-terminology-guard.json',results);
benchmark.registration.contract_amendment={at:new Date().toISOString(),original_contract_hash:old,new_contract_hash:next,reason:'Reject undefined ex ante/post hybrid terms identified by historical regression; one extra free rejection rule only. Fresh item content, oracle, model prompts, schema, source excerpts and provider decisions remain unchanged.',unseen_evaluation_rerun:false,paid_requests:0,original_frozen_at:benchmark.registration.frozen_at};
benchmark.registration.contract_hash=next;save(dir+'/benchmark.json',benchmark);
const l=new BudgetLedger('data/pipeline-budget.sqlite');try{for(const f of [...benchmark.fixtures,...results.quality_regression.observations])l.db.prepare("UPDATE factory_candidates SET value=json_set(value,'$.state','queued') WHERE id=?").run(f.id);}finally{l.close();}
console.log(JSON.stringify({frozen_items_preserved:24,only_change:'additional rejecting terminology guard',paid_requests:0}));
