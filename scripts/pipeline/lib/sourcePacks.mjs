import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { resolve, relative, isAbsolute } from 'node:path';
import { FACTORY_SUBJECTS, hashJSON } from '../../../data/question_factory_policy.mjs';
import { isValidTopSyllabusPair,getCanonicalChapters } from '../../../data/canonical_syllabus.js';
import { corroboratePaper,matchMirroredAnchor,omrAnswer } from './mirroredPaperEvidence.mjs';

const fileHash = path => createHash('sha256').update(readFileSync(path)).digest('hex');
function localFile(root, name) {
  if (typeof name !== 'string' || !name) throw new Error('source_file_required');
  const path=resolve(root,name), rel=relative(root,path);
  if(rel.startsWith('..') || isAbsolute(rel)) throw new Error('source_path_outside_pack');
  return path;
}
// Source registration consumes independently checked extraction/key records; an
// LLM-written URL/year or an existing real_pyq tag is deliberately insufficient.
export function registerSourcePack(pack, root, previous) {
  if(!FACTORY_SUBJECTS.includes(pack.subject) || !pack.id || !pack.version || !pack.documents?.length || !pack.anchors?.length) throw new Error('source_pack_incomplete');
  const sources={};
  for(const doc of pack.documents) {
    if(!doc.id || sources[doc.id] || (previous.sources?.[doc.id] && previous.sources[doc.id].source_pack_id!==pack.id))throw new Error('source_document_id_collision');
    const file=localFile(root,doc.file), extraction=localFile(root,doc.extraction_file);
    if(fileHash(file)!==doc.identity_sha256 || fileHash(extraction)!==doc.extraction_sha256 || doc.extraction_checked!==true || !doc.url ||
      !doc.reuse_permitted || !doc.permission?.basis || !doc.permission?.reference) throw new Error('source_identity_extraction_permission_required');
    if(!['syllabus','paper','final_key','reference'].includes(doc.kind)) throw new Error('source_kind_required');
    if(['paper','final_key','syllabus'].includes(doc.kind) && (!Number.isInteger(doc.year) || doc.year<2000))throw new Error('source_document_year_required');
    if(['paper','final_key','syllabus'].includes(doc.kind) && !['cuet.nta.nic.in','nta.ac.in','www.nta.ac.in'].includes(new URL(doc.url).hostname)) {
      const index=doc.official_index_file?localFile(root,doc.official_index_file):null;
      const indexed=new URL(doc.url).hostname==='cdnbbsr.s3waas.gov.in' && index && fileHash(index)===doc.official_index_sha256 &&
        ['cuet.nta.nic.in','nta.ac.in','www.nta.ac.in'].includes(new URL(doc.official_index_url || 'https://invalid.test').hostname) && readFileSync(index,'utf8').includes(doc.url);
      if(!indexed) {
        if(doc.kind!=='paper')throw new Error('official_document_required');
        corroboratePaper(doc,{localFile,fileHash,subject:pack.subject},root);
      }
    }
    const extracted=readFileSync(extraction,'utf8'), facts={}, supports={};
    for(const fact of doc.facts || []) {
      if(!fact.locator || typeof fact.text!=='string' || !fact.text.trim() || !extracted.includes(fact.text)) throw new Error('source_locator_excerpt_required');
      facts[fact.locator]={text:fact.text}; supports[fact.locator]=hashJSON(fact.text);
    }
    if(!Object.keys(facts).length) throw new Error('source_facts_required');
    sources[doc.id]={...doc,state:'active',version:doc.version || pack.version,facts,supports};
  }
  const examples=pack.anchors.map(a=>{
    const paper=sources[a.source_id], key=sources[a.final_key_source_id];
    const paperText=paper?.facts?.[a.paper_locator]?.text, keyText=key?.facts?.[a.key_locator]?.text;
    if(paper?.year!==key?.year || (a.year && a.year!==paper?.year))throw new Error('paper_final_key_year_mismatch');
    if(!a.id || !a.official_question_id || !isValidTopSyllabusPair(pack.subject,a.chapter) || paper?.kind!=='paper' || key?.kind!=='final_key' ||
        a.final_key_matched!==true || a.authentication?.independently_matched!==true || !a.authentication?.basis || !paperText?.includes(a.body) || !paperText.includes(a.official_question_id) ||
        !keyText?.includes(a.official_question_id) || !keyText.includes(a.key_quote) || !a.key_quote || a.options?.length!==4 || a.options.some(o=>!paperText.includes(typeof o==='string'?o:o.text))) throw new Error('authenticated_paper_final_key_match_required');
    if(!a.dropped && !/^[ABCD]$/.test(a.correct_answer || '')) throw new Error('single_answer_final_key_required');
    matchMirroredAnchor(a,paper,key,keyText);
    if(!['conceptual','numerical','passage'].includes(a.route) || !a.question_type || !['easy','medium','hard'].includes(a.difficulty))throw new Error('anchor_format_and_depth_required');
    if(a.route==='passage' && (!a.passage_text?.trim() || !a.passage_group_id))throw new Error('authenticated_passage_and_group_required');
    const keyRow=a.key_quote.trim().match(/^(\S+)\s+(.+)$/);
    const keyTokens=keyRow?[keyRow[1],keyRow[2]]:[];
    const omr=omrAnswer(a,keyText);
    if(omr===null && (keyTokens.length!==2 || keyTokens[0]!==String(a.official_question_id)))throw new Error('exact_final_key_row_required');
    if(omr!==null) {
      if(a.dropped?!['DROP','MULTIPLE'].includes(omr) && !/^\d+(,\d+)+$/.test(omr):!/^[1-4]$/.test(omr) || 'ABCD'[Number(omr)-1]!==a.correct_answer)throw new Error('official_omr_key_mapping_required');
    } else if(!a.dropped && a.key_format==='position') {
      if(!/^[1-4]$/.test(keyTokens[1]) || 'ABCD'[Number(keyTokens[1])-1]!==a.correct_answer || a.authentication.option_order_checked!==true)throw new Error('official_position_key_mapping_required');
    } else if(!a.dropped) {
      if(a.official_option_ids?.length!==4 || new Set(a.official_option_ids.map(String)).size!==4 ||
        !a.official_option_ids.every(id=>paperText.includes(String(id))) || keyTokens[1]!==String(a.final_key_option_id) ||
        a.official_option_ids.findIndex(id=>String(id)===String(a.final_key_option_id))!=='ABCD'.indexOf(a.correct_answer))throw new Error('official_option_id_key_mapping_required');
    } else if(!['DROP','MULTIPLE'].includes(keyTokens[1]) && !/^\d+(,\s*\d+)+$/.test(keyTokens[1]))throw new Error('excluded_key_status_required');
    if(!a.source_refs?.length || a.source_refs.some(ref=>!sources[ref.id] || sources[ref.id].kind==='final_key' || sources[ref.id].version!==ref.version || sources[ref.id].supports[ref.locator]!==ref.support_hash))throw new Error('anchor_reference_support_required');
    return {...a,year:paper.year,subject:pack.subject,source_kind:'authentic_pyq',source_pack_id:pack.id,source_pack_version:pack.version};
  });
  if(new Set(examples.map(a=>a.id)).size!==examples.length || examples.some(a=>(previous.examples || []).some(old=>old.id===a.id && old.source_pack_id!==pack.id)))throw new Error('source_anchor_id_collision');
  const spec=pack.exam_spec;
  if(spec?.state!=='verified' || !spec.syllabus_version || !spec.pattern_version || !spec.exam_rule_version || !spec.included_topics?.length || !Array.isArray(spec.excluded_topics) || !spec.pattern_rules?.length ||
      !spec.source_refs?.length || spec.source_refs.some(r=>!sources[r.id]?.facts?.[r.locator])) throw new Error('source_backed_exam_spec_required');
  const usable=examples.filter(e=>!e.dropped && /^[ABCD]$/.test(e.correct_answer));
  const passageGroups={};
  for(const group of pack.passage_groups || []) {
    const members=examples.filter(a=>a.passage_group_id===group.id);
    if(!group.id || group.complete!==true || !Array.isArray(group.anchor_ids) || group.anchor_ids.length<2 || group.anchor_ids.length>10 ||
      members.length!==group.anchor_ids.length || members.some(a=>!group.anchor_ids.includes(a.id) || a.passage_text!==group.passage_text || !Number.isInteger(a.order_index)) ||
      new Set(members.map(a=>a.order_index)).size!==members.length || members.some(a=>a.dropped))throw new Error('complete_authenticated_passage_group_required');
    passageGroups[group.id]={...group,source_pack_id:pack.id,version:pack.version,state:'active'};
  }
  if(examples.some(a=>a.passage_group_id && !passageGroups[a.passage_group_id]))throw new Error('complete_authenticated_passage_group_required');
  const families=Object.fromEntries(usable.map(a=>[a.family_id || `pyq:${a.id}`,{state:'active',version:pack.version,anchor_id:a.id,source_pack_id:pack.id}]));
  const retire=collection=>Object.fromEntries(Object.entries(collection || {}).map(([id,value])=>[id,value.source_pack_id===pack.id?{...value,state:'retired'}:value]));
  for(const source of Object.values(sources))source.source_pack_id=pack.id;
  return {...previous,version:Number(previous.version)+1,sources:{...retire(previous.sources),...sources},families:{...retire(previous.families),...families},
    passage_groups:{...retire(previous.passage_groups),...passageGroups},
    examples:[...(previous.examples || []).filter(e=>e.source_pack_id!==pack.id),...examples],
    packs:{...previous.packs,[pack.id]:{id:pack.id,subject:pack.subject,version:pack.version,state:'active',registered_at:new Date().toISOString(),document_ids:Object.keys(sources)}},
    exam_specs:{...previous.exam_specs,[pack.subject]:spec}};
}
export function sourceReadiness(registry) {
  return FACTORY_SUBJECTS.map(subject=>{
    const spec=registry.exam_specs?.[subject];
    const anchors=(registry.examples || []).filter(e=>e.subject===subject && e.final_key_matched && !e.dropped && /^[ABCD]$/.test(e.correct_answer) && registry.packs?.[e.source_pack_id]?.state==='active');
    const packs=Object.values(registry.packs || {}).filter(p=>p.subject===subject && p.state==='active');
    const references=[...new Set(packs.flatMap(p=>p.document_ids||[]))].map(id=>registry.sources[id]).filter(s=>s?.kind==='reference'&&s.state==='active'&&s.reuse_permitted&&s.extraction_checked&&Object.values(s.facts||{}).some(f=>f.text?.trim()));
    const chapters=[...new Set(references.flatMap(s=>s.chapters||[]))];
    const reserved=new Set(registry.calibration_anchor_ids || []);
    const generation=anchors.filter(a=>a.generation_ready!==false && !reserved.has(a.id));
    return {subject,authenticated_anchors:anchors.length,active_packs:packs.length,chapters,missing_chapters:getCanonicalChapters(subject).filter(c=>!chapters.includes(c)),syllabus_version:spec?.syllabus_version || null,
      reference_documents:references.length,generation_anchors:generation.length,ready:spec?.state==='verified' && packs.length>0 && references.length>0,reason:!references.length?'authoritative_reference_excerpts_required':'',
      support_scope:'Available excerpts permit focused generation; each question still requires independent answer and explanation support.'};
  });
}
