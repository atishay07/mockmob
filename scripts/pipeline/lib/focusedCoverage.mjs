import scope from '../../../data/question_factory_scope.json' with {type:'json'};
import {FACTORY_SUBJECTS,inventoryFingerprint,hashJSON} from '../../../data/question_factory_policy.mjs';
import {canonicalQuestion} from '../../../data/content_evidence.js';
import {publicationEligibility} from '../../../data/evidence_registry.js';
import {legacyPracticeVisible} from '../../../data/practice_availability.js';
import {verifyAnswerIntegrity} from '../../../data/answer_integrity.js';
import {sourceMaterial,syllabusForChapter} from './factoryEvidence.mjs';

export const COVERAGE_CONTRACT='syllabus-usable-inventory-v1';
export const FORMATS=['conceptual_mcq','numerical_calculation','matching','statement_selection','sequence_ordering','case_application'];
export const DIFFICULTIES=['easy','medium','hard'];
const normalized=s=>String(s||'').normalize('NFKC').toLowerCase().replace(/[^a-z0-9]+/g,' ').trim();
const chapterName=s=>s==='Dissolution of Partnership'?'Dissolution of Partnership Firm':s;
export function accountancyBranch(chapter){return chapter==='Computerized Accounting System'?'computerized':
  ['Financial Statements of Company','Analysis of Financial Statements','Comparative & Common Size Statements','Accounting Ratios','Cash Flow Statement'].includes(chapter)?'financial_analysis':'common';}

// The old analyzer's useful rule is retained: initialize EVERY syllabus group,
// then count actual usable rows. No raw table count, draft, or duplicate fills a gap.
export function coverageSnapshot(rows,{heldFamilies=[],eligible=publicationEligibility,inventoryAt=new Date().toISOString()}={}){
  const held=new Set(heldFamilies),seen=new Set(),excluded={},cells=[];
  for(const subject of FACTORY_SUBJECTS)for(const chapter of scope.subjects[subject].chapters)
    cells.push({subject,chapter,topic:chapter,branch:subject==='accountancy'?accountancyBranch(chapter):null,usable:0,formats:{},difficulties:{},ideas:[]});
  const reject=reason=>excluded[reason]=(excluded[reason]||0)+1;
  for(const row of rows){
    const q=canonicalQuestion(row),chapter=chapterName(q.chapter),cell=cells.find(c=>c.subject===q.subject&&c.chapter===chapter);
    if(!cell){reject('outside_current_syllabus');continue;}
    if(held.has(row.family_id||row.template_id)||row.verification_state==='disputed'){reject('disputed_or_family_held');continue;}
    if(!q.body.trim()||Number(row.score||0)<-2||!verifyAnswerIntegrity(row).accepted||!(eligible(row).eligible||legacyPracticeVisible(row))){reject('not_usable');continue;}
    const fingerprint=inventoryFingerprint(row);if(seen.has(fingerprint)){reject('duplicate');continue;}seen.add(fingerprint);
    cell.usable++;const format=row.question_type||'unclassified',difficulty=row.difficulty||'unclassified';
    cell.formats[format]=(cell.formats[format]||0)+1;cell.difficulties[difficulty]=(cell.difficulties[difficulty]||0)+1;
    cell.ideas.push({id:row.id,body:q.body,concept_id:row.concept_id||null,fingerprint});
  }
  return {contract:COVERAGE_CONTRACT,baseline:scope.baseline,final_2027_rules_verified:false,inventory_at:inventoryAt,
    inventory_hash:hashJSON(rows.map(r=>({id:r.id,fingerprint:inventoryFingerprint(r),status:r.status,evidence:r.evidence?.signature,screening:r.legacy_screening,disputed:r.verification_state==='disputed'}))),
    total_usable:seen.size,excluded,cells};
}

// Ranking selects retrieval candidates only. Neither keyword overlap nor a
// downloaded PDF is treated as answer support; the blind gates decide entailment.
export function focusedExcerpts(registry,{subject,chapter,topic=chapter,needs=[]},ledger){
  const sources=Object.values(registry.sources||{}).filter(s=>s.state==='active'&&s.kind==='reference'&&s.reuse_permitted&&s.extraction_checked&&s.chapters?.some(c=>chapterName(c)===chapter));
  const key=hashJSON({contract:'focused-excerpts-v1',subject,chapter,topic,needs,sources:sources.map(s=>({id:s.id,version:s.version,sha:s.identity_sha256,supports:s.supports}))});
  const cached=ledger?.getCache(`research:${key}`);if(cached){sourceMaterial(registry,cached.refs);return cached;}
  const words=[...new Set(normalized([topic,...needs].join(' ')).split(' ').filter(w=>w.length>3))];
  const facts=sources.flatMap(s=>Object.entries(s.facts).map(([locator,f])=>({id:s.id,version:s.version,locator,support_hash:s.supports[locator],text:f.text,score:words.filter(w=>normalized(f.text).includes(w)).length})));
  facts.sort((a,b)=>b.score-a.score||a.id.localeCompare(b.id)||a.locator.localeCompare(b.locator));
  // Keep two complete, decisive-size spans and at most 6,500 source characters.
  const selected=[];let length=0;
  for(const f of facts){if(selected.length>=2)break;if(!f.text?.trim()||f.text.length>6500||length+f.text.length>6500)continue;selected.push(f);length+=f.text.length;}
  const refs=selected.map(({id,version,locator,support_hash})=>({id,version,locator,support_hash}));
  const result={key,refs,excerpts:sourceMaterial(registry,refs),state:refs.length?'retrieved_pending_entailment':'source_missing',cost_usd:0};
  ledger?.setCache(`research:${key}`,result);return result;
}

export function focusedBriefs(coverage,registry,{campaignId,perSubject=25,branch='financial_analysis'}={}){
  if(!campaignId||!Number.isSafeInteger(perSubject)||perSubject<1||perSubject>25||!['financial_analysis','computerized'].includes(branch))throw Error('bounded_campaign_and_branch_required');
  const jobs=[];
  for(const subject of FACTORY_SUBJECTS){
    const cells=coverage.cells.filter(c=>c.subject===subject&&(subject!=='accountancy'||c.branch==='common'||c.branch===branch));
    const planned=new Map();
    for(let i=0;i<perSubject;i++){
      const english=['reading_comprehension','synonym','sequence_ordering','matching','correct_word_usage','antonym'];
      const formats=subject==='english'?english:subject==='business_studies'?['conceptual_mcq','case_application','statement_selection','matching','sequence_ordering']:FORMATS;
      const format=formats[i%formats.length],difficulty=i%6===5?'hard':i%3===0?'easy':'medium';
      const requiredEnglish=format==='reading_comprehension'?['Factual Passage','Narrative Passage','Literary Passage']:format==='sequence_ordering'?['Para Jumbles']:format==='matching'?['Match the Following']:format==='correct_word_usage'?['Correct Word Usage']:['Vocabulary'];
      const pool=cells.filter(c=>(subject!=='english'||requiredEnglish.includes(c.chapter))&&Object.values(registry.sources||{}).some(s=>s.state==='active'&&s.kind==='reference'&&s.reuse_permitted&&s.chapters?.some(ch=>chapterName(ch)===c.chapter)));
      pool.sort((a,b)=>(a.usable+(planned.get(a.chapter)||0))-(b.usable+(planned.get(b.chapter)||0))||
        (a.formats[format]||0)-(b.formats[format]||0)||(a.difficulties[difficulty]||0)-(b.difficulties[difficulty]||0)||a.chapter.localeCompare(b.chapter));
      const cell=pool[0];if(!cell)throw Error('syllabus_gap_pool_empty');
      planned.set(cell.chapter,(planned.get(cell.chapter)||0)+1);
      const spec=registry.exam_specs[subject],syllabus=syllabusForChapter(spec,subject,cell.chapter);
      const topics=(syllabus.relevant_units||[syllabus.text]).join(' ').split(/[•]/).map(s=>s.replace(/PAGE \d+/g,'').replace(/\s+/g,' ').trim()).filter(s=>s.length>20&&s.length<400);
      const topic=topics.length?topics[i%topics.length]:cell.chapter;
      const id=hashJSON({campaignId,subject,i}).slice(0,32),sourcePack=Object.values(registry.packs).find(p=>p.subject===subject&&p.state==='active');
      if(!sourcePack)throw Error('active_reference_pack_required');
      jobs.push({id,number:jobs.length+1,subject,chapter:cell.chapter,topic,kind:'original_practice',format,difficulty,branch:cell.branch,
        family_id:`original:${id}`,source_pack_id:sourcePack.id,source_pack_version:sourcePack.version,variant_index:i,
        requested_answer_position:'ABCD'[i%4],coverage_before:{usable:cell.usable,format:cell.formats[format]||0,difficulty:cell.difficulties[difficulty]||0},
        avoidance:cell.ideas.slice(0,12).map(q=>q.body),state:'queued',repair_count:0});
    }
  }
  return jobs;
}
