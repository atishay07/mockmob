import {readFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {createHash} from 'node:crypto';
import {runtimeBindingV73} from './v73_runtime_contract.mjs';

const hash=value=>createHash('sha256').update(JSON.stringify(value)).digest('hex');
const expectedFiles=['contractV74.mjs','factoryEvidenceV74.mjs','verifyV74.mjs','releaseEvidenceV74.mjs','originalAuthorPolicyV74.mjs'];
// Check traced, untransformed academic sources. The bundled module is never
// substituted for the raw-source contract or an earlier version's release.
export function runtimeBindingV74({root=process.cwd(),readText=path=>readFileSync(path,'utf8')}={}) {
 const metadata=JSON.parse(readText(resolve(root,'data/cuet_v74_runtime_binding.json')));
 if(metadata.schema!=='cuet-v74-runtime-contract-v1'||metadata.binding?.verifier_version!=='cuet-fit-validator-v7.4'||
    JSON.stringify(metadata.additive_files)!==JSON.stringify(expectedFiles))throw Error('runtime_v74_contract_metadata_invalid');
 const parent=runtimeBindingV73({root,readText});
 if(parent.validation_contract_hash!==metadata.parent_contract_hash)throw Error('runtime_v74_parent_contract_changed');
 const files=metadata.additive_files.map(path=>({path,sha256:hash(readText(resolve(root,'scripts/pipeline/lib',path)))}));
 const contract=hash({verifier_version:metadata.binding.verifier_version,parent_contract_hash:parent.validation_contract_hash,files,
  assumption_policy:'prerequisites-not-deductions-v1',authoring_policy:'original-practice-source-explanations-v74',
  deterministic_gates:'unchanged-v73',original_practice_pyq:'optional-style-only',topology:'dual_blind'});
 if(contract!==metadata.binding.validation_contract_hash)throw Error('runtime_v74_additive_contract_changed');
 return metadata.binding;
}
