import { createHash } from 'node:crypto';
import { canonicalQuestion, contentHash, evidenceSignature, evaluateEvidence } from '../../../data/content_evidence.js';
import { isValidTopSyllabusPair } from '../../../data/canonical_syllabus.js';

const hash = value => createHash('sha256').update(JSON.stringify(value)).digest('hex');
export function requiredStages(route) {
  return ['source_support', ...(route === 'numerical' ? ['independent_solver','boundary_cases'] : []),
    ...(route === 'passage' ? ['passage_integrity','passage_answerability'] : []),
    'blind_solution','alternatives','explanation_support','exam_fit'];
}
export function structureVerdict(candidate) {
  const q=canonicalQuestion(candidate);
  const reasons=[];
  if (!q.body.trim() || q.options.length!==4 || !q.options.every(o=>typeof o.text==='string' && o.text.trim())) reasons.push('invalid_structure');
  if(new Set(q.options.map(o=>o.text?.trim().toLowerCase())).size!==4) reasons.push('option_collision');
  if(!q.options.some(o=>o.key===q.key)) reasons.push('invalid_key');
  if(!isValidTopSyllabusPair(q.subject,q.chapter)) reasons.push('unsupported_mapping');
  if(!q.explanation.trim()) reasons.push('missing_explanation');
  if(candidate.route==='passage' && !q.passage.trim()) reasons.push('orphan_passage');
  return {passed:reasons.length===0,reasons};
}
function blindView(candidate, references) {
  const q=canonicalQuestion(candidate);
  // Neither proposed key, explanation, evidence nor generator rationale leaves this boundary.
  return {candidate_id:candidate.id || candidate.candidate_id || candidate.local_id,
    content_hash:contentHash(candidate),family_id:candidate.family_id,subject:q.subject,chapter:q.chapter,body:q.body,
    options:q.options,passage:q.passage,references};
}
export async function verifyCandidate(candidate,{registry,ledger,adapters,version,secret,seen=new Set()}) {
  const id=candidate.id || candidate.candidate_id || candidate.local_id;
  const content_hash=contentHash(candidate); const checks={};
  const fail=reason=>({state:'quarantined',candidate_id:id,content_hash,reasons:[reason],checks});
  if(!id || !version || !secret || process.env.MOCK_AI==='true') return fail('verification_configuration_missing');
  const local=structureVerdict(candidate);
  if(!local.passed) return fail(local.reasons.join(','));
  const stem=hash({subject:candidate.subject,body:canonicalQuestion(candidate).body.toLowerCase().replace(/\s+/g,' ').trim()});
  if(seen.has(stem)) return fail('duplicate_before_paid_checks');
  seen.add(stem);
  const stamp=result=>({...result,candidate_id:id,content_hash,evidence_hash:hash(result)});
  checks.schema=stamp(local); checks.dedupe=stamp({passed:true,stem});
  const family=registry.families?.[candidate.family_id];
  if(!family || family.state!=='active') return fail('family_not_active');
  const references=candidate.source_refs || [];
  if(!references.length || references.some(r=>{
    const s=registry.sources?.[r.id];
    return !s || s.state!=='active' || !s.reuse_permitted || s.version!==r.version || !r.support_hash || s.supports?.[r.locator]!==r.support_hash;
  })) return fail('source_support_missing');
  const view=blindView(candidate,references);
  for(const stage of requiredStages(candidate.route)) {
    const adapter=adapters?.[stage];
    if(typeof adapter!=='function') return fail(`adapter_missing:${stage}`);
    const cacheKey=hash({id,content_hash,references,version,stage,family_version:family.version});
    let result=ledger?.getCache(cacheKey);
    if(!result) {
      result=await adapter(structuredClone(stage==='explanation_support' ? {...view,proposed_explanation:canonicalQuestion(candidate).explanation} : view));
      if(!result || result.candidate_id!==id || result.content_hash!==content_hash || result.mock===true) return fail(`unmatched_verdict:${stage}`);
      ledger?.setCache(cacheKey,result);
    }
    if(result.passed!==true) return fail(`failed:${stage}`);
    if(stage==='blind_solution' && result.solved_key!==canonicalQuestion(candidate).key) return fail('blind_key_contradiction');
    if(stage==='independent_solver' && result.solved_key!==canonicalQuestion(candidate).key)return fail('independent_solver_key_contradiction');
    checks[stage]=stamp(result);
  }
  const record={candidate_id:id,content_hash,state:'eligible',route:candidate.route,
    family_id:candidate.family_id,family_version:family.version,sources:references,
    verifier_version:version,verified_at:new Date().toISOString(),
    expires_at:new Date(Date.now()+30*86400000).toISOString(),solved_key:checks.blind_solution.solved_key,checks};
  const question={...candidate,evidence:{record,signature:evidenceSignature(record,secret)}};
  const verdict=evaluateEvidence(question,{...registry,secret});
  return verdict.eligible ? {state:'eligible',question} : fail(verdict.reasons.join(','));
}

export async function verifyBatch(candidates,config) {
  const ids=candidates.map(q=>q.id || q.candidate_id || q.local_id);
  if(new Set(ids).size!==ids.length) throw new Error('duplicate_candidate_ids');
  const seen=new Set();const results=[];
  for(const candidate of candidates) {
    let result=await verifyCandidate(candidate,{...config,seen});
    const id=candidate.id || candidate.candidate_id || candidate.local_id;
    // Repairs are optional, targeted, and at most once over the candidate's
    // lifetime. The repaired content starts all applicable checks again.
    if(result.state==='quarantined' && typeof config.adapters?.repair==='function' &&
       result.reasons.some(r=>r.startsWith('failed:') || r==='blind_key_contradiction') && config.ledger?.claimRepair(id)){
      const repaired=await config.adapters.repair({candidate:structuredClone(candidate),failure:result.reasons});
      if((repaired?.id || repaired?.candidate_id || repaired?.local_id)!==id){result={...result,reasons:['repair_id_mismatch']};}
      else {
        const q=canonicalQuestion(candidate);
        seen.delete(hash({subject:candidate.subject,body:q.body.toLowerCase().replace(/\s+/g,' ').trim()}));
        result=await verifyCandidate(repaired,{...config,seen});
        result.repair_attempted=true;
      }
    }
    results.push(result);
  }
  return results;
}

// Family-disjoint, independently keyed academic fixtures must be supplied separately.
export async function calibrate(fixtures,verify,development=[]) {
  const results=[];
  for(const fixture of fixtures) {
    const result=await verify(fixture.question);
    results.push({id:fixture.id,category:fixture.category,expected:fixture.valid,passed:result.state==='eligible'});
  }
  const valid=results.filter(r=>r.expected);const invalid=results.filter(r=>!r.expected);
  const required=['valid_easy','valid_medium','valid_difficult','wrong_key','multiple_correct','missing_assumptions','out_of_syllabus','false_citation','unsupported_explanation','orphan_passage','cosmetic_duplicate','option_collision','solver_boundary'];
  const missing_categories=required.filter(category=>!results.some(r=>r.category===category));
  const independent=fixtures.every(f=>f.provenance?.independently_keyed===true && f.provenance?.source_id && f.provenance?.key_locator && f.split==='held_out');
  const devFamilies=new Set(development.map(f=>f.question?.family_id || f.family_id));
  const devSources=new Set(development.map(f=>f.provenance?.source_id));
  const split_disjoint=fixtures.every(f=>f.question?.family_id && !devFamilies.has(f.question.family_id) && !devSources.has(f.provenance?.source_id));
  return {sample_size:results.length,valid_sample_size:valid.length,invalid_sample_size:invalid.length,missing_categories,independent,split_disjoint,
    valid_survival:valid.length ? valid.filter(r=>r.passed).length/valid.length : null,
    critical_false_accepts:invalid.filter(r=>r.passed).length,
    released:independent && split_disjoint && missing_categories.length===0 && valid.length>0 && invalid.length>0 && valid.filter(r=>r.passed).length/valid.length>=.95 && invalid.every(r=>!r.passed),results};
}
