import { hashJSON } from '../../../data/question_factory_policy.mjs';
import { blindView } from './evidencePipeline.mjs';
import { createFactoryEvidenceV74, V74_PROMPT, TOPOLOGIES, requiredStagesV7 } from './factoryEvidenceV74.mjs';
import { FACTORY_VERIFIER_VERSION_V76, validationContractV76 } from './contractV76.mjs';
import { preparationValueV76, preparationReasonsV76 } from './preparationValueV76.mjs';
export { FACTORY_VERIFIER_VERSION_V76, TOPOLOGIES, requiredStagesV7 };

export const V76_OPTION_INSTRUCTIONS = `V7.6 whole-option semantic adjudication:
Assess ALL clauses of every printed option under the ACTUAL stem and supplied evidence, including the solved option. Preserve conjunctions, quantifiers, modality, timing, subject and scope. Distinguish an option with one true clause from a fully defensible answer: partial truth alone does not make a full conjunction correct. Conversely, do not dismiss a complete alternative merely because its wording is familiar under another textbook category or chapter. A category label is not a contradiction.
For each non-chosen option, record in strongest_reading the strongest honest reading of the full option, the decisive clause(s), and the exact stem or supplied evidence that supports or defeats them. Inspect relevant cross-category evidence before deciding. Reject an alternative as false only when its full assertion is contradicted or a decisive clause is false; source silence establishes neither truth nor falsity. An unsupported claimed rule is an evidence gap, not proof the option is false. If available evidence cannot resolve a plausible alternative, report uncertainty and fail the relevant source/uniqueness gate rather than fabricate a rejection. Do not silently assume a missing status to exclude it.
Set correct_under_reading true only when the FULL printed option is correct under that reasonable reading. A false or merely unsupported conjunct must not be promoted to truth from a supported companion clause. Exactly one defensible answer remains mandatory; uncertainty is quarantine, and agreement is never proof. All existing source, numerical, prerequisite, syllabus and presentation gates remain in force.`;

export const V76_FIT_INSTRUCTIONS = `V7.6 contextual preparation value:
The key-free learning_objective names ONE official-syllabus objective. Judge the knowledge or skill actually needed, its current syllabus entitlement, authentic format and PYQ-calibrated demand. A stated objective alone does not prove relevance. Easy valid recall or recognition at past-paper level is excellent.
Words such as only, all, never and always, sentence-linking phrases, repeated stem vocabulary, printed-order keys and supplied passage information are diagnostic cues, never sufficient alone to block or cap a rubric score. Assess their meaning and scope in context: a precise subject rule may legitimately use only; linking phrases can coexist with subject-dependent ordering; information supplied by a passage is legitimate comprehension. Judge whether the whole task genuinely requires the stated objective and whether each distractor represents a plausible misconception, rather than inferring poor value from a word's presence. Proven wording-only answer disclosure or absence of a syllabus skill merits a low syllabus_objective score, with a concrete explanation of what the student can bypass. Do not automatically force syllabus_objective or discrimination_value to 0/1 from lexical cues. Assess difficulty from actual demand, never cue counts or surface complexity; never penalise easy practice for lacking traps. Every mandatory academic gate is unchanged.`;

export const V76_EXPLANATION_INSTRUCTIONS = `V7.6 contextual explanation claims audit:
Check every factual claim, including negatives and claims rejecting distractors, for correctness and source support. Read each sentence in its local context before splitting its asserted clauses; resolve pronouns and scope honestly, and do not broaden a local statement into a universal claim. Context does not exempt a factual negative or unsupported added fact.
Logical deductions are legitimate when all premises are explicit in the stem or supplied excerpts; record the premises and inference in reasons and classify the claim by its actual supported basis (stem/excerpt, or arithmetic for calculation). A deduction is not a guessed case-specific input. Never use fundamental to smuggle in a decisive formula, accounting entry, debit/credit direction, external institutional classification, trade-account rule or missing asset/payment status absent from supplied evidence. Source silence is not evidence that an institution, option or rule is false. Do not fill an explanation or distractor rationale with unsupported facts.
Check ALL clauses and their conjunction, modality and quantifier scope. Preserve an overbroad claim as a failure when it asserts more than the premises establish; do not rescue it by deleting its last clause. If a transaction depends on fixed asset versus inventory, paid versus unpaid status, timing or a model condition, that decisive input must be printed. Keep all existing failure predicates: wrong, unsupported or assumption-adding claims block, even when the key survives.`;

// The v7.3 phrase about a partly true distractor is clarified to preserve full-option semantics;
// this changes instructions only, never the inherited deterministic uniqueness predicate.
const clarifyPartial = prompt => prompt.replace('a distractor that is true or partly true under the stem', 'a distractor whose full printed assertion is defensible under the stem (partial truth alone does not establish a full conjunction)');
export const V76_PROMPT = `${clarifyPartial(V74_PROMPT)}\n\n${V76_OPTION_INSTRUCTIONS}\n\n${V76_FIT_INSTRUCTIONS}`;
export const V76_PROMPT_HASH = hashJSON({ prompt: V76_PROMPT, explanation_instructions: V76_EXPLANATION_INSTRUCTIONS, contract: validationContractV76() });

export function blindViewV76(candidate, references) {
  const view = blindView(candidate, references), lo = candidate?.learning_objective;
  if (lo && typeof lo === 'object' && !Array.isArray(lo)) view.learning_objective = {
    syllabus_unit: String(lo.syllabus_unit ?? ''), objective: String(lo.objective ?? ''), target_term: String(lo.target_term ?? '') };
  return view;
}

export function adaptEvaluationRequestV76(provider, body, options = {}) {
  if (!['blind_solution', 'independent_evaluation', 'explanation_support'].includes(options.stage)) return body;
  const adapted = structuredClone(body);
  const instructions = options.stage === 'explanation_support' ? V76_EXPLANATION_INSTRUCTIONS : `${V76_OPTION_INSTRUCTIONS}\n\n${V76_FIT_INSTRUCTIONS}`;
  const change = value => `${clarifyPartial(value)}\n\n${instructions}`;
  if (provider === 'openai') {
    const system = adapted.input?.find(row => row.role === 'system');
    if (typeof system?.content !== 'string') throw new Error('v76_system_prompt_required');
    system.content = change(system.content);
  } else if (provider === 'gemini') {
    const system = adapted.systemInstruction?.parts?.[0];
    if (typeof system?.text !== 'string') throw new Error('v76_system_prompt_required');
    system.text = change(system.text);
  } else if (provider === 'anthropic') {
    if (typeof adapted.system !== 'string') throw new Error('v76_system_prompt_required');
    adapted.system = change(adapted.system);
  } else throw new Error('v76_provider_required');
  return adapted;
}

export function createFactoryEvidenceV76(config) {
  const { ledger, transport } = config, contract = validationContractV76();
  const stamp = result => ({ ...result, prompt_version: FACTORY_VERIFIER_VERSION_V76,
    evaluation_prompt: V76_PROMPT_HASH, validation_contract_hash: contract });
  const scopedLedger = { getCache: key => ledger.getCache(`v76:${contract}:${key}`),
    setCache: (key, value) => ledger.setCache(`v76:${contract}:${key}`, stamp(value)) };
  const currentTransport = { ...transport, generate(provider, body, options = {}) {
    const adapted = adaptEvaluationRequestV76(provider, body, options);
    const key = hashJSON({ contract, previous_key: options.key, provider, body: adapted });
    return transport.generate.call(transport, provider, adapted, { ...options, key });
  } };
  const inherited = createFactoryEvidenceV74({ ...config, ledger: scopedLedger, transport: currentTransport }), adapters = {};
  for (const [stage, adapter] of Object.entries(inherited)) {
    if (stage.startsWith('__')) continue;
    adapters[stage] = async view => stamp(await adapter(view));
    adapters[stage].provenance = { ...adapter.provenance, prompt: FACTORY_VERIFIER_VERSION_V76,
      contract: `${adapter.provenance.contract}-v76`, contract_hash: contract };
  }
  adapters.__evaluation = async (...args) => stamp(await inherited.__evaluation(...args));
  adapters.__context = inherited.__context;
  adapters.__efforts = inherited.__efforts;
  return adapters;
}

export const preparationValueApplicableV76 = candidate => candidate?.provenance?.kind !== 'authentic_pyq';
export function reasoningStepsV76(checks) {
  const counts = ['blind_solution', 'independent_evaluation'].map(stage => Number(checks?.[stage]?.cuet_fit_result?.reasoning_steps))
    .filter(n => Number.isFinite(n) && n > 0);
  return counts.length ? Math.max(...counts) : undefined;
}
export function applyPreparationValueV76(candidate, result, { checks } = {}) {
  if (!preparationValueApplicableV76(candidate)) return { result, value: { findings: [], blocking: false, applicable: false } };
  const value = { ...preparationValueV76(candidate, { reasoningSteps: reasoningStepsV76(checks) }), applicable: true };
  if (!value.blocking) return { result: { ...result, preparation_value: value }, value };
  return { value, result: { ...result, passed: false, exam_fit: false, preparation_value: value,
    reasons: [...(result.reasons || []), ...preparationReasonsV76(value), ...value.findings.filter(f => f.blocking).map(f => `${f.code}: ${f.basis}`)] } };
}
