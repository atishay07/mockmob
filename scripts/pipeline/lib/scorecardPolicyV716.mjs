// Owner's 10 Oct report-and-route policy. Truth, quality and difficulty are separate.
import { canonicalQuestion, contentHash } from '../../../data/content_evidence.js';
import { readingTaskV712, illustrationTaskV712 } from './questionScopeV712.mjs';
import { assessDifficultyV713 } from './difficultyPolicyV713.mjs';
export const SCORECARD_POLICY_V716 = 'cuet-scorecard-routing-v716';
export const QUALITY_DIMENSIONS_V716 = Object.freeze({
 '1':'overall_cuet_readiness','2':'syllabus_entitlement','3':'learning_objective','4':'cuet_format_style','5':'difficulty_calibration',
 '6':'time_reading_suitability','7':'answer_accuracy','8':'unique_answer','9':'option_separation','10':'decisive_assumptions',
 '11':'numerical_accuracy_method','12':'boundary_cases','13':'explanation_correctness','14':'explanation_source_support',
 '15':'passage_answerability','16':'completeness','17':'language_clarity','18':'distractor_plausibility','19':'semantic_novelty','20':'source_fidelity'
});
// Global novelty is an inventory/publication check, not a guess by an item-only reviewer.
export const CRAFT_IDS_V716 = Object.freeze(['3','4','6','17','18']);
export const BLIND_SCORE_IDS_V716 = Object.freeze(Object.keys(QUALITY_DIMENSIONS_V716).filter(id => !['7','13','14'].includes(id)));
export const ACADEMIC_IDS_V716 = Object.freeze(['syllabus_entitlement','source_support','decisive_assumptions','numerical_accuracy','boundary_cases','passage_answerability','completeness','format_valid','presentation_readable']);
// Reviewers name a finding category; local policy, not the reviewer, decides which categories block.
export const ISSUE_CATEGORIES_V716 = Object.freeze(['wrong_key','multiple_defensible_answers','unresolved_rival','missing_decisive_input','false_or_unsupported_fact',
 'numerical_error','off_syllabus','passage_not_answerable','ambiguous_wording','explanation_error','format_defect','presentation_suggestion','craft_suggestion']);
export const ADVISORY_ISSUE_CATEGORIES_V716 = Object.freeze(['presentation_suggestion','craft_suggestion']);
const blockingIssues = list => list.filter(issue => !ADVISORY_ISSUE_CATEGORIES_V716.includes(issue.category));
const keys = ['A','B','C','D'];
const average = values => values.reduce((sum, value) => sum + value, 0) / values.length;
const scoreValid = value => value && (value.score === null || Number.isFinite(value.score) && value.score >= 1 && value.score <= 10) && typeof value.note === 'string' && value.note.trim();
const nonempty = value => typeof value === 'string' && value.trim().length > 0;
const stringList = value => Array.isArray(value) && value.every(item => typeof item === 'string');
const issueValid = issue => issue && ISSUE_CATEGORIES_V716.includes(issue.category) && nonempty(issue.detail);
// A broken response is incomplete review evidence, not an academic rejection.
export function scorecardFormatIssuesV716(candidate,reports,audit,{blindOnly=false}={}) {
 const reasons=[],id=candidate.id || candidate.candidate_id || candidate.local_id,hash=contentHash(candidate);
 if (!Array.isArray(reports) || reports.length!==2) return ['two_independent_blind_reports_required'];
 for (const [i,r] of reports.entries()) {
  const role=i?'independent_evaluation':'blind_solution';
  if (!r || r.provider!==(i?'gemini':'openai') || r.stage!==role || r.model!==(i?'gemini-3.8-flash':'gpt-6-luna') || r.candidate_id!==id || r.content_hash!==hash) {reasons.push('report_binding_invalid:'+role);continue;}
  if (![...keys,'uncertain'].includes(r.solved_key) || !stringList(r.answer_set) || r.answer_set.some(key=>!keys.includes(key)) || !nonempty(r.derivation) || !stringList(r.source_ids)) reasons.push('solution_format_invalid:'+role);
  if (!Array.isArray(r.options) || r.options.length!==4 || !keys.every(key=>r.options.filter(row=>row?.option===key).length===1) || r.options.some(row=>!row || !['defensible','not_answer','unresolved'].includes(row.status) || !['stem','excerpt','calculation','passage_scope','case_scope','unknown'].includes(row.basis) || !nonempty(row.reason) || !stringList(row.source_ids))) reasons.push('option_format_invalid:'+role);
  if (ACADEMIC_IDS_V716.some(name=>!['supported','issue','uncertain','not_applicable'].includes(r.academic?.[name]))) reasons.push('academic_report_format_invalid:'+role);
  if (BLIND_SCORE_IDS_V716.some(criterion=>!scoreValid(r.scores?.[criterion]))) reasons.push('score_format_invalid:'+role);
  if (!Array.isArray(r.issues) || r.issues.some(issue=>!issueValid(issue))) reasons.push('issue_format_invalid:'+role);
  const d=r.difficulty_assessment;
  if (!d || !['easy','medium','hard'].includes(d.level) || !nonempty(d.reason) || !['heuristic','authenticated_exemplar'].includes(d.comparison_basis)) reasons.push('difficulty_report_format_invalid:'+role);
 }
 if (!blindOnly) {
  if (!audit || audit.provider!=='openai' || audit.stage!=='explanation_support' || audit.model!=='gpt-6-luna' || audit.candidate_id!==id || audit.content_hash!==hash) reasons.push('audit_binding_invalid');
  else {
   if (!stringList(audit.answer_set) || audit.answer_set.some(key=>!keys.includes(key)) || !stringList(audit.source_ids) || !['supported','issue','uncertain'].includes(audit.explanation_status) || !['supported','issue','uncertain'].includes(audit.options_status)) reasons.push('audit_format_invalid');
   if (!Array.isArray(audit.claims) || !audit.claims.length || audit.claims.some(c=>!c || !nonempty(c.claim) || !nonempty(c.reason) || !stringList(c.source_ids) || !['stem','excerpt','calculation','passage'].includes(c.basis) || !['supported','unsupported','incorrect','uncertain'].includes(c.status))) reasons.push('claim_format_invalid');
   if (['13','14','17','20'].some(criterion=>!scoreValid(audit.scores?.[criterion]))) reasons.push('audit_score_format_invalid');
   if (!Array.isArray(audit.issues) || audit.issues.some(issue=>!issueValid(issue))) reasons.push('audit_issue_format_invalid');
  }
 }
 return [...new Set(reasons)];
}
export function blindKeyDefectsV716(candidate,reports) {
 if(scorecardFormatIssuesV716(candidate,reports,null,{blindOnly:true}).length)return [];
 const key=canonicalQuestion(candidate).key,reasons=[];
 for(const report of reports){
  if(report.solved_key!==key)reasons.push('independent_key_mismatch:'+report.stage);
  if(report.answer_set.length!==1 || report.answer_set[0]!==report.solved_key)reasons.push('not_one_defensible_answer:'+report.stage);
  for(const row of report.options)if(row.status!==(row.option===report.solved_key?'defensible':'not_answer'))reasons.push('unresolved_or_defensible_rival:'+report.stage+':'+row.option);
 }
 return [...new Set(reasons)];
}
export function deriveScorecardV716(candidate, reports, audit, { evidenceCatalog = [], localChecks = {} } = {}) {
 const q = canonicalQuestion(candidate), id = candidate.id || candidate.candidate_id || candidate.local_id, hash = contentHash(candidate), reasons = [];
 const fail = reason => reasons.push(reason);
 const blindFormat=scorecardFormatIssuesV716(candidate,reports,null,{blindOnly:true});
 if(blindFormat.length)return {state:'error',outcome:'review_incomplete',academic_sound:null,quality_score:null,policy:SCORECARD_POLICY_V716,reasons:blindFormat};
 const keyDefects=blindKeyDefectsV716(candidate,reports);
 if(keyDefects.length)return {state:'quarantined',outcome:'academic_quarantine',academic_sound:false,quality_score:null,policy:SCORECARD_POLICY_V716,reasons:keyDefects,explanation_review:audit?'performed':'not_performed_key_gate_failed'};
 const formatIssues=scorecardFormatIssuesV716(candidate,reports,audit);
 if (formatIssues.length) return {state:'error',outcome:'review_incomplete',academic_sound:null,quality_score:null,policy:SCORECARD_POLICY_V716,reasons:formatIssues};
 const ids = new Set(evidenceCatalog.map(e => e.id));
 const boundIds = values => Array.isArray(values) && values.every(value => ids.has(value));
 for (const [index, report] of reports.entries()) {
  const role = index ? 'independent_evaluation' : 'blind_solution';
  if (report?.candidate_id !== id || report.content_hash !== hash || report.stage !== role) fail('unbound_report:' + role);
  if (report.model !== (index ? 'gemini-3.8-flash' : 'gpt-6-luna')) fail('wrong_reviewer_model:' + role);
  if (!keys.includes(report.solved_key) || report.solved_key !== q.key) fail('independent_key_mismatch:' + role);
  if (!Array.isArray(report.answer_set) || report.answer_set.length !== 1 || report.answer_set[0] !== report.solved_key) fail('not_one_defensible_answer:' + role);
  if (!Array.isArray(report.options) || report.options.length !== 4 || !keys.every(key => report.options.filter(row => row.option === key).length === 1)) fail('all_four_options_required:' + role);
  else for (const row of report.options) {
   if (!['defensible','not_answer','unresolved'].includes(row.status) || !row.reason?.trim() || !boundIds(row.source_ids) ||
       !['stem','excerpt','calculation','passage_scope','case_scope','unknown'].includes(row.basis)) fail('option_report_invalid:' + role + ':' + row.option);
   if (row.status !== (row.option === report.solved_key ? 'defensible' : 'not_answer')) fail('unresolved_or_defensible_rival:' + role + ':' + row.option);
   if (row.basis === 'passage_scope' && !readingTaskV712({body:q.body,passage:q.passage,subject:q.subject,question_type:candidate.question_type}) || row.basis === 'case_scope' && !illustrationTaskV712({body:q.body,passage:q.passage,subject:q.subject,question_type:candidate.question_type})) fail('option_scope_invalid:' + role + ':' + row.option);
   if (row.basis === 'unknown' || row.basis === 'excerpt' && row.source_ids.length === 0) fail('option_source_unresolved:' + role + ':' + row.option);
  }
  if (!report.derivation?.trim() || !boundIds(report.source_ids) || report.source_ids.length === 0) fail('source_derivation_required:' + role);
  for (const name of ACADEMIC_IDS_V716) {
   const value = report.academic?.[name];
   // Assumptions and boundaries may genuinely not arise; numeric accuracy is mandatory only for numeric items, passage answerability only for passages.
   const na = ['decisive_assumptions','boundary_cases'].includes(name) || name === 'numerical_accuracy' && localChecks.numeric_required === false || name === 'passage_answerability' && candidate.route !== 'passage';
   if (value !== 'supported' && !(na && value === 'not_applicable')) fail('academic_issue:' + role + ':' + name + ':' + (value || 'missing'));
  }
  for (const criterion of BLIND_SCORE_IDS_V716) {
   const score = report.scores?.[criterion];
   // A null score is unscored feedback (e.g. novelty without calibration anchors), never an academic rejection.
   if (!scoreValid(score)) fail('score_missing_or_invalid:' + role + ':' + criterion);
  }
  for (const issue of blockingIssues(report.issues || [])) fail('reported_academic_issue:' + role + ':' + issue.category);
 }
 if (!audit || audit.provider !== 'openai' || audit.model !== 'gpt-6-luna' || audit.stage !== 'explanation_support' || audit.candidate_id !== id || audit.content_hash !== hash) fail('independent_explanation_audit_required');
 else {
  if (!Array.isArray(audit.answer_set) || audit.answer_set.length !== 1 || audit.answer_set[0] !== q.key) fail('audit_answer_set_not_unique');
  if (audit.explanation_status !== 'supported' || audit.options_status !== 'supported') fail('explanation_or_option_audit_failed');
  if (!Array.isArray(audit.claims) || audit.claims.length === 0 || audit.claims.some(claim => claim.status !== 'supported' || !claim.claim?.trim() || !claim.reason?.trim() || !boundIds(claim.source_ids) || !['stem','excerpt','calculation','passage'].includes(claim.basis) || claim.basis === 'excerpt' && claim.source_ids.length === 0)) fail('explanation_claim_unsupported');
  if (!boundIds(audit.source_ids) || audit.source_ids.length === 0) fail('explanation_sources_unbound');
  for (const issue of blockingIssues(audit.issues || [])) fail('reported_academic_issue:explanation_support:' + issue.category);
  for (const criterion of ['13','14','17','20']) if (!scoreValid(audit.scores?.[criterion])) fail('audit_score_missing:' + criterion);
 }
 const academic = reasons.length > 0;
 for (const name of ['structure','presentation','source_integrity','syllabus_registry','provenance']) if (localChecks[name] !== true) fail('local_check_failed:' + name);
 const integrity = reasons.length > 0;
 if (localChecks.novelty !== true) fail('local_check_failed:novelty');
 const difficulty = assessDifficultyV713({ blind_solution:reports[0], independent_evaluation:reports[1] });
 if (reasons.length) return { state:'quarantined', outcome:academic ? 'academic_quarantine' : integrity ? 'local_integrity_quarantine' : 'duplicate_idea', policy:SCORECARD_POLICY_V716,
  academic_sound:academic || integrity ? false : null, quality_score:null, reasons:[...new Set(reasons)], difficulty };
 // Difficulty is routing, not truth: an unconfirmed Hard is held from every band without calling the item false.
 // The confirmed band (not the author's target) is the band the item is routed to.
 if (!difficulty.passed) return { state:'quarantined', outcome:'routing_hold', policy:SCORECARD_POLICY_V716, academic_sound:true, quality_score:null, reasons:[difficulty.reason], difficulty };
 const criteria = Object.keys(QUALITY_DIMENSIONS_V716).map(criterion => {
  const values = criterion === '7' ? [10] : (['13','14'].includes(criterion) ? [audit.scores[criterion].score] :
   [...reports.map(report => report.scores[criterion].score), ...(['17','20'].includes(criterion) ? [audit.scores[criterion].score] : [])]).filter(value => value !== null);
  return { id:criterion, parameter:QUALITY_DIMENSIONS_V716[criterion], score:values.length ? average(values) : null, applicable:values.length > 0,
   notes:criterion === '7' ? ['Both hidden-key independent solutions match the author key.'] : ['13','14'].includes(criterion) ? [audit.scores[criterion].note] :
    [...reports.map(report => report.scores[criterion].note), ...(['17','20'].includes(criterion) ? [audit.scores[criterion].note] : [])] };
 });
 // The craft composite needs every craft parameter scored by at least one reviewer; otherwise the review is incomplete.
 const unscored = criteria.filter(row => CRAFT_IDS_V716.includes(row.id) && row.score === null).map(row => row.id);
 if (unscored.length) return { state:'error', outcome:'review_incomplete', policy:SCORECARD_POLICY_V716, academic_sound:null, quality_score:null, reasons:unscored.map(id => 'craft_score_unavailable:' + id), difficulty };
 const composite = average(criteria.filter(row => CRAFT_IDS_V716.includes(row.id)).map(row => row.score));
 // Do not round 6.999 into NTA eligibility; rounding is display-only.
 const quality_score = composite, practice = composite >= 6, nta = composite >= 7;
 return { state:practice ? 'eligible' : 'quarantined', policy:SCORECARD_POLICY_V716, academic_sound:true, quality_score,
  display_score:Math.round(composite * 100) / 100, criteria, reported_mean:average(criteria.filter(row => row.applicable).map(row => row.score)),
  composite_basis:CRAFT_IDS_V716, route_band:nta ? 'nta_eligible' : practice ? 'practice_only' : 'below_practice_quality',
  modes:{ practice, nta }, outcome:practice ? 'eligible' : 'below_practice_quality', reasons:practice ? [] : ['quality_below_practice_minimum_6'], difficulty,
  advisory_issues:[...reports.flatMap(report => report.issues.filter(issue => ADVISORY_ISSUE_CATEGORIES_V716.includes(issue.category)).map(issue => ({...issue,stage:report.stage}))),
   ...audit.issues.filter(issue => ADVISORY_ISSUE_CATEGORIES_V716.includes(issue.category)).map(issue => ({...issue,stage:audit.stage}))] };
}
