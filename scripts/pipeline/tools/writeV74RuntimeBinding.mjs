// Deployment metadata only; cannot create a release or change academic sources.
import {writeFileSync} from 'node:fs';
import {V74_ADDITIVE_FILES,PARENT_CONTRACT_V73_HASH} from '../lib/contractV74.mjs';
import {expectedReleaseBindingV74} from '../lib/releaseEvidenceV74.mjs';
const metadata={schema:'cuet-v74-runtime-contract-v1',parent_contract_hash:PARENT_CONTRACT_V73_HASH,
 additive_files:[...V74_ADDITIVE_FILES],binding:expectedReleaseBindingV74()};
writeFileSync('data/cuet_v74_runtime_binding.json',JSON.stringify(metadata,null,2)+'\n');
console.log(JSON.stringify({verifier_version:metadata.binding.verifier_version,validation_contract_hash:metadata.binding.validation_contract_hash,release_written:false}));
