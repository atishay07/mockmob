// Read-only, zero-cost analysis of the retained 1,000-candidate campaign: which gate rejected what,
// how the two blind judges relate, and how much rejection was driven by craft rather than correctness.
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';import {dirname} from 'node:path';
const input=process.argv[2]||'artifacts/question-factory/continuation-500/all-candidates.json';
const out=process.argv[3]||'artifacts/question-factory/cuet-fit-2026-10-07/history-analysis.json';
const all=JSON.parse(readFileSync(input,'utf8'));
const rank=s=>({published:0,eligible:1}[s]??2);
const checksOf=c=>c.candidate?.evidence?.record?.checks||c.result?.checks||c.first_result?.checks||null;
const hard=r=>r&&r.single_defensible_answer===true&&r.missing_assumptions===false&&r.source_support===true&&r.exam_fit===true&&r.syllabus_entitlement===true&&r.question_type_match===true;
const rows=[];
for(const c of all){
  const checks=checksOf(c),luna=checks?.blind_solution||checks?.source_support,gem=checks?.independent_evaluation;
  const key=c.candidate?.correct_answer||c.result?.question?.correct_answer;
  rows.push({id:c.id,state:c.state,subject:c.subject,format:c.format,difficulty:c.difficulty,key,repaired:c.repair_count>0,reasons:c.result?.reasons||c.first_result?.reasons||[],
    failed_stage:c.result?.failed_stage||c.first_result?.failed_stage||null,checks:checks?Object.fromEntries(Object.entries(checks).map(([k,v])=>[k,{passed:v.passed}])):null,
    luna:luna&&{key:luna.solved_key,score:luna.item_quality_score,craft:luna.craft_scores,defects:luna.defects||[],notes:luna.quality_notes||[],hard:hard(luna),single:luna.single_defensible_answer,presentation:luna.presentation_ready,conds:(luna.answer_conditions||[]).filter(x=>x.status==='missing').length},
    gemini:gem&&{key:gem.solved_key,score:gem.item_quality_score,craft:gem.craft_scores,defects:gem.defects||[],notes:gem.quality_notes||[],hard:hard(gem),single:gem.single_defensible_answer,presentation:gem.presentation_ready,conds:(gem.answer_conditions||[]).filter(x=>x.status==='missing').length}});
}
const pub=rows.filter(r=>r.state==='published'),quar=rows.filter(r=>r.state==='quarantined');
const dist=(a,f)=>a.reduce((m,x)=>{const k=f(x);m[k]=(m[k]||0)+1;return m;},{});
const both=pub.filter(r=>r.luna&&r.gemini);
const summary={
  total:rows.length,states:dist(rows,r=>r.state),
  published_with_both_judges:both.length,
  published_luna_key_matches:both.filter(r=>r.luna.key===r.key).length,
  published_gemini_key_matches:both.filter(r=>r.gemini.key===r.key).length,
  published_judges_disagree_on_score_by_2plus:both.filter(r=>Math.abs((r.luna.score||0)-(r.gemini.score||0))>=2).length,
  published_score_distribution_luna:dist(both,r=>r.luna.score),published_score_distribution_gemini:dist(both,r=>r.gemini.score),
  published_with_any_defect_text:both.filter(r=>r.luna.defects.length||r.gemini.defects.length).length,
  quarantined_by_failed_stage:dist(quar,r=>r.failed_stage||'(none)'),
  quarantined_by_reason:quar.reduce((m,r)=>{for(const x of r.reasons)m[String(x).slice(0,70)]=(m[String(x).slice(0,70)]||0)+1;return m;},{}),
  quarantined_with_luna_record:quar.filter(r=>r.luna).length,quarantined_with_gemini_record:quar.filter(r=>r.gemini).length,
  quarantined_luna_key_mismatch:quar.filter(r=>r.luna&&r.luna.key!==r.key).length,
  quarantined_gemini_key_mismatch:quar.filter(r=>r.gemini&&r.gemini.key!==r.key).length,
  quarantined_gemini_only_blocked:quar.filter(r=>r.luna&&r.gemini&&r.luna.hard&&r.luna.key===r.key&&(!r.gemini.hard||r.gemini.key!==r.key)).length,
  quarantined_craft_only_candidates:quar.filter(r=>(r.luna&&r.luna.hard&&r.luna.key===r.key&&(!r.gemini||(r.gemini.hard&&r.gemini.key===r.key)))).length,
};
mkdirSync(dirname(out),{recursive:true});writeFileSync(out,JSON.stringify({summary,rows},null,1));
console.log(JSON.stringify(summary,null,1));
