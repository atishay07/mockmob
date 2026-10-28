import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { FACTORY_VERIFIER_VERSION_V717, validationContractV717 } from './contractV717.mjs';
import { scorecardPromptHashV717 } from './scorecardReviewV717.mjs';
// Pilot dispatch is conditional on the actual finished, frozen qualification, not a caller boolean.
export function assertQualifiedPilotV717(binding, {readFile=p=>readFileSync(p)}={}) {
 const readBound=ref=>{
  if (!ref?.path || !/^[a-f0-9]{64}$/.test(ref.sha256 || '')) throw Error('v717_pilot_qualification_binding_required');
  const bytes=readFile(ref.path);
  if (createHash('sha256').update(bytes).digest('hex')!==ref.sha256) throw Error('v717_pilot_qualification_artifact_changed');
  return JSON.parse(Buffer.from(bytes).toString('utf8'));
 };
 const summary=readBound(binding?.summary),reg=readBound(binding?.registration);
 if (summary.id!==reg.id || summary.profile!==FACTORY_VERIFIER_VERSION_V717 || reg.profile!==FACTORY_VERIFIER_VERSION_V717 ||
  summary.kind!=='qualification' || !reg.qualification || reg.contract_hash!==validationContractV717() || reg.prompt_hash!==scorecardPromptHashV717() ||
  summary.decision!=='passed' || summary.denominator!==reg.jobs?.length || summary.terminal!==summary.denominator || !summary.receipt_complete || summary.held_usd!==0 ||
  !Array.isArray(summary.review_incomplete) || summary.review_incomplete.length || summary.controlled_defects<1 || summary.controlled_false_accepts?.length!==0 || summary.valid_total<1 || summary.valid_eligible/summary.valid_total<.85 ||
  !['accountancy','business_studies','economics','english'].every(s=>summary.valid_by_subject?.[s]?.n>0 && summary.valid_by_subject[s].ok/summary.valid_by_subject[s].n>=.70)) throw Error('v717_pilot_requires_passed_current_qualification');
 return {summary,registration:reg};
}
