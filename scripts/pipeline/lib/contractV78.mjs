import {readFileSync} from 'node:fs';
import {hashJSON} from '../../../data/question_factory_policy.mjs';
import {validationContractV77} from './contractV77.mjs';

export const FACTORY_VERIFIER_VERSION_V78='cuet-fit-validator-v7.8-local-draft';
export const PARENT_CONTRACT_V77_HASH='614d423f795314c7661e952ca1f1bf41258b005586744172dd8ec3b32021ecd1';
export const V78_ADDITIVE_FILES=Object.freeze(['contractV78.mjs','premiseBindingV78.mjs','optionResolutionV78.mjs','optionResolutionAuditV78.mjs','factoryEvidenceV78.mjs','verifyV78.mjs']);

export function validationContractV78(){
 const parent=validationContractV77();
 if(parent!==PARENT_CONTRACT_V77_HASH)throw Error('v78_parent_contract_changed_requires_new_binding');
 const files=V78_ADDITIVE_FILES.map(path=>({path,sha256:hashJSON(readFileSync(new URL(path,import.meta.url),'utf8'))}));
 return hashJSON({verifier_version:FACTORY_VERIFIER_VERSION_V78,parent_contract_hash:parent,files,option_resolution:'full-option-clause-explicit-origin-v2',inherited_gates:'unchanged-v77',topology:'dual_blind',qualification:'required_fresh_evidence_no_local_test_release'});
}
