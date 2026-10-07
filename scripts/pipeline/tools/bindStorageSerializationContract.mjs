import assert from 'node:assert/strict';import {readFileSync,writeFileSync} from 'node:fs';import {hashJSON} from '../../../data/question_factory_policy.mjs';import {validationContract} from '../lib/compactBenchmark.mjs';
const dir='artifacts/question-factory/execution-2026-10-07',read=p=>JSON.parse(readFileSync(p)),save=(p,v)=>writeFileSync(p,JSON.stringify(v,null,2)+'\n');
const before=readFileSync(dir+'/compact-benchmark-before-storage-binding.mjs','utf8'),current=readFileSync('scripts/pipeline/lib/compactBenchmark.mjs','utf8');
assert.equal(current.replaceAll('\r\n','\n'),before.replace("'../../../data/question_presentation.mjs']","'../../../data/question_presentation.mjs','../../../data/canonical_json.mjs']").replaceAll('\r\n','\n'));
const paths=['factoryCore.mjs','factoryEvidence.mjs','evidencePipeline.mjs','focusedCoverage.mjs','focusedSources.mjs','compactBenchmark.mjs','../../../data/content_evidence.js','../../../data/question_factory_policy.mjs','../../../data/question_factory_criteria.mjs','../../../data/question_presentation.mjs'];
const old=hashJSON(paths.map(p=>p==='compactBenchmark.mjs'?before:readFileSync(new URL('../lib/'+p,import.meta.url),'utf8'))),benchmark=read(dir+'/benchmark.json');assert.equal(old,benchmark.registration.contract_hash);
const next=validationContract(),amendment={...benchmark.registration.storage_amendment,new_contract_hash:next,canonical_serializer_bound:true};
benchmark.registration.contract_hash=next;benchmark.registration.storage_amendment=amendment;save(dir+'/benchmark.json',benchmark);
for(const p of [dir+'/benchmark-results.json','data/calibration_manifest.json']){const m=read(p);m.validation_contract=next;m.storage_amendment=amendment;m.benchmark={...m.benchmark,contract_hash:next,storage_amendment:amendment};save(p,m);}
save(dir+'/storage-contract-amendment.json',amendment);console.log(JSON.stringify(amendment));
