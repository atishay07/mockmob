import {readFileSync,writeFileSync} from 'node:fs';
import {FACTORY_CRITERIA_V7} from '../../../../data/cuet_fit_evidence.mjs';
import {CRITERION_IDS} from '../../../../data/cuet_fit_rubric.mjs';
const base='artifacts/question-factory/cuet-readiness-2026-10-09/execution';
const data=JSON.parse(readFileSync(base+'/v77-final-export-2026-10-09/all-cases.json'));
const controls=data.all_cases.filter(x=>x.fixture.expected_valid&&['eligible','quarantined'].includes(x.validation?.state));
const mean=xs=>xs.length?xs.reduce((a,b)=>a+b,0)/xs.length:null;
const observations=controls.flatMap(x=>Object.entries(x.independent_native_solutions||{}).filter(([,r])=>r.status==='judged').map(([provider,r])=>({id:x.fixture.id,subject:x.fixture.candidate.subject,provider,solved_key:r.solved_key,key_matches_custody:r.solved_key===x.fixture.oracle?.key,source_support:r.source_support,syllabus_entitlement:r.syllabus_entitlement,single_answer:r.single_defensible_answer,gate:r.option_resolution,score:r.cuet_fit_result?.score,levels:r.cuet_fit_result?.levels,estimated_seconds:r.cuet_fit_result?.derived_solve_seconds,exemplar_ids:r.cuet_fit?.exemplar_ids_compared||[]})));
const nativeKeys=observations.filter(x=>x.key_matches_custody).length;
const minScores=controls.map(x=>Math.min(...Object.values(x.independent_native_solutions).map(r=>r.cuet_fit_result?.score))).filter(Number.isFinite);
const minLevels=Object.fromEntries(CRITERION_IDS.map(id=>[id,mean(controls.map(x=>Math.min(...Object.values(x.independent_native_solutions).map(r=>r.cuet_fit_result?.levels?.[id]))).filter(Number.isFinite))]));
const criterionNotes={
 syllabus_entitlement:'Both native judges marked entitlement true for each of five terminal controls, but the later mandatory syllabus stage was not reached. 2026 baseline is provisional for2027.',
 source_support:'All five terminal controls failed the required source/matrix gate. Correct source-only keys and valid cited spans do not establish whole-option support.',
 independently_solved_key:'10/10 blind native solutions match frozen custody across five controls; full pipeline eligibility is zero.',
 one_correct_answer:'Both blind judges marked single-answer true, but decisive whole-option audits were not reached; source caveats remain.',
 option_non_overlap:'Full four-option clause matrices were supplied but did not pass binding; no mandatory pass claim.',
 decisive_assumptions:'Case givens and source conventions were recorded. Old-machine asset status and illustrative maturity criteria remain diagnosis caveats.',
 numerical_accuracy:'No terminal numerical-route item was evaluated. Cash-equivalent comparison exposes printed-option premise binding; no numeric accuracy percentage established.',
 boundary_cases:'Applicable numerical boundary stage not demonstrated.',
 explanation_correctness:'Native explanation stage not executed after source_support failure. Construction custody is separate evidence.',
 explanation_support:'Native explanation/source and clause audit not executed; not passed.',
 passage_answerability:'No terminal passage item evaluated; unknown.',
 completeness:'Five terminal controls passed free structure checks. Later completeness/academic gate not demonstrated.',
 cuet_format:'Pre-gate native format judgments are favorable on five conceptual MCQs across two subjects; no eligible-item score.',
 novelty:'Persistent allocation and historical inspection software checks passed; qualification controls are not a generated production pilot. No 10000-item uniqueness proof.',
 presentation:'Free presentation checks passed the16 fresh positives before evaluation. No later full validation pass.',
 source_provenance_integrity:'Source custody and85 reference hashes verified before evaluation. Mandatory source-support pipeline failed all five terminal controls.',
 syllabus_objective:'Descriptive native pre-gate lower-of-two levels only; not a mandatory pass.',
 format_authenticity:'Matched authenticated comparisons appear in native observations, with thin Accountancy format samples. Original practice is not labeled authentic PYQ.',
 level_calibration:'Terminal sample consists of easy direct conceptual controls; original-generated difficulty mix is unmeasured.',
 time_suitability:'Time is a heuristic, not observed student timing.',
 discrimination_value:'Some conceptual distractors are broad or readily eliminated. No observed student discrimination measurement.'
};
const output={at:new Date().toISOString(),version:'Frozen V77 final attempt, plus isolated unqualified regression correction',registered_cases:41,terminal_controls:controls.length,subjects_terminal:[...new Set(controls.map(x=>x.fixture.candidate.subject))],eligible_valid:0,pilot_executed:false,published:0,native_keys_matching_custody:{matching:nativeKeys,observations:observations.length},descriptive_pre_gate_only:{lower_of_two_fit_mean:mean(minScores),lower_of_two_level_means:minLevels,eligible_item_quality_score:null,warning:'These5controls all failed mandatory gates. This mean must never be reported as publishable quality.'},parameters:[...FACTORY_CRITERIA_V7,...CRITERION_IDS.map(id=>({id,kind:'cuet_fit'}))].map(x=>({...x,note:criterionNotes[x.id],current_publication_quality:'unestablished'})),cost:{study_settled_usd:data.settled_usd,study_held_usd:data.held_usd,publishable_questions_10000_forecast_usd:null,reason:'No qualified current profile or measured generated-pilot publishable yield.',conservative_validation_usd_per_candidate:0.169375,conservative_validation_usd_per_10000_candidates:1693.75,assumed_70_percent_survival_validation_usd_per_10000_survivors:1693.75/0.70,envelope_exclusions:['authoring','source research','targeted repair','full revalidation','publication'],pilot_cap_usd:3,pilot_40_candidate_full_repair_bound_usd:15.48},observations};
if(process.argv[2])writeFileSync(process.argv[2],JSON.stringify(output,null,2)+'\n',{flag:'wx'});
console.log(JSON.stringify({parameters:output.parameters.length,native_keys:output.native_keys_matching_custody,pre_gate_only:output.descriptive_pre_gate_only,cost:output.cost},null,2));
