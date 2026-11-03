import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {runtimeBindingV74} from '../v74_runtime_contract.mjs';
import {factoryRuntimeEvidenceCurrent} from '../factory_runtime_evidence.mjs';
import {factoryCurrentValidation} from '../factory_current_validation.mjs';
import {expectedReleaseBindingV73} from '../../scripts/pipeline/lib/releaseEvidenceV73.mjs';
import {expectedReleaseBindingV74} from '../../scripts/pipeline/lib/releaseEvidenceV74.mjs';
import {RELEASE_POLICY_V7,REQUIRED_SUBJECTS} from '../../scripts/pipeline/lib/releaseEvidenceV7.mjs';

const root=process.cwd(),baseRead=path=>readFileSync(path,'utf8');
const metadataPath=resolve(root,'data/cuet_v74_runtime_binding.json');
const changedMetadata=change=>path=>{
 if(path!==metadataPath)return baseRead(path);
 const value=JSON.parse(baseRead(path));change(value);return JSON.stringify(value);
};
const released=binding=>({cuet_fit_releases:{dual_blind:{...binding,state:'released',problems:[],
 fresh_false_accepts:[],regression_false_accepts:[],valid_survival:.9,
 valid_by_subject:Object.fromEntries(REQUIRED_SUBJECTS.map(subject=>[subject,{n:10,ok:9}])),
 release_policy:RELEASE_POLICY_V7,source_registry_version:58,critical_false_accepts:0,
 benchmark:{state:'completed',payload_hash:'a'.repeat(64)}}}});
// Synthetic manifest rows exercise fail-closed wiring, never academic release.
test('v7.4 raw runtime binding exactly matches the frozen academic contract',()=>{
 assert.deepEqual(runtimeBindingV74({root}),expectedReleaseBindingV74());
});
test('v7.4 checks every parent level and each of its five additive academic files',()=>{
 const tamper=suffix=>path=>baseRead(path)+(path.endsWith(suffix)?'\n// local tamper':'');
 assert.throws(()=>runtimeBindingV74({root,readText:tamper('factoryEvidenceV7.mjs')}),/runtime_v73_parent_contract_changed/);
 assert.throws(()=>runtimeBindingV74({root,readText:tamper('verifyV73.mjs')}),/runtime_v73_additive_contract_changed/);
 for(const file of ['contractV74.mjs','factoryEvidenceV74.mjs','verifyV74.mjs','releaseEvidenceV74.mjs','originalAuthorPolicyV74.mjs']){
  assert.throws(()=>runtimeBindingV74({root,readText:tamper(file)}),/runtime_v74_additive_contract_changed/);
 }
});
test('v7.4 refuses metadata substitution, missing raw sources and duplicate/traversal bindings',()=>{
 for(const change of [m=>{m.schema='unknown';},m=>{m.additive_files.pop();},m=>{m.additive_files[1]=m.additive_files[0];},m=>{m.additive_files[0]='../../../package.json';}]){
  assert.throws(()=>runtimeBindingV74({root,readText:changedMetadata(change)}),/runtime_v74_contract_metadata_invalid/);
 }
 assert.throws(()=>runtimeBindingV74({root,readText:changedMetadata(m=>{m.parent_contract_hash='0'.repeat(64);})}),/runtime_v74_parent_contract_changed/);
 assert.throws(()=>runtimeBindingV74({root,readText:path=>{if(path.endsWith('originalAuthorPolicyV74.mjs'))throw Error('missing');return baseRead(path);}}),/missing/);
});
test('v7.4 cannot borrow a v7.3 release and a v7.3 record cannot borrow a v7.4 release',()=>{
 const registry={version:58},v73=expectedReleaseBindingV73(),v74=expectedReleaseBindingV74();
 const record=binding=>({verifier_version:binding.verifier_version,validation_contract_hash:binding.validation_contract_hash});
 assert.equal(factoryRuntimeEvidenceCurrent(record(v74),{manifest:released(v73),registry}),false);
 assert.equal(factoryRuntimeEvidenceCurrent(record(v73),{manifest:released(v74),registry}),false);
 assert.equal(factoryRuntimeEvidenceCurrent(record(v74),{manifest:released(v74),registry}),true);
 assert.equal(factoryRuntimeEvidenceCurrent(record(v74),{manifest:{},registry}),false);
 assert.equal(factoryRuntimeEvidenceCurrent(record(v74),{manifest:released(v74),registry:{version:59}}),false);
 assert.equal(factoryRuntimeEvidenceCurrent({verifier_version:'cuet-fit-validator-v7.5'},{manifest:released(v74),registry}),false);
});
test('v7.4 student and admin gates retain contract-drift and measured-failure rejection',()=>{
 const binding=expectedReleaseBindingV74(),registry={version:58};
 const record={verifier_version:binding.verifier_version,validation_contract_hash:'0'.repeat(64)};
 assert.equal(factoryRuntimeEvidenceCurrent(record,{manifest:released(binding),registry}),false);
 const failed= released(binding);failed.cuet_fit_releases.dual_blind.fresh_false_accepts=['controlled-defect'];
 assert.equal(factoryCurrentValidation(failed,registry).ready,false);
 const unavailable=factoryCurrentValidation({},registry,{readBinding:()=>{throw Error('runtime_v74_additive_contract_changed');}});
 assert.equal(unavailable.ready,false);assert.equal(unavailable.readiness_reason,'runtime_v74_additive_contract_changed');
});
