import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {contentHash} from '../../../data/content_evidence.js';
import {hashJSON} from '../../../data/question_factory_policy.mjs';
import {deriveNormativeRegistry,loadVerifiedPageContext} from './sourceContextIntegrityVNext.mjs';

const draft='artifacts/question-factory/cuet-readiness-2026-10-08/c-draft/scripts/pipeline';
export const C_SOURCE_OVERLAY_DIRECTORY='artifacts/question-factory/cuet-readiness-2026-10-08/c-source-overlay';
export const C_SOURCE_OVERLAY_PATH=C_SOURCE_OVERLAY_DIRECTORY+'/leac203.private-source.json';
export const C_SOURCE_OVERLAY_FILES=Object.freeze([
  C_SOURCE_OVERLAY_PATH,C_SOURCE_OVERLAY_DIRECTORY+'/leac203.pdf',
  C_SOURCE_OVERLAY_DIRECTORY+'/leac203.extraction.txt',C_SOURCE_OVERLAY_DIRECTORY+'/leac203.pages.json'
]);
export const C_CODE_FILES=Object.freeze([
  draft+'/tools/cuetFitFactoryC.mjs',draft+'/lib/candidateTransportProfileC.mjs',draft+'/lib/factoryTransportC.mjs',draft+'/lib/authorFormatC.mjs',
  'scripts/pipeline/tools/prepareCuetFitCampaignC.mjs','scripts/pipeline/tools/continueCuetFitCampaignC.mjs','scripts/pipeline/lib/candidateCSupervisor.mjs',
  'scripts/pipeline/lib/candidateFormatVNext.mjs','scripts/pipeline/lib/sourceContextIntegrityVNext.mjs',
  'scripts/pipeline/lib/candidateCRegistration.mjs','scripts/pipeline/lib/atomicArtifact.mjs','scripts/pipeline/lib/savedRequestBody.mjs',
  'scripts/pipeline/lib/measurementInspectionVNext.mjs',
  'scripts/pipeline/lib/factoryStore.mjs','scripts/pipeline/lib/budgetLedger.mjs','scripts/pipeline/lib/campaignExecutionV7.mjs',
  'scripts/pipeline/lib/briefDiversity.mjs','scripts/pipeline/lib/focusedBriefsV7.mjs',
  'scripts/pipeline/lib/constrainedAuthoring.mjs','scripts/pipeline/lib/campaignMeasurementLeaseVNext.mjs',...C_SOURCE_OVERLAY_FILES
]);
export function currentCCodeHashes(read=readFileSync){return Object.fromEntries(C_CODE_FILES.map(path=>[path,createHash('sha256').update(read(path)).digest('hex')]));}
export function assertCCodeBinding(expected,read=readFileSync){
  if(!expected||Object.keys(expected).length!==C_CODE_FILES.length||C_CODE_FILES.some(path=>!expected[path]))throw Error('candidate_c_complete_code_binding_required');
  const actual=currentCCodeHashes(read);if(C_CODE_FILES.some(path=>actual[path]!==expected[path]))throw Error('candidate_c_registered_dependency_changed');
}

export function assertCandidateCBankDisposed(reassessment,results){
  if(!reassessment||reassessment.denominator!==662||!Array.isArray(reassessment.content_hashes)||reassessment.content_hashes.length!==662||
    reassessment.content_hashes.some(row=>!Array.isArray(row)||typeof row[0]!=='string'||!row[0]||typeof row[1]!=='string'||!row[1])||
    new Set(reassessment.content_hashes.map(row=>row[0])).size!==662)throw Error('candidate_c_bank_662_disposition_required');
  if(!Array.isArray(results))throw Error('candidate_c_bank_662_disposition_required');
  const expected=new Map(reassessment.content_hashes),latest=new Map();
  for(const row of results){
    if(!row?.id||!expected.has(row.id))throw Error('candidate_c_reassessment_unexpected_id');
    latest.set(row.id,row);
  }
  if(latest.size!==662||[...expected.keys()].some(id=>!latest.has(id)))throw Error('candidate_c_reassessment_latest_ids_incomplete');
  const currentSourceRefs=[...expected.keys()].map(id=>latest.get(id).source_refs);
  if(typeof reassessment.source_refs_hash!=='string'||hashJSON(currentSourceRefs)!==reassessment.source_refs_hash)throw Error('candidate_c_reassessment_source_refs_mismatch');
  reassessedStagingInventory([],results,reassessment);
  return {bank_candidates:662,latest_unique_ids:latest.size,terminal:true};
}

export function assertCandidateCPrerequisites(arms,reassessment,results){
  if(!Array.isArray(arms)||arms.length!==2||new Set(arms.map(arm=>arm?.name)).size!==2||
    !['baseline','improved'].every(name=>arms.some(arm=>arm?.name===name)))throw Error('candidate_c_two_comparison_arms_required');
  for(const arm of arms){
    const {name,report,campaign,items}=arm||{},jobs=campaign?.jobs;
    if(!['baseline','improved'].includes(name)||report?.id!==campaign?.id||!report?.complete||report.denominator!==100||report.pending!==0||
      !Array.isArray(jobs)||jobs.length!==100||new Set(jobs.map(j=>j.id)).size!==100||
      !Array.isArray(items)||items.length!==100||new Set(items.map(j=>j.id)).size!==100||
      items.some(j=>!['eligible','quarantined','published'].includes(j.state))||
      jobs.some(j=>!items.some(row=>row.id===j.id)))throw Error(`candidate_c_comparison_arm_incomplete:${name||'unknown'}`);
    assertCandidateCFixedCohort(jobs);
  }
  assertCandidateCBankDisposed(reassessment,results);
  return {comparison_candidates:200,bank_candidates:662,terminal:true};
}

export function assertCandidateCFixedCohort(jobs){
  const subjects=['english','accountancy','business_studies','economics'];
  if(!Array.isArray(jobs)||jobs.length!==100||new Set(jobs.map(job=>job.id)).size!==100||
    subjects.some(subject=>jobs.filter(job=>job.subject===subject).length!==25)||jobs.some(job=>!subjects.includes(job.subject))){
    throw Error('candidate_c_fixed_100_with_25_per_subject_required');
  }
  return true;
}

// Rebuild only topic attribution from the latest exact-profile reassessment.
// The older `tags` remain attached to each observation for diagnosis; they are
// never used to fill current topic counters.
export function refreshCoverageWithCurrentReassessment(coverage,results,profile){
  if(!coverage||!Array.isArray(coverage.cells)||!Array.isArray(results)||!Array.isArray(profile?.content_hashes))
    throw Error('candidate_c_current_coverage_inputs_required');
  const expected=new Map(profile.content_hashes),latest=new Map(results.map(row=>[row.id,row]));
  const normalize=s=>String(s||'').normalize('NFKC').toLowerCase().replace(/[^a-z0-9]+/g,' ').trim();
  const refreshed=structuredClone(coverage);
  for(const cell of refreshed.cells){
    if(!Array.isArray(cell.topics)||!Array.isArray(cell.validated_topic_observations))continue;
    for(const topic of cell.topics){topic.usable=0;topic.formats={};topic.difficulties={};}
    cell.topic_unclassified=0;
    const topicById=new Map(cell.topics.map(topic=>[topic.id,topic]));
    for(const observation of cell.validated_topic_observations){
      const id=observation.id,content=expected.get(id),row=latest.get(id);
      const checks=row?.result?.question?.evidence?.record?.checks;
      const exactCurrent=typeof content==='string'&&row?.verifier===profile.verifier&&row.contract===profile.contract&&
        row.content_hash===content&&row.state==='eligible'&&checks?.schema?.candidate_id===id&&checks.schema.content_hash===content;
      const tags=exactCurrent?[checks?.blind_solution?.syllabus_topic,checks?.independent_evaluation?.syllabus_topic]:[];
      observation.current_reassessment_tags=tags;
      observation.current_reassessment_match=Boolean(exactCurrent);
      const matches=tags.map(tag=>!tag?[]:cell.topics.filter(topic=>{
        const a=normalize(topic.text),b=normalize(tag);return a&&b&&(a.includes(b)||b.includes(a));
      }));
      const assigned=exactCurrent&&matches.length===2&&matches.every(match=>match.length===1)&&matches[0][0].id===matches[1][0].id;
      observation.official_topic_assigned=Boolean(assigned);
      if(!assigned){cell.topic_unclassified++;continue;}
      const topic=topicById.get(matches[0][0].id);if(!topic){cell.topic_unclassified++;observation.official_topic_assigned=false;continue;}
      topic.usable++;
      const format=observation.format||'unclassified',difficulty=observation.difficulty||'unclassified';
      topic.formats[format]=(topic.formats[format]||0)+1;
      topic.difficulties[difficulty]=(topic.difficulties[difficulty]||0)+1;
    }
  }
  return refreshed;
}

// Coverage uses actual staged rows whose exact current content has a terminal
// independent reassessment. Pending, stale, rejected and partial passage units
// cannot fill a gap. Eligibility here is provisional, not a topology release.
export function reassessedStagingInventory(inventory,results,profile,{requireComplete=true}={}){
  const latest=new Map(results.map(row=>[row.id,row])),expected=new Map(profile.content_hashes),terminal=new Set(['eligible','quarantined']);
  const matches=row=>row?.verifier===profile.verifier&&row.contract===profile.contract&&row.content_hash===expected.get(row.id);
  const unresolved=[...expected].filter(([id])=>!matches(latest.get(id))||!terminal.has(latest.get(id)?.state)).map(([id])=>id);
  if(requireComplete&&unresolved.length)throw Error('candidate_c_reassessment_incomplete:'+unresolved.length);
  const good=new Set(inventory.filter(q=>{const row=latest.get(q.id);return matches(row)&&row.state==='eligible'&&contentHash(q)===row.content_hash;}).map(q=>q.id));
  const groups=new Map();for(const q of inventory){const group=q.passage_group_id||q.passage_id;if(group){if(!groups.has(group))groups.set(group,[]);groups.get(group).push(q.id);}}
  for(const ids of groups.values())if(ids.some(id=>!good.has(id)))for(const id of ids)good.delete(id);
  return {inventory:inventory.filter(q=>good.has(q.id)),unresolved,excluded:inventory.length-good.size,basis:'Actual staging inventory with exact current terminal reassessment; complete passage units only. Unreleased machine eligibility is disclosed separately from publication.'};
}

export function assertCandidateCPrivateSourceOverlay(overlay,registry){
  const source=overlay?.source,doc=overlay?.document,review=doc?.visual_review;
  if(overlay?.schema!=='mockmob-private-c-source-overlay-v1'||source?.id!=='ncert-leac203'||
    source.url!=='https://ncert.nic.in/textbook/pdf/leac203.pdf'||source.title!=='Financial Statements of a Company'||
    source.kind!=='reference'||source.state!=='active'||source.version!==1||source.reuse_permitted!==true||
    source.extraction_checked!==true||source.chapters?.length!==1||source.chapters[0]!=='Financial Statements of Company'||
    source.source_pack_id!=='original-accountancy-reference-v1'||doc?.printed_title!=='Financial Statements of a Company'||
    doc.edition!=='Reprint 2026-27'||doc.pdf_page_count!==27||review?.status!=='visually_checked'||
    review.checked_at!=='2026-10-08'||!Array.isArray(review.pdf_pages_1based)||
    !Array.isArray(doc?.visual_review?.printed_pages)||source.permission?.reference!==source.url||
    source.permission?.basis!==registry?.sources?.['ncert-leac201']?.permission?.basis)
    throw Error('candidate_c_private_source_overlay_metadata_invalid');
  const pagesRequired=[1,2,3,4,10,11,12,13,21,22,23,24];
  if(JSON.stringify(review.pdf_pages_1based)!==JSON.stringify(pagesRequired)||
    JSON.stringify(review.printed_pages)!==JSON.stringify(pagesRequired.map(page=>page+143)))
    throw Error('candidate_c_private_source_visual_review_incomplete');
  const context=loadVerifiedPageContext(source);
  const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
  if(context.pages.length!==27||context.pages[0].page!==1||
    !context.pages[0].text.includes('Financial Statements of a Company')||
    !context.pages[26].text.includes('Reprint 2026-27')||
    sha(readFileSync(C_SOURCE_OVERLAY_DIRECTORY+'/leac203.pages.json'))!==overlay.cache_sha256?.pages_json)
    throw Error('candidate_c_private_source_cache_identity_mismatch');
  for(const page of review.pdf_pages_1based){
    if(sha(Buffer.from(context.pages[page-1].text,'utf8'))!==review.page_text_sha256?.[String(page)])
      throw Error('candidate_c_private_source_page_identity_mismatch:'+page);
  }
  const normalize=text=>String(text||'').normalize('NFKC').replace(/[\s\u0000-\u001f]+/g,' ').trim();
  const factPages=overlay.fact_page_map||{};
  if(!source.facts||!source.supports||Object.keys(source.facts).length!==Object.keys(source.supports).length||
    Object.keys(source.facts).length!==Object.keys(factPages).length)
    throw Error('candidate_c_private_source_fact_binding_invalid');
  for(const [locator,fact] of Object.entries(source.facts)){
    const page=factPages[locator],text=fact?.text;
    if(!Number.isInteger(page)||page<1||page>27||typeof text!=='string'||!text.trim()||
      source.supports[locator]!==hashJSON(text)||!normalize(context.pages[page-1].text).includes(normalize(text))||
      /learning objectives|questions for practice|illustration|solution:|particulars|long answer questions/i.test(text))
      throw Error('candidate_c_private_source_excerpt_identity_invalid:'+locator);
  }
  const sourceBytes=readFileSync(C_SOURCE_OVERLAY_DIRECTORY+'/leac203.pdf'),extractionBytes=readFileSync(C_SOURCE_OVERLAY_DIRECTORY+'/leac203.extraction.txt');
  return {source_id:source.id,source_version:source.version,title:doc.printed_title,edition:doc.edition,pdf_page_count:context.pages.length,
    url:source.url,permission_basis:source.permission.basis,identity_sha256:sha(sourceBytes),extraction_sha256:sha(extractionBytes),
    pages_json_sha256:sha(readFileSync(C_SOURCE_OVERLAY_DIRECTORY+'/leac203.pages.json')),
    visual_review_pages:review.pdf_pages_1based,page_text_sha256:review.page_text_sha256,overlay_sha256:sha(readFileSync(C_SOURCE_OVERLAY_PATH))};
}

export function candidateCSourceViews(registry,privateOverlay=null){
  const derived=deriveNormativeRegistry(registry),selection=structuredClone(derived.registry);
  for(const [id,locators]of Object.entries(derived.eligible_locators)){
    const source=selection.sources[id];source.facts=Object.fromEntries(locators.map(k=>[k,source.facts[k]]));source.supports=Object.fromEntries(locators.map(k=>[k,source.supports[k]]));
    if(!locators.length)source.state='withheld_context_unresolved';
  }
  let overlayBinding=null;
  if(privateOverlay){
    overlayBinding=assertCandidateCPrivateSourceOverlay(privateOverlay,registry);
    const id='ncert-leac201',legacy=selection.sources[id];
    if(!legacy?.chapters?.includes('Share Capital'))throw Error('candidate_c_legacy_sharecapital_reference_required');
    legacy.chapters=legacy.chapters.filter(chapter=>chapter==='Share Capital');
    const privateSource=structuredClone(privateOverlay.source);
    derived.registry.sources[privateSource.id]=privateSource;selection.sources[privateSource.id]=structuredClone(privateSource);
    const pack=selection.packs?.[privateSource.source_pack_id];
    if(!pack||!Array.isArray(pack.document_ids))throw Error('candidate_c_accountancy_reference_pack_required');
    if(!pack.document_ids.includes(privateSource.id))pack.document_ids.push(privateSource.id);
    derived.registry.packs[privateSource.source_pack_id].document_ids=[...pack.document_ids];
  }
  return{...derived,selection_registry:selection,overlay_binding:overlayBinding};
}

// Failed and pending attempts still matter for novelty. This context influences
// authoring only; it never adds a question to usable inventory or coverage.
export function priorCampaignPlanningContext(campaigns){
  const context=[],seen=new Set();
  for(const {campaign,items} of campaigns){
    if(!Array.isArray(campaign?.jobs)||!Array.isArray(items))throw Error('prior_campaign_planning_snapshot_required');
    const saved=new Map(items.map(row=>[row.id,row]));
    for(const job of campaign.jobs){
      if(!job.id||seen.has(job.id))throw Error('prior_campaign_planning_id_invalid');seen.add(job.id);
      const row=saved.get(job.id)||job,candidate=row.candidate||{};
      context.push({...job,...row,...candidate,id:job.id,source_refs:candidate.source_refs||row.source_refs||job.source_refs||[],planning_only:true,attempt_state:row.state||job.state});
    }
  }
  return context;
}

// A derived teaching excerpt retains its parent fact's identity. Carry historical
// parent use into ranking, while preserving the actual old evidence unchanged.
export function planningReferenceContext(context,registry){
  return context.map(q=>{
    const refs=[...(q.source_refs||[])];
    for(const ref of q.source_refs||[]){
      const source=registry.sources[ref.id];if(!source||source.version!==ref.version)continue;
      for(const [locator,span] of Object.entries(source.normative_context||{})){
        if(span.parent_locator===ref.locator&&span.parent_support_hash===ref.support_hash){
          const next={id:ref.id,version:ref.version,locator,support_hash:source.supports[locator]};
          if(!refs.some(r=>r.id===next.id&&r.version===next.version&&r.locator===next.locator&&r.support_hash===next.support_hash))refs.push(next);
        }
      }
    }
    return {...q,source_refs:refs,planning_only:true};
  });
}
