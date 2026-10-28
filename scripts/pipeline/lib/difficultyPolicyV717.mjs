import { assessDifficultyV713 } from './difficultyPolicyV713.mjs';
export const DIFFICULTY_POLICY_V717 = 'cuet-observed-demand-v717';
// Demand examples are illustrative calibration, not authenticated PYQs and not item keys.
export const DEMAND_ANCHORS_V717 = Object.freeze({
 basis:'illustrative_heuristic; supplied authenticated comparators take precedence',
 easy:'Warm-up or basic understanding: recognise a familiar term, select its direct definition, or perform a plainly signposted single operation. Example: identify the management function that compares performance with a standard.',
 medium:'Normal central CUET demand, not necessarily difficult: interpret a short unfamiliar case or passage, discriminate plausible near-neighbour concepts, or apply a familiar rule to given values/conditions. Example: infer which management principle a fresh workplace scenario illustrates; compute an adjusted ratio from a short transaction; infer a passage implication. Routine one- or two-step work can be Medium.',
 hard:'Sustained above-normal CUET demand while staying within syllabus: integrate several relevant concepts or compound constraints with plausible alternatives. Example: track several stated accounting adjustments and distinguish their combined effects. Length, obscure facts, bad wording and tricks do not establish Hard.',
 assessment:'Describe the operation and concepts/conditions actually required, then compare to the supplied subject/format examples when available. Step count alone is not a band. Direct standard CUET recall may still be Easy; high craft does not raise demand.'
});
export const DIFFICULTY_SCHEMA_V717 = Object.freeze({type:'object',additionalProperties:false,
 required:['level','reason','comparison_basis','operation','concepts_conditions','exemplar_ids'],properties:{
 level:{type:'string',enum:['easy','medium','hard']},reason:{type:'string'},
 comparison_basis:{type:'string',enum:['authenticated_exemplar','heuristic']},
 operation:{type:'string'},concepts_conditions:{type:'array',minItems:1,items:{type:'string'}},
 exemplar_ids:{type:'array',items:{type:'string'}}
 }});
export function assessDifficultyV717(checks) {
 const result=assessDifficultyV713(checks);
 return {...result,version:DIFFICULTY_POLICY_V717};
}
