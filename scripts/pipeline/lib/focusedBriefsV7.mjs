import {FACTORY_SUBJECTS,hashJSON} from '../../../data/question_factory_policy.mjs';
import {syllabusForChapter} from './factoryEvidence.mjs';
import {accountancyBranch} from './focusedCoverage.mjs';
const chapterName=s=>s==='Dissolution of Partnership'?'Dissolution of Partnership Firm':s;
// Authenticated CUET 2024 mix (137 non-passage plus passage items, four subjects), normalised to families, per 25 questions. The legacy planner cycled formats
// evenly, which over-produced long matching, sequence and case items and under-produced direct and one-step numerical items. Difficulty labels follow the
// PYQ proportion (about 30% easy, 68% medium, 2% hard) rounded to 25.
export const CUET_FORMAT_PLAN=Object.freeze({
 english:{reading_comprehension:5,sequence_ordering:5,matching:4,correct_word_usage:4,synonym:4,antonym:3},
 accountancy:{numerical_calculation:6,conceptual_mcq:5,statement_selection:4,case_application:4,matching:3,sequence_ordering:3},
 business_studies:{conceptual_mcq:13,matching:3,sequence_ordering:3,statement_selection:3,case_application:3},
 economics:{conceptual_mcq:10,case_application:4,numerical_calculation:3,matching:3,statement_selection:3,sequence_ordering:2}});
export const CUET_DIFFICULTY_PLAN=Object.freeze({easy:8,medium:16,hard:1});
// Expand a count map into a deterministic, interleaved list of exactly n entries (largest remainder when n differs from 25).
export function expandPlan(counts,n){const total=Object.values(counts).reduce((a,b)=>a+b,0),raw=Object.entries(counts).map(([k,v])=>({k,exact:v*n/total,take:Math.floor(v*n/total)}));
 let left=n-raw.reduce((a,r)=>a+r.take,0);for(const r of [...raw].sort((a,b)=>(b.exact-b.take)-(a.exact-a.take)||a.k.localeCompare(b.k)))if(left>0){r.take++;left--;}
 const out=[],queue=raw.map(r=>({...r}));while(out.length<n)for(const r of queue)if(r.take>0&&out.length<n){out.push(r.k);r.take--;}return out;}
export function focusedBriefsV7(coverage,registry,{campaignId,perSubject=25,branch='financial_analysis',formatPlan=CUET_FORMAT_PLAN,difficultyPlan=CUET_DIFFICULTY_PLAN}={}){
  if(!campaignId||!Number.isSafeInteger(perSubject)||perSubject<1||perSubject>25||!['financial_analysis','computerized'].includes(branch))throw Error('bounded_campaign_and_branch_required');
  const jobs=[];
  for(const subject of FACTORY_SUBJECTS){
    const cells=coverage.cells.filter(c=>c.subject===subject&&(subject!=='accountancy'||c.branch==='common'||c.branch===branch));
    const planned=new Map();
    for(let i=0;i<perSubject;i++){
      const format=expandPlan(formatPlan[subject],perSubject)[i],difficulty=expandPlan(difficultyPlan,perSubject)[i];
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
