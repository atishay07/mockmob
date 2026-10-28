import assert from 'node:assert/strict';import {readFileSync,writeFileSync} from 'node:fs';
import {validationContract} from '../lib/compactBenchmark.mjs';
const dir='artifacts/question-factory/execution-2026-10-07',read=p=>JSON.parse(readFileSync(p)),save=(p,v)=>writeFileSync(p,JSON.stringify(v,null,2)+'\n');
const benchmark=read(dir+'/benchmark.json'),old=benchmark.registration.contract_hash,next=validationContract();
assert.equal(old,'2822eec914883a624a2c2e1327e3b0ce30f24a7c0984701746ce268cabb54d48');
let expected=readFileSync(dir+'/content-evidence-before-storage-fix.js','utf8');
expected=expected.replace("import { createHash, createHmac, timingSafeEqual } from 'node:crypto';","import { createHash, createHmac, timingSafeEqual } from 'node:crypto';\nimport { canonicalJSON } from './canonical_json.mjs';")
 .replace("update(JSON.stringify(record)).digest('hex'); }","update(canonicalJSON(record)).digest('hex'); }")
 .replace("  if (actual.length !== expected.length || !timingSafeEqual(actual, expected)) reasons.push('untrusted_evidence');","  const legacy = Buffer.from(createHmac('sha256', secret).update(JSON.stringify(record)).digest('hex'));\n  if (actual.length !== expected.length || !timingSafeEqual(actual, expected) && !timingSafeEqual(actual, legacy)) reasons.push('untrusted_evidence');")
 .replace('JSON.stringify(record.provenance) !== JSON.stringify(q.provenance)','canonicalJSON(record.provenance) !== canonicalJSON(q.provenance)');
assert.equal(readFileSync('data/content_evidence.js','utf8').replaceAll('\r\n','\n'),expected.replaceAll('\r\n','\n'),'Only storage serialization compatibility may change');
assert.notEqual(old,next);save(dir+'/benchmark-before-storage-fix.json',benchmark);
const amendment={at:new Date().toISOString(),old_contract_hash:old,new_contract_hash:next,reason:'JSONB reorders object keys. Canonical signing and structural provenance comparison preserve array order and every evidence gate. Legacy in-memory signatures remain verifiable; no academic prompt, candidate, oracle or provider decision changes.',paid_requests:0,unseen_evaluation_rerun:false};
benchmark.registration.storage_amendment=amendment;benchmark.registration.contract_hash=next;save(dir+'/benchmark.json',benchmark);
for(const path of [dir+'/benchmark-results.json','data/calibration_manifest.json']){const m=read(path);save(path+'.before-storage-fix.json',m);m.validation_contract=next;if(m.benchmark)m.benchmark={...m.benchmark,contract_hash:next,storage_amendment:amendment};m.storage_amendment=amendment;save(path,m);}
save(dir+'/storage-contract-amendment.json',amendment);console.log(JSON.stringify(amendment));
