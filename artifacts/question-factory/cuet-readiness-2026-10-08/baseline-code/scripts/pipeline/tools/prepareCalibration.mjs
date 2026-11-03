import { readFileSync,writeFileSync } from 'node:fs';
import { resolve,relative,basename } from 'node:path';
import { createHash } from 'node:crypto';
import { hashJSON,FACTORY_SUBJECTS } from '../../../data/question_factory_policy.mjs';
import { registerSourcePack } from '../lib/sourcePacks.mjs';
import { officialCalibrationUnit,validateCalibrationManifest } from '../lib/factoryCalibration.mjs';

// Assemble curated, officially keyed examples and actual NCERT page contexts.
// This is provenance bookkeeping; it cannot declare academic calibration passed.
const root=resolve('data/question-factory-runtime'),read=path=>JSON.parse(readFileSync(path,'utf8')),sha=path=>createHash('sha256').update(readFileSync(path)).digest('hex'),norm=s=>String(s || '').replace(/\s+/g,' ').trim(),rel=path=>relative(root,resolve(path)).replaceAll('\\','/');
const extracts=read(resolve(root,'reference-downloads/extraction-metadata.json'));
const english=read(resolve(root,'english-auth-work/calibration-drafts.json')),accountancy=read(resolve(root,'accountancy-auth-work/calibration-drafts.json')),other=read(resolve(root,'business-economics-auth-work/calibration-drafts.json'));
const items=[...(english.development_candidates || []).map(i=>({...i,subject:'english',split:'development',number:i.source_question_id,explanation:i.root_use_explanation})),...(english.held_out_nonpassage_items || []).map(i=>({...i,subject:'english',split:'held_out',number:i.source_question_id,explanation:i.root_use_explanation})),
  ...accountancy.drafts.map(i=>({...i,split:i.calibration_split,number:i.question_id})),...Object.entries(other.subjects).flatMap(([subject,data])=>data.items.map(i=>({...i,subject:subject==='business-studies'?'business_studies':'economics',number:i.question_number})))];
let registry=read('data/source_registry.json');
const attached=[];
for(const subject of FACTORY_SUBJECTS) {
  const path=resolve(root,`${subject}-authenticated-pack.json`),pack=read(path);
  for(const item of items.filter(i=>i.subject===subject)) {
    const anchor=pack.anchors.find(a=>a.official_question_id===String(item.number));if(!anchor)throw new Error(`calibration_anchor_missing:${subject}:Q${item.number}`);
    if(!item.explanation?.trim())throw new Error('curated_explanation_required');
    const reference=item.subject_matter_support || item.ncert_context;
    if(reference) {
      const url=reference.url,id=basename(new URL(url).pathname,'.pdf'),metadata=extracts.find(m=>m.id===id),expected=reference.source_pdf_sha256 || reference.sha256;
      if(!metadata || sha(metadata.file)!==expected || metadata.identity_sha256!==expected)throw new Error('curated_ncert_file_identity_mismatch');
      const pageNumbers=reference.pdf_pages || [reference.pdf_page],pages=read(resolve(metadata.file.replace(/\.pdf$/,'.pages.json'))),selected=pageNumbers.map(n=>pages.find(p=>p.page===n));
      if(selected.some(p=>!p?.text))throw new Error('curated_ncert_page_missing');
      const text=selected.map(p=>p.text).join(' '),refId=`ncert-${id}`,excerpt=reference.exact_context_excerpt || reference.brief_exact_excerpt;
      const spans=reference.exact_excerpt_spans;
      if(spans?.length?spans.some(span=>!norm(selected.find(p=>p.page===span.pdf_page)?.text).includes(norm(span.quote))):excerpt && !norm(text).includes(norm(excerpt)))throw new Error(`curated_ncert_excerpt_changed:${subject}:Q${item.number}`);
      let source=pack.documents.find(d=>d.id===refId);
      if(!source){source={id:refId,kind:'reference',url,file:rel(metadata.file),identity_sha256:metadata.identity_sha256,extraction_file:rel(metadata.extraction_file),extraction_sha256:metadata.extraction_sha256,extraction_checked:true,version:1,reuse_permitted:true,permission:{basis:'Brief attributed excerpts from official NCERT used for local educational validation; no unrestricted republication claim',reference:url},facts:[]};pack.documents.push(source);}
      for(const page of selected){const pageLocator=`pdf-page-${page.page}`;if(!source.facts.some(f=>f.locator===pageLocator))source.facts.push({locator:pageLocator,text:page.text});
        if(!anchor.source_refs.some(r=>r.id===refId && r.locator===pageLocator))anchor.source_refs.push({id:refId,version:1,locator:pageLocator,support_hash:hashJSON(page.text)});}
      anchor.generation_ready=true;anchor.source_support_state='reference_curated_pending_blind_validation';
    }
    anchor.source_refs=[...new Map(anchor.source_refs.map(r=>[`${r.id}:${r.locator}`,r])).values()];
    anchor.explanation=item.explanation;anchor.explanation_source_matched=true;
    attached.push({anchor_id:anchor.id,split:item.split,subject,source_question_id:anchor.official_question_id});
  }
  registry=registerSourcePack(pack,root,registry);writeFileSync(path,JSON.stringify(pack,null,2));
}
const manifest={version:'official-cuET-calibration-fixtures-v1',split_policy:'authenticated_item_and_passage_disjoint_v1',state:'prepared_not_released',development:[],held_out:[],limitations:['Same authenticated 2024 paper per subject; distinct questions and complete stimulus families across splits, not independent papers.','Official key is external baseline, not proof of conceptual truth.','Difficulty is a curator estimate.','Known-bad injection fixtures must be added before release.']};
for(const item of attached) {
  const anchor=registry.examples.find(a=>a.id===item.anchor_id),spec=registry.exam_specs[anchor.subject];
  const q={...anchor,id:`calibration-${anchor.id}`,family_id:anchor.family_id || `pyq:${anchor.id}`,provenance:{kind:'authentic_pyq',anchor_id:anchor.id,adaptation_family:anchor.family_id || `pyq:${anchor.id}`,source_pack_id:anchor.source_pack_id,source_pack_version:anchor.source_pack_version,syllabus_version:spec.syllabus_version,pattern_version:spec.pattern_version}};
  manifest[item.split].push({id:q.id,split:item.split,category:`valid_${anchor.difficulty==='hard'?'difficult':anchor.difficulty}`,valid:true,question:q,provenance:{anchor_id:anchor.id,source_id:anchor.source_id,source_unit_id:officialCalibrationUnit(anchor),key_locator:anchor.key_locator,independently_keyed:true,final_answer:anchor.correct_answer}});
}
registry.calibration_anchor_ids=[...new Set(attached.map(a=>a.anchor_id))];
// A partial selection reserves the entire stimulus family.
for(const id of [...registry.calibration_anchor_ids]){const anchor=registry.examples.find(a=>a.id===id),group=registry.passage_groups[anchor?.passage_group_id];if(group)registry.calibration_anchor_ids.push(...group.anchor_ids);}
registry.calibration_anchor_ids=[...new Set(registry.calibration_anchor_ids)];
validateCalibrationManifest(manifest,registry);
writeFileSync(resolve(root,'source-registry-calibration-draft.json'),JSON.stringify(registry,null,2));writeFileSync(resolve(root,'calibration-fixtures.json'),JSON.stringify(manifest,null,2));
const report={at:new Date().toISOString(),draft_only:true,production_changes:0,academic_release:false,development:manifest.development.length,held_out:manifest.held_out.length,by_subject:Object.fromEntries(FACTORY_SUBJECTS.map(s=>[s,{development:manifest.development.filter(f=>f.question.subject===s).length,held_out:manifest.held_out.filter(f=>f.question.subject===s).length}])),reserved_anchors:registry.calibration_anchor_ids.length,source_registry_version:registry.version};
writeFileSync('artifacts/question-factory/calibration-preparation.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));
