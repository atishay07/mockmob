import assert from 'node:assert/strict';import {execFileSync} from 'node:child_process';
import {readFileSync} from 'node:fs';import {validationContract} from '../lib/compactBenchmark.mjs';import {hashJSON} from '../../../data/question_factory_policy.mjs';
const files=['factoryCore.mjs','factoryEvidence.mjs','evidencePipeline.mjs','focusedCoverage.mjs','focusedSources.mjs','compactBenchmark.mjs'].map(p=>'scripts/pipeline/lib/'+p)
 .concat(['content_evidence.js','question_factory_policy.mjs','question_factory_criteria.mjs','question_presentation.mjs','canonical_json.mjs'].map(p=>'data/'+p));
const revision=process.argv.includes('--index')?'': 'HEAD';
const stored=hashJSON(files.map(path=>execFileSync('git',['show',revision+':'+path],{encoding:'utf8',maxBuffer:2*1024*1024})));
assert.equal(stored,validationContract(),'Git bytes must match the frozen local verification contract; newline conversion cannot invalidate saved decisions');
const i=process.argv.indexOf('--benchmark');if(i>=0)assert.equal(stored,JSON.parse(readFileSync(process.argv[i+1])).registration.contract_hash);
console.log(JSON.stringify({contract_hash:stored,git_revision:revision||'index',byte_identical:true,paid_requests:0}));
