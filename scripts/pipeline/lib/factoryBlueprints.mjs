import { hashJSON } from '../../../data/question_factory_policy.mjs';
import { getCanonicalChapters } from '../../../data/canonical_syllabus.js';
import { sourceMaterial, lunaBody, FACTORY_VERIFIER_VERSION, syllabusForChapter } from './factoryEvidence.mjs';
import { completeJSON } from './factoryTransport.mjs';
import { QUESTION_TYPES, quotesInReferences, SETTER_RULES } from './factoryCore.mjs';

export const BLUEPRINT_CONTRACT='excerpt-grounded-blueprints-v2';
const FORMATS=['direct_mcq','case_mcq','match_list','statement_selection','sequence','assertion_reason','numerical'];

// One guarded Luna request plans distinct, excerpt-grounded items for an anchor.
// Blueprints whose quotes are not verbatim in the excerpts are discarded locally.
export function blueprintSkillKey(subject,b) {
  const norm=t=>String(t||'').normalize('NFKC').toLowerCase().replace(/[^a-z0-9+*/=<>%−-]+/g,' ').trim();
  return hashJSON({subject,chapter:norm(b.chapter),skill:norm(b.assessment_skill || b.target),task:b.reasoning_task || b.question_type});
}

export async function planAnchorBlueprints(anchor,count,{registry,transport,avoid=[]}) {
  const references=sourceMaterial(registry,anchor.source_refs||[]).filter(r=>r.kind!=='paper');
  if(!references.length)throw new Error('blueprint_reference_excerpt_required');
  const spec=registry.exam_specs?.[anchor.subject];
  const input={subject:anchor.subject,anchor:{chapter:anchor.chapter,question_type:anchor.question_type,body:anchor.body,options:anchor.options,correct_answer:anchor.correct_answer},
    references:references.map(r=>({id:r.id,locator:r.locator,text:r.text})),count,avoid,academic_guidance:anchor.academic_guidance||null,
    canonical_chapters:getCanonicalChapters(anchor.subject),syllabus:syllabusForChapter(spec,anchor.subject,anchor.chapter)};
  const schema={type:'object',additionalProperties:false,required:['blueprints'],properties:{blueprints:{type:'array',maxItems:count,items:{type:'object',additionalProperties:false,
    required:['assessment_skill','reasoning_task','target','format','question_type','chapter','difficulty','evidence_quotes','answer_basis','distractor_plan','required_assumptions','numeric_plan'],properties:{
      assessment_skill:{type:'string'},reasoning_task:{type:'string',enum:['identify','classify','apply','calculate','infer','order','compare']},target:{type:'string'},format:{type:'string',enum:FORMATS},question_type:{type:'string',enum:QUESTION_TYPES},chapter:{type:'string',enum:getCanonicalChapters(anchor.subject)},
      difficulty:{type:'string',enum:['easy','medium','hard']},evidence_quotes:{type:'array',items:{type:'string'},minItems:1,maxItems:3},answer_basis:{type:'string'},
      distractor_plan:{type:'array',items:{type:'string'},minItems:3,maxItems:3},required_assumptions:{type:'array',items:{type:'string'}},numeric_plan:{type:'string'}}}}}};
  const prompt=`${SETTER_RULES}
Task: plan up to ${count} item blueprints for new CUET practice questions modelled on the authenticated anchor's format and depth. assessment_skill is a short canonical name of the tested relationship or principle, shared across anchors and formats (for example "ex ante aggregate demand equals consumption plus investment"); reasoning_task distinguishes identification from calculation or application. Never rename a skill to evade avoid. Each blueprint must test a different idea (fact, classification, relationship, calculation or application) that the reference excerpts state explicitly, and must differ from the anchor itself and from every entry in avoid. Spread the blueprints across the CUET formats that suit this subject (direct and case MCQs, match List-I/List-II, statement selection, sequence, assertion-reason, numerical) and across easy/medium/hard, while keeping each one exam-realistic. evidence_quotes must be copied character-for-character from the excerpts (25-400 characters each) and must by themselves establish the answer. distractor_plan names three specific misconceptions that the excerpts show to be wrong. required_assumptions lists every condition the stem must state. numeric_plan gives clean values and the full calculation for numerical items, otherwise an empty string. Propose fewer blueprints rather than any that need facts outside the excerpts, that rely on the anchor's original wording, or that could have two defensible answers.`;
  const key=hashJSON({input,contract:BLUEPRINT_CONTRACT,version:FACTORY_VERIFIER_VERSION});
  const result=await completeJSON(transport,'openai',lunaBody(prompt,input,'high',12000,schema),{stage:'blueprint',key});
  const accepted=[],rejected=[];
  for(const b of result.blueprints||[]){
    const quotes=quotesInReferences(b.evidence_quotes,references);
    if(!quotes.length || !b.assessment_skill?.trim() || !b.reasoning_task || !getCanonicalChapters(anchor.subject).includes(b.chapter))rejected.push({target:b.target,reason:!quotes.length?'quote_not_verbatim':'skill_or_chapter'});
    else accepted.push({...b,evidence_quotes:quotes,anchor_id:anchor.id,skill_key:blueprintSkillKey(anchor.subject,b),blueprint_id:hashJSON({anchor:anchor.id,target:b.target,format:b.format}).slice(0,16)});
  }
  return {accepted,rejected,key};
}
