import { readFileSync } from 'node:fs';
import { hashJSON } from '../../../data/question_factory_policy.mjs';
import { validationContractV715 } from './contractV715.mjs';
export const FACTORY_VERIFIER_VERSION_V716 = 'cuet-fit-validator-v7.16-report-policy';
export const V716_FILES = Object.freeze(['contractV716.mjs','scorecardPolicyV716.mjs','scorecardPromptV716.mjs','scorecardReviewV716.mjs','verifyV716.mjs','generationPromptV716.mjs','practiceSelectionV716.mjs','campaignSessionV716.mjs','publicationBridgeV716.mjs']);
export const V716_INTEGRATION_FILES = Object.freeze(['atomicArtifact.mjs','ideaAllocation.mjs','publishTimeInspection.mjs','batchInspection.mjs','trustedNetworkV713R3.mjs','providerAvailabilityV713R2.mjs','factoryStore.mjs','budgetLedger.mjs','scopedAccounting.mjs','campaignExecutionV7.mjs','factoryCore.mjs','../../../data/mock_question_selector.js','../../../data/nta_question_selector.js']);
export function validationContractV716() {
 const parent = validationContractV715();
 if (parent !== 'e44f34f94187283d851db1d6b46d95615e02de089bcbc783d7a312344f77de9d') throw Error('v716_parent_changed');
 return hashJSON({ version:FACTORY_VERIFIER_VERSION_V716,parent,files:[...V716_FILES,...V716_INTEGRATION_FILES].map(path => ({path,sha256:hashJSON(readFileSync(new URL(path,import.meta.url),'utf8'))})),
  topology:'dual_blind',score_policy:'academic_sound_then_craft_mean_6_practice_7_nta',fresh_qualification_required:true });
}
