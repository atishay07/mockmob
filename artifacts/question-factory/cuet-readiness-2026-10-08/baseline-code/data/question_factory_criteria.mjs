// Scores are craft judgments; mandatory evidence failures always reject.
export const FACTORY_CRITERIA=Object.freeze([
 ['syllabus_entitlement','mandatory'],['source_support','mandatory'],['independently_solved_key','mandatory'],
 ['one_correct_answer','mandatory'],['option_non_overlap','mandatory'],['decisive_assumptions','mandatory'],
 ['numerical_accuracy','mandatory'],['boundary_cases','mandatory'],['explanation_correctness','mandatory'],
 ['explanation_support','mandatory'],['passage_answerability','mandatory'],['completeness','mandatory'],
 ['cuet_format','mandatory'],['language_clarity','craft'],['distractor_plausibility','craft'],
 ['difficulty_suitability','craft'],['novelty','mandatory'],['presentation','mandatory'],['source_provenance_integrity','mandatory']
].map(([id,kind])=>Object.freeze({id,kind})));
export function criteriaResults(checks,question){
 const b=checks.blind_solution,i=checks.independent_evaluation,e=checks.explanation_support;
 const both=field=>b?.[field]===true&&i?.[field]===true;
 const fields={syllabus_entitlement:both('syllabus_entitlement'),source_support:both('source_support'),
 independently_solved_key:b?.solved_key===question.correct_answer&&i?.solved_key===question.correct_answer,
 one_correct_answer:both('single_defensible_answer'),option_non_overlap:both('single_defensible_answer'),
 decisive_assumptions:b?.missing_assumptions===false&&i?.missing_assumptions===false&&b?.answer_conditions?.every(c=>['explicit','convention'].includes(c.status))&&i?.answer_conditions?.every(c=>['explicit','convention'].includes(c.status)),
 numerical_accuracy:checks.numeric_solution?.passed===true,boundary_cases:checks.llm_boundary_cases?.passed===true,
 explanation_correctness:e?.passed===true,explanation_support:e?.passed===true,passage_answerability:both('passage_answerability'),
 completeness:checks.schema?.passed===true&&both('single_defensible_answer')&&b?.missing_assumptions===false&&i?.missing_assumptions===false,
 cuet_format:both('exam_fit')&&both('question_type_match'),novelty:both('meaningfully_distinct')&&checks.dedupe?.passed===true,
 presentation:both('presentation_ready'),source_provenance_integrity:checks.source_support?.passed===true};
 return FACTORY_CRITERIA.map(c=>({...c,...(c.kind==='craft'?{score:Math.min(b?.craft_scores?.[c.id]||0,i?.craft_scores?.[c.id]||0),basis:'Lower of the two independent craft judgments; score does not prove accuracy'}:
 {passed:fields[c.id]===true,applicable:!(['numerical_accuracy','boundary_cases'].includes(c.id)&&!checks.numeric_solution)&&!(c.id==='passage_answerability'&&question.route!=='passage')})}));
}
