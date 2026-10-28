import { readFileSync } from 'node:fs';
import { hashJSON } from '../../../data/question_factory_policy.mjs';
import { validationContractV716 } from './contractV716.mjs';
export const FACTORY_VERIFIER_VERSION_V717 = 'cuet-fit-validator-v7.17-report-policy';
export const V717_FILES = Object.freeze(['contractV717.mjs','difficultyPolicyV717.mjs','qualifiedPilotV717.mjs','scorecardPolicyV717.mjs','scorecardPromptV717.mjs','scorecardReviewV717.mjs','verifyV717.mjs','generationPromptV717.mjs','practiceSelectionV717.mjs','campaignSessionV717.mjs','publicationBridgeV717.mjs']);
export const V717_INTEGRATION_FILES = Object.freeze(['atomicArtifact.mjs','ideaAllocation.mjs','publishTimeInspection.mjs','batchInspection.mjs','trustedNetworkV713R3.mjs','providerAvailabilityV713R2.mjs','factoryStore.mjs','budgetLedger.mjs','scopedAccounting.mjs','campaignExecutionV7.mjs','factoryCore.mjs','../../../data/mock_question_selector.js','../../../data/nta_question_selector.js']);
export function validationContractV717() {
 const parent = validationContractV716();
 if (parent !== '9957890e5f5d3426f11e927153b6ea10115c853301a88da7fa690d82e7e182da') throw Error('v717_parent_changed');
 return hashJSON({ version:FACTORY_VERIFIER_VERSION_V717,parent,files:[...V717_FILES,...V717_INTEGRATION_FILES].map(path => ({path,sha256:hashJSON(readFileSync(new URL(path,import.meta.url),'utf8'))})),
  topology:'dual_blind',score_policy:'academic_sound_then_craft_mean_6_practice_7_nta',fresh_qualification_required:true });
}
