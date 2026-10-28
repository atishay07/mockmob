// Read-only A/B academic inspection proposal. It does not import the factory ledger,
// update candidate state, quarantine, publish, or call a provider.
import {loadEnvFile} from 'node:process';
import {createHash} from 'node:crypto';
import {existsSync,mkdirSync,readFileSync,writeFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {createClient} from '@supabase/supabase-js';
import {hashJSON} from '../../../data/question_factory_policy.mjs';
import {evaluateEvidenceV7 as evaluateBaselineEvidenceV7} from '../../../artifacts/question-factory/cuet-readiness-2026-10-08/baseline-code/data/cuet_fit_evidence.mjs';
import {CONTRACT_FILES_V7 as BASELINE_CONTRACT_FILES,validationContractV7 as baselineValidationContract} from '../../../artifacts/question-factory/cuet-readiness-2026-10-08/baseline-code/scripts/pipeline/lib/contractV7.mjs';
import {evaluateEvidenceV7 as evaluateCurrentEvidenceV7} from '../../../data/cuet_fit_evidence.mjs';
import {CONTRACT_FILES_V7 as CURRENT_CONTRACT_FILES,validationContractV7 as currentValidationContract} from '../lib/contractV7.mjs';
import {readBankSnapshot} from '../lib/bankSnapshot.mjs';
import {inspectAgainstInventory} from '../lib/batchInspection.mjs';
import {assertCandidateCBankDisposed,reassessedStagingInventory} from '../lib/candidateCRegistration.mjs';
import {inspectCompletedComparisonArm,inventoryIdentity,readArmArtifacts,validateCompletedComparisonArm} from '../lib/completedComparisonInspection.mjs';
import {measurementInspectionEligibility} from '../lib/measurementInspectionVNext.mjs';

const PROJECT='https://onwkqxmjqjrhfbjjdydu.supabase.co';
const root='artifacts/question-factory',stamp='2026-10-08',reassessmentDir=`${root}/cuet-readiness-${stamp}/reassessment`;
const outDir=`${root}/completed-ab-inspection-${stamp}`;
if(existsSync(outDir))throw Error('inspection_export_output_exists');
const readJson=path=>JSON.parse(readFileSync(path,'utf8'));
const sha256=bytes=>createHash('sha256').update(bytes).digest('hex');
const reassessment=readJson(`${reassessmentDir}/profile.json`),history=readFileSync(`${reassessmentDir}/results.jsonl`,'utf8').trim().split(/\r?\n/).filter(Boolean).map(JSON.parse);
const bankDisposition=assertCandidateCBankDisposed(reassessment,history);
if(reassessment.denominator!==662||reassessment.verifier!=='cuet-fit-validator-v7.2'||reassessment.publication!=='never')throw Error('current_reassessment_profile_mismatch');
const arms=[];
for(const name of ['baseline','improved']){
  const id=`cuet-readiness-${name}-100-${stamp}`,directory=`${root}/${id}`;
  const data=readArmArtifacts(directory);
  if(data.campaign.id!==id||data.profile.arm!==name)throw Error(`comparison_campaign_identity_mismatch:${name}`);
  validateCompletedComparisonArm({name,...data});
  arms.push({name,directory,...data});
}
const baselineContract=baselineValidationContract();
if(arms[0].profile.contract_hash!==baselineContract)throw Error('baseline_frozen_contract_hash_mismatch');
const currentContract=currentValidationContract();
if(arms[1].profile.contract_hash!==currentContract)throw Error('improved_current_contract_hash_mismatch');
try{loadEnvFile('.env.local');}catch{}
if(typeof process.env.CUET_EVIDENCE_SIGNING_KEY!=='string'||!process.env.CUET_EVIDENCE_SIGNING_KEY)throw Error('cuet_evidence_signing_key_unavailable');
const baselineEligibility=measurementInspectionEligibility(arms[0].profile,arms[0].registry,arms[0].campaign.jobs.map(job=>job.id),{evaluate:evaluateBaselineEvidenceV7});
const baselineSignatureAudit=arms[0].items.filter(row=>['eligible','published'].includes(row.state))
  .filter(row=>baselineEligibility(row.candidate).eligible).length;
if(arms[0].report.approved_unique>0&&baselineSignatureAudit===0)throw Error('baseline_registered_signature_validation_zero_of_reported_approvals');
loadEnvFile('.env.staging');
if(process.env.STAGING_SUPABASE_URL!==PROJECT||!process.env.STAGING_SUPABASE_SERVICE_ROLE_KEY)throw Error('staging_identity_unavailable');
const db=createClient(PROJECT,process.env.STAGING_SUPABASE_SERVICE_ROLE_KEY,{auth:{persistSession:false}});
const staged=await readBankSnapshot(db),qualified=reassessedStagingInventory(staged,history,reassessment);
if(qualified.inventory.length!==535)throw Error(`current_reassessed_inventory_expected_535:${qualified.inventory.length}`);
const identity=inventoryIdentity(qualified.inventory);
const sourceHashes={reassessment_profile:hashJSON(reassessment),reassessment_history:hashJSON(history),staging_snapshot:identity.content_hash,staging_inventory_ids:identity.ids_hash};
const comparisons=arms.map(arm=>({
  campaign_hashes:arm.file_hashes,
  validator_source:arm.name==='baseline'?`${root}/cuet-readiness-${stamp}/baseline-code/data/cuet_fit_evidence.mjs`:'data/cuet_fit_evidence.mjs',
  validator_sha256:sha256(readFileSync(arm.name==='baseline'?`${root}/cuet-readiness-${stamp}/baseline-code/data/cuet_fit_evidence.mjs`:'data/cuet_fit_evidence.mjs')),
  registered_contract:{profile_hash:arm.profile.contract_hash,recomputed_hash:arm.name==='baseline'?baselineContract:currentContract,
    validator_inputs:(arm.name==='baseline'?BASELINE_CONTRACT_FILES:CURRENT_CONTRACT_FILES).map(path=>({path,sha256:sha256(readFileSync(resolve(
      arm.name==='baseline'?'artifacts/question-factory/cuet-readiness-2026-10-08/baseline-code/scripts/pipeline/lib':'scripts/pipeline/lib',path)))}))},
  ...inspectCompletedComparisonArm({...arm,inventory:qualified.inventory,inspectAgainstInventory,
    evaluateEvidence:arm.name==='baseline'?evaluateBaselineEvidenceV7:evaluateCurrentEvidenceV7})
}));
const output={
  schema:'completed-ab-measurement-inspection-v1',at:new Date().toISOString(),read_only:true,
  project_ref:'onwkqxmjqjrhfbjjdydu',campaign_files:{
    baseline:arms[0].file_hashes,improved:arms[1].file_hashes
  },current_inventory:{count:identity.count,ids_hash:identity.ids_hash,content_hash:identity.content_hash,
    reassessment_profile_hash:sourceHashes.reassessment_profile,history_hash:sourceHashes.reassessment_history,
    qualified_count:qualified.inventory.length,excluded_count:qualified.excluded,passage_closure:true,
    basis:qualified.basis,bank_disposition:bankDisposition},
  comparisons,
  baseline_signature_audit:{registered_eligible_revalidated:baselineSignatureAudit,reported_approved_unique:arms[0].report.approved_unique,
    evaluator_source:`${root}/cuet-readiness-${stamp}/baseline-code/data/cuet_fit_evidence.mjs`,contract_hash:baselineContract},
  conclusions:{
    denominator:'Both preregistered arms retain their complete 100-item denominator, including pre-inspection quarantines.',
    decisions:'All proposed duplicate, evidence, and passage-group decisions are proposals only and do not change saved campaign history or state.',
    publication:'This export grants no release or publication eligibility. Model agreement and signed measurement eligibility are not proof of truth.',
    accounting:'Each campaign accounting snapshot is reported with its provider-processing completion flag, held cost, and publication-accounting object. A validated hold may leave accepted-request reconciliation incomplete after all academic dispositions are terminal.'
  },
  paid_provider_calls:0,staging_writes:0,candidate_writes:0,publication_writes:0
};
mkdirSync(outDir,{recursive:false});
writeFileSync(`${outDir}/measurement-inspection.json`,JSON.stringify(output,null,2)+'\n',{flag:'wx'});
console.log(JSON.stringify({path:`${outDir}/measurement-inspection.json`,inventory:output.current_inventory,arms:comparisons.map(({arm,denominator,preinspection,proposed,accounting})=>({arm,denominator,preinspection,proposed:{retained:proposed.retained,withheld:proposed.withheld,by_reason:proposed.by_reason},accounting}))},null,2));
