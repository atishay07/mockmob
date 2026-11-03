import {readFileSync, existsSync} from 'node:fs';
import {createHash} from 'node:crypto';
const base='artifacts/question-factory/cuet-readiness-2026-10-09/v77-qualification';
const read=p=>JSON.parse(readFileSync(p));
const digest=p=>createHash('sha256').update(readFileSync(p)).digest('hex');
const filter=process.argv.slice(2).filter(x=>!x.startsWith('--'));
const out=[];
for(const role of ['fresh','regression']){
 const dir=`${base}/v77-qualification-2026-10-09-final-${role}-integrated`;
 const path=dir+'/run/results.json';if(!existsSync(path))continue;
 const frozen=read(dir+'/frozen.json'),results=read(path),overlay=read(dir+'/scratch-registry-overlay.json');
 for(const row of results.topologies?.dual_blind||[]){
  if(row.state!=='quarantined'||row.expected_valid!==true||(filter.length&&!filter.includes(row.id)))continue;
  const fixture=frozen.fixtures.find(x=>x.id===row.id),c=fixture.candidate;
  const native=Object.fromEntries(Object.entries(results.evaluations?.[row.id]||{}).map(([provider,result])=>[provider,Object.fromEntries(['status','solved_key','source_support','single_defensible_answer','numeric_solution','blocking_defects','reasons','option_resolution','option_resolution_matrix','evidence_ids','supporting_spans','cuet_fit','cuet_fit_result'].filter(k=>k in result).map(k=>[k,result[k]]))]));
  out.push({role,id:row.id,expected_valid:fixture.expected_valid,subject:c.subject,body:c.body,passage:c.passage_text,options:c.options,proposed_key:c.correct_answer,oracle:fixture.oracle,explanation:c.explanation,terminal:{state:row.state,reasons:row.reasons,failed_stage:row.failed_stage,failure_details:row.failure_details},sources:c.source_refs.map(ref=>({ref,text:overlay.sources?.[ref.id]?.facts?.[ref.locator]?.text})),native,explanation_stage:row.checks?.explanation_support||null,bindings:{frozen_sha256:digest(dir+'/frozen.json'),results_snapshot_sha256:digest(path)}});
 }
}
const compact=process.argv.includes('--compact')?out.map(x=>({...x,sources:x.sources.filter(s=>!s.ref.id.includes('syllabus')),native:Object.fromEntries(Object.entries(x.native).map(([provider,r])=>[provider,{status:r.status,key:r.solved_key,source_support:r.source_support,blocking_defects:r.blocking_defects,gate:r.option_resolution,reasons:r.reasons,fit:r.cuet_fit_result,matrix_predicates:(r.option_resolution_matrix||[]).map(row=>({option:row.option,clauses:row.clauses.map(c=>{const cited=c.evidence_ids.map(id=>r.supporting_spans?.[r.evidence_ids?.indexOf(id)]?.quote||'').join('\n');return{basis:c.basis,status:c.status,premises:c.premises.map(p=>({text:p,body:x.body.includes(p),option:row.exact_option_text.includes(p),passage:(x.passage||'').includes(p),selected_quotes:cited.includes(p),context_echo:c.decisive_context.includes(p)}))};})}))}]))})):out;
console.log(JSON.stringify({at:new Date().toISOString(),scope:'Inspected terminal valid controls only; regression diagnosis, never fresh qualification',cases:compact},null,2));
