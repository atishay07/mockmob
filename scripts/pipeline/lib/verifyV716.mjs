import { timingSafeEqual } from 'node:crypto';
import { canonicalJSON } from '../../../data/canonical_json.mjs';
import { canonicalQuestion,contentHash,evidenceSignature } from '../../../data/content_evidence.js';
import { structureVerdict } from './evidencePipeline.mjs';
import { presentationLint } from '../../../data/question_presentation.mjs';
import { provenanceReasons,needsNumericChecks,inventoryFingerprint,FACTORY_POLICY } from '../../../data/question_factory_policy.mjs';
import { createScorecardReviewV716,scorecardPromptHashV716 } from './scorecardReviewV716.mjs';
import { deriveScorecardV716,SCORECARD_POLICY_V716 } from './scorecardPolicyV716.mjs';
import { FACTORY_VERIFIER_VERSION_V716,validationContractV716 } from './contractV716.mjs';
export function localScorecardChecksV716(candidate,registry,seen) {
 const refs = candidate.source_refs || [], family = registry.families?.[candidate.family_id], key = inventoryFingerprint(candidate);
 const novelty = seen instanceof Set && !seen.has(key);
 return { structure:structureVerdict(candidate).passed === true,presentation:presentationLint(candidate).length === 0,
  provenance:provenanceReasons(candidate,registry).length === 0,syllabus_registry:registry.exam_specs?.[candidate.subject]?.state === 'verified' && family?.state === 'active',
  source_integrity:refs.length > 0 && refs.every(ref => {const source=registry.sources?.[ref.id]; return source?.state === 'active' && source.reuse_permitted && source.version === ref.version && ref.support_hash && source.supports?.[ref.locator] === ref.support_hash;}),
  novelty,numeric_required:needsNumericChecks(candidate,registry) };
}
export async function validateFactoryCandidateV716(candidate,{registry,ledger,transport,secret=process.env.CUET_EVIDENCE_SIGNING_KEY,seen,onBlindFrozen,efforts,exemplarExclude,passageGroup}={}) {
 if (!secret || process.env.MOCK_AI === 'true') return {state:'quarantined',reasons:['verification_configuration_missing']};
 const localChecks=localScorecardChecksV716(candidate,registry,seen);
 const failed=Object.entries(localChecks).filter(([key,value]) => key !== 'numeric_required' && value !== true).map(([key]) => 'local_check_failed:'+key);
 if (failed.length) return {state:'quarantined',reasons:failed,local_checks:localChecks};
 const reviewers=createScorecardReviewV716({registry,ledger,transport,efforts,exemplarExclude}), {reports,audit,context}=await reviewers.review(candidate,{onBlindFrozen});
 const contract=validationContractV716(),prompt=scorecardPromptHashV716();
 for (const report of [...reports,...(audit?[audit]:[])]) if (report.validation_contract_hash !== contract || report.evaluation_prompt !== prompt || report.prompt_version !== FACTORY_VERIFIER_VERSION_V716) return {state:'error',academic_sound:null,reasons:['v716_unbound_current_report'],checks:{reports,audit}};
 const decision=deriveScorecardV716(candidate,reports,audit,{evidenceCatalog:context.evidence_catalog,localChecks});
 if (decision.state !== 'eligible') return {...decision,checks:{reports,audit},local_checks:localChecks};
 const record={candidate_id:candidate.id || candidate.candidate_id || candidate.local_id,content_hash:contentHash(candidate),state:'eligible',policy_version:FACTORY_POLICY,
  verifier_version:FACTORY_VERIFIER_VERSION_V716,validation_contract_hash:contract,evaluation_prompt:prompt,scorecard_policy:SCORECARD_POLICY_V716,
  topology:'dual_blind',source_registry_version:registry.version,sources:candidate.source_refs,family_id:candidate.family_id,family_version:registry.families[candidate.family_id].version,
  route:candidate.route,question_type:candidate.question_type || null,passage_group:passageGroup || null,provenance:candidate.provenance,
  author_target_difficulty:candidate.difficulty || null,difficulty_target_match:candidate.difficulty === decision.difficulty.level,verified_at:new Date().toISOString(),expires_at:new Date(Date.now()+30*86400000).toISOString(),reports,audit,local_checks:localChecks,decision};
 seen.add(inventoryFingerprint(candidate));
 return {...decision,question:{...candidate,evidence:{record,signature:evidenceSignature(record,secret)}}};
}
// Persisted rows carry only real table columns; route/sources/question type come from the signed record.
export function hydratePersistedRowV716(row) {
 const record=row?.evidence?.record;
 if (!record) return row;
 // Signed values win; an unsigned column that disagrees is caught by the mismatch check in publicationEligibilityV716.
 return {...row,route:record.route ?? row.route,source_refs:row.source_refs ?? record.sources,question_type:record.question_type ?? row.question_type ?? undefined,
  unsigned_route:row.route,unsigned_question_type:row.question_type};
}
const flagged = value => value === true || value === 1 || value === 'true' || value === 't';
// Mirrors record_question_dispute and the legacy read gate: any withdrawal, dispute or deletion invalidates the row.
export function withheldReasonsV716(question) {
 const reasons=[];
 if (question.deleted_at || flagged(question.is_deleted)) reasons.push('question_deleted');
 if (['quarantined','withdrawn','disputed','disabled','pending','invalid','rejected'].includes(question.status)) reasons.push('question_withheld');
 if (['disputed','rejected','pending_review','unverified'].includes(question.verification_state) || flagged(question.open_dispute)) reasons.push('question_disputed');
 if (['pending_review','frozen','retired'].includes(question.exploration_state)) reasons.push('question_not_active');
 return reasons;
}
export function publicationEligibilityV716(input,{registry,manifest,secret=process.env.CUET_EVIDENCE_SIGNING_KEY,mode='practice'}={}) {
 const question=hydratePersistedRowV716(input);
 const record=question.evidence?.record,signature=question.evidence?.signature,reasons=[];
 if (!['practice','nta','full_mock','hard','easy','medium'].includes(mode)) return {eligible:false,reasons:['unknown_practice_mode']};
 reasons.push(...withheldReasonsV716(question));
 if (question.unsigned_route != null && question.unsigned_route !== question.evidence?.record?.route || question.unsigned_question_type != null && question.evidence?.record?.question_type != null && question.unsigned_question_type !== question.evidence.record.question_type) reasons.push('source_or_provenance_changed');
 if (record?.reports?.some(report => report.validation_contract_hash !== validationContractV716() || report.evaluation_prompt !== scorecardPromptHashV716() || report.prompt_version !== FACTORY_VERIFIER_VERSION_V716) || record?.audit?.validation_contract_hash !== validationContractV716() || record?.audit?.evaluation_prompt !== scorecardPromptHashV716() || record?.audit?.prompt_version !== FACTORY_VERIFIER_VERSION_V716) reasons.push('unbound_review_reports');
 if (!record || !signature || !secret) return {eligible:false,reasons:['missing_trusted_scorecard']};
 const actual=Buffer.from(String(signature)),expected=Buffer.from(evidenceSignature(record,secret));
 if (actual.length !== expected.length || !timingSafeEqual(actual,expected)) reasons.push('untrusted_scorecard');
 if (record.candidate_id !== (question.id || question.candidate_id || question.local_id) || record.content_hash !== contentHash(question)) reasons.push('content_changed');
 if (record.verifier_version !== FACTORY_VERIFIER_VERSION_V716 || record.validation_contract_hash !== validationContractV716() || record.evaluation_prompt !== scorecardPromptHashV716() || record.scorecard_policy !== SCORECARD_POLICY_V716) reasons.push('stale_scorecard_contract');
 if (!(Date.parse(record.expires_at)>Date.now()) || !['eligible','published'].includes(record.state) || record.source_registry_version !== registry?.version) reasons.push('stale_scorecard');
 if (canonicalJSON(record.provenance) !== canonicalJSON(question.provenance) || record.family_id !== question.family_id || record.family_version !== registry?.families?.[question.family_id]?.version || canonicalJSON(record.sources) !== canonicalJSON(question.source_refs)) reasons.push('source_or_provenance_changed');
 const localChecks=localScorecardChecksV716(question,registry,new Set());
 const context=createScorecardReviewV716({registry,ledger:{getCache:()=>null,setCache:()=>{}},transport:{generate:()=>{throw Error('publication_cannot_dispatch');}}}).context(question);
 const decision=deriveScorecardV716(question,record.reports,record.audit,{evidenceCatalog:context.evidence_catalog,localChecks});
 if (canonicalJSON(decision)!==canonicalJSON(record.decision) || decision.state!=='eligible') reasons.push('scorecard_decision_not_reproducible');
 if (['nta','full_mock'].includes(mode) && decision.modes?.nta !== true) reasons.push('practice_only_below_7');
 if (['easy','medium','hard'].includes(mode) && decision.difficulty?.level!==mode) reasons.push('selected_difficulty_mismatch');
 const release=manifest?.scorecard_releases?.[FACTORY_VERIFIER_VERSION_V716];
 if (!release || release.state!=='released' || release.validation_contract_hash!==record.validation_contract_hash || release.prompt_hash!==record.evaluation_prompt || release.source_registry_version!==registry.version ||
     release.policy!==SCORECARD_POLICY_V716 || release.topology!=='dual_blind' || release.critical_false_accepts!==0 || !Number.isFinite(release.valid_survival) || release.valid_survival<0.85 ||
     !['english','accountancy','business_studies','economics'].every(subject => release.by_subject?.[subject]?.valid_survival>=0.7) || release.benchmark?.state!=='completed' ||
     release.benchmark?.unseen_at_freeze!==true || !/^[a-f0-9]{64}$/.test(release.benchmark?.payload_hash || '')) reasons.push('qualified_scorecard_release_required');
 return {eligible:reasons.length===0,reasons:[...new Set(reasons)],decision};
}
