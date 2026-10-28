import {createHash} from 'node:crypto';
import {readFileSync} from 'node:fs';
import {contentHash} from '../../../data/content_evidence.js';
import {hashJSON} from '../../../data/question_factory_policy.mjs';
import {measurementInspectionEligibility} from './measurementInspectionVNext.mjs';
import {sourceMaterial} from './factoryEvidence.mjs';

const TERMINAL=new Set(['eligible','quarantined','published']);
const REQUIRED_FILES=['campaign.json','verification-profile.json','registry.json','all-candidates.json','batch-report.json'];
const bytesHash=bytes=>createHash('sha256').update(bytes).digest('hex');
const uniqueIds=(rows,label)=>{
  if(!Array.isArray(rows)||new Set(rows.map(row=>row?.id)).size!==rows.length||rows.some(row=>typeof row?.id!=='string'||!row.id))throw Error(`${label}_ids_invalid`);
  return new Set(rows.map(row=>row.id));
};

export function validateCompletedComparisonArm({name,campaign,profile,report,items}){
  if(!['baseline','improved'].includes(name)||campaign?.id!==`cuet-readiness-${name}-100-2026-10-08`||
    campaign.arm!==name||campaign.denominator!==100||campaign.measurement_only!==true||campaign.publication_policy!=='never'||
    profile?.measurement_only!==true||profile.publication_policy!=='never'||profile.release!==null||profile.topology!=='dual_blind'||
    !/^cuet-fit-validator-v7\.[0-9]+$/.test(profile.verifier_version||'')||!/^([a-f0-9]{64})$/.test(profile.prompt_hash||'')||
    !/^([a-f0-9]{64})$/.test(profile.contract_hash||''))throw Error(`comparison_arm_measurement_profile_invalid:${name||'unknown'}`);
  if(report?.id!==campaign.id||report.denominator!==100||report.measurement_only!==true||report.publication_policy!=='never')
    throw Error(`comparison_arm_report_scope_invalid:${name}`);
  if(report.complete!==true||report.pending!==0)throw Error(`comparison_arm_not_fully_terminal:${name}:pending_${report.pending}`);
  const campaignIds=uniqueIds(campaign.jobs,`comparison_${name}_campaign`),itemIds=uniqueIds(items,`comparison_${name}_items`);
  if(campaignIds.size!==100||itemIds.size!==100||[...campaignIds].some(id=>!itemIds.has(id))||items.some(row=>!TERMINAL.has(row.state)))
    throw Error(`comparison_arm_items_not_fully_terminal:${name}`);
  if(profile.arm!==name||profile.topology!==campaign.topology||profile.verifier_version!==campaign.verifier||
    profile.contract!=='cuet-fit-v7'||!Number.isInteger(profile.registry_version)||profile.registry_version!==campaign.registry_version)
    throw Error(`comparison_arm_profile_binding_mismatch:${name}`);
  if(report.profile?.verifier_version!==profile.verifier_version||report.profile?.prompt_hash!==profile.prompt_hash||
    report.profile?.topology!==profile.topology||report.profile?.contract!==profile.contract)
    throw Error(`comparison_arm_report_profile_mismatch:${name}`);
  return {candidate_ids:[...campaignIds],eligible_before_inspection:items.filter(row=>['eligible','published'].includes(row.state)).length,
    quarantined_before_inspection:items.filter(row=>row.state==='quarantined').length,terminal_items:items.length};
}

export function inspectCompletedComparisonArm({name,campaign,profile,report,registry,items,inventory,inspectAgainstInventory,evaluateEvidence}){
  const state=validateCompletedComparisonArm({name,campaign,profile,report,items});
  if(registry?.version!==campaign.registry_version||registry.version!==profile.registry_version)throw Error(`comparison_arm_registry_version_mismatch:${name}`);
  const candidateSet=new Set(state.candidate_ids),candidateEligibility=measurementInspectionEligibility(profile,registry,state.candidate_ids,
    evaluateEvidence?{evaluate:evaluateEvidence}:{}),currentEligibility=measurementInspectionEligibility(profile,registry,state.candidate_ids);
  const inventoryIds=new Set(inventory.map(row=>row.id));
  const eligible=q=>candidateSet.has(q?.id)?candidateEligibility(q):inventoryIds.has(q?.id)?{eligible:true,reasons:[]}:{eligible:false,reasons:['outside_inspection_scope']};
  for(const row of items.filter(item=>['eligible','published'].includes(item.state))){
    const q=row.candidate;if(!q||q.id!==row.id)throw Error(`comparison_candidate_missing_or_mismatched:${name}:${row.id}`);
  }
  const referenceRows=[],supportEvidence=[],registeredVerdicts=new Map();
  for(const row of items)if(row.candidate)registeredVerdicts.set(row.id,candidateEligibility(row.candidate));
  const registeredApprovals=[],currentCompatibility={compatible:0,failures_by_reason:{}};
  for(const row of items.filter(item=>['eligible','published'].includes(item.state))){
    const registered=registeredVerdicts.get(row.id)||{eligible:false,reasons:['candidate_missing']},current=currentEligibility(row.candidate);
    if(registered.eligible)registeredApprovals.push(row.id);
    if(current.eligible)currentCompatibility.compatible++;
    else for(const reason of current.reasons||[])currentCompatibility.failures_by_reason[reason]=(currentCompatibility.failures_by_reason[reason]||0)+1;
  }
  for(const row of items){
    const q=row.candidate;if(!q)continue;
    if(q.id!==row.id)throw Error(`comparison_candidate_id_mismatch:${name}:${row.id}`);
    const refs=q.source_refs||[];
    try{
      const material=sourceMaterial(registry,refs);
      referenceRows.push({id:row.id,refs_integrity_valid:true,source_refs:material.map(ref=>({id:ref.id,locator:ref.locator,version:refs.find(item=>item.id===ref.id&&item.locator===ref.locator)?.version}))});
    }catch(error){referenceRows.push({id:row.id,refs_integrity_valid:false,source_refs:refs.map(ref=>({id:ref.id,locator:ref.locator,version:ref.version})),reason:error.message});}
    const registeredApproved=['eligible','published'].includes(row.state)&&registeredVerdicts.get(row.id)?.eligible===true;
    const record=q.evidence?.record,content=contentHash(q);
    const checkPassed=stage=>registeredApproved&&record?.candidate_id===q.id&&record.content_hash===content&&
      record.checks?.[stage]?.passed===true&&record.checks[stage].candidate_id===q.id&&record.checks[stage].content_hash===content&&
      /^[a-f0-9]{64}$/.test(record.checks[stage].evidence_hash||'');
    const sourcePassed=checkPassed('source_support'),explanationPassed=checkPassed('explanation_support');
    supportEvidence.push({id:row.id,registered_contract_eligible:registeredApproved,
      source_support:sourcePassed?true:null,source_support_status:sourcePassed?'passed':'not_established',
      explanation_support:explanationPassed?true:null,explanation_support_status:explanationPassed?'passed':'not_established',
      source_support_not_established_reason:sourcePassed?null:registeredApproved?'registered_source_support_check_unbound_or_not_passed':'unapproved_unsigned_or_rejected_claim_not_established',
      explanation_support_not_established_reason:explanationPassed?null:registeredApproved?'registered_explanation_support_check_unbound_or_not_passed':'unapproved_unsigned_or_rejected_claim_not_established',
      source_support_evidence_hash:checkPassed('source_support')?record.checks.source_support.evidence_hash:null,
      explanation_support_evidence_hash:checkPassed('explanation_support')?record.checks.explanation_support.evidence_hash:null});
  }
  const inspection=inspectAgainstInventory(items,inventory,{eligible,registry});
  const decisions=new Map(inspection.decisions.map(decision=>[decision.id,decision]));
  const formats={},difficulty={},positions={},states={},reasons={};
  for(const row of items){states[row.state]=(states[row.state]||0)+1;}
  for(const decision of inspection.decisions)reasons[decision.reason]=(reasons[decision.reason]||0)+1;
  for(const row of items.filter(row=>['eligible','published'].includes(row.state)&&!decisions.has(row.id))){
    const q=row.candidate;
    formats[q.question_type]=(formats[q.question_type]||0)+1;
    difficulty[q.difficulty]=(difficulty[q.difficulty]||0)+1;
    positions[q.correct_answer]=(positions[q.correct_answer]||0)+1;
  }
  const groups=new Map();for(const row of items){const id=row.candidate?.passage_group_id||row.passage_group_id;if(id){groups.set(id,(groups.get(id)||0)+1);}}
  return {
    arm:name,campaign_id:campaign.id,denominator:100,
    preinspection:{eligible_or_published:state.eligible_before_inspection,quarantined:state.quarantined_before_inspection,states},
    registered_contract:{approved_under_registered_contract:registeredApprovals.length,approved_candidate_ids:registeredApprovals},
    current_contract_compatibility:{compatible:currentCompatibility.compatible,failures_by_reason:currentCompatibility.failures_by_reason,
      basis:'A distinct diagnostic against the currently checked-in v7 evaluator. It is not used to retroactively redefine the saved arm.'},
    accounting:{provider_processing_complete:report.provider_processing_complete===true,cost:report.cost,
      publication_accounting:report.publication_accounting,complete:report.complete,pending:report.pending,
      statement:'Academic dispositions can be terminal while accepted-request accounting remains incomplete; holds and pending receipts remain unresolved.'},
    proposed:{retained:inspection.approved,withheld:inspection.decisions.length,by_reason:reasons,decisions:inspection.decisions,duplicate_pairs:inspection.duplicate_pairs},
    kept_answer_positions:positions,kept_formats:formats,kept_difficulty:difficulty,
    excerpt_integrity:{candidate_rows:referenceRows.length,valid_reference_rows:referenceRows.filter(row=>row.refs_integrity_valid).length,
      invalid_reference_rows:referenceRows.filter(row=>!row.refs_integrity_valid).length,
      unique_sources:[...new Set(referenceRows.flatMap(row=>row.source_refs.map(ref=>ref.id)))].sort(),candidate_references:referenceRows,
      limitation:'Reference identity and excerpt hashes do not establish answer or explanation support.'},
    source_support:{passed:supportEvidence.filter(row=>row.source_support===true).length,
      not_established:supportEvidence.filter(row=>row.source_support!==true).length,evidence:supportEvidence},
    explanation_support:{passed:supportEvidence.filter(row=>row.explanation_support===true).length,
      not_established:supportEvidence.filter(row=>row.explanation_support!==true).length,evidence:supportEvidence},
    passage_groups:{groups:groups.size,candidate_members:items.filter(row=>row.candidate?.passage_group_id||row.passage_group_id).length,
      atomic_withholding_decisions:inspection.decisions.filter(decision=>['inspection_passage_group_contract','atomic_group_sibling_withheld'].includes(decision.reason)).length},
    inventory_compared:inspection.inventory_compared,inventory_ids_hash:inspection.inventory_ids_hash,
    content_hash:inspection.content_hash,contract:inspection.contract,ready_to_publish:false,
    limitation:'This is a read-only measurement proposal. Deterministic duplicate and format checks do not establish truth; no proposed withholding is applied and no publication eligibility is granted.'
  };
}

export function readArmArtifacts(directory,read=readFileSync){
  const files=Object.fromEntries(REQUIRED_FILES.map(name=>[name,read(`${directory}/${name}`)]));
  const json=name=>JSON.parse(files[name].toString('utf8'));
  return {campaign:json('campaign.json'),profile:json('verification-profile.json'),registry:json('registry.json'),items:json('all-candidates.json'),report:json('batch-report.json'),
    file_hashes:Object.fromEntries(Object.entries(files).map(([name,bytes])=>[name,bytesHash(bytes)]))};
}

export function inventoryIdentity(inventory){
  const rows=inventory.map(q=>({id:q.id,content_hash:contentHash(q),passage_group_id:q.passage_group_id||q.passage_id||null})).sort((a,b)=>a.id.localeCompare(b.id));
  return {count:rows.length,ids_hash:hashJSON(rows.map(row=>row.id)),content_hash:hashJSON(rows)};
}
