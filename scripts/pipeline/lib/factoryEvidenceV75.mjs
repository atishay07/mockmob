import { hashJSON } from '../../../data/question_factory_policy.mjs';
import { blindView } from './evidencePipeline.mjs';
import { createFactoryEvidenceV74, V74_PROMPT, TOPOLOGIES, requiredStagesV7 } from './factoryEvidenceV74.mjs';
import { FACTORY_VERIFIER_VERSION_V75, validationContractV75 } from './contractV75.mjs';
import { preparationValueV75, preparationReasonsV75 } from './preparationValueV75.mjs';
export { FACTORY_VERIFIER_VERSION_V75, TOPOLOGIES, requiredStagesV7 };

// Judge-side v7.5 instructions. They sharpen three model-rated rubric criteria (syllabus_objective, level_calibration,
// discrimination_value) around the item's stated learning objective. They add scrutiny only: no instruction lowers a
// mandatory correctness requirement, and a low score here never changes whether the key, source or numerics are right.
export const V75_FIT_INSTRUCTIONS = `V7.5 preparation-value judging:
The input may include learning_objective: the item's stated official-syllabus unit, objective and (for a lexical item) target word. It never contains the proposed key, explanation or option analysis.
- syllabus_objective: score 0 or 1 (never above 1) when answering does not require the knowledge named by that objective: for example the item is solvable from wording alone, from sentence-linking cues (this/that/then/following this), from the stem itself stating the tested fact or the keyed statement, or from generic arithmetic that needs no concept of the subject. A lexical item must test its named target word. If learning_objective is absent, judge the idea the question actually tests.
- level_calibration: judge from what a student must actually know or do to answer. Ignore the difficulty label and what the item claims about itself. Easy direct recall or recognition at past-paper level is acceptable and must not be penalised for being easy.
- discrimination_value: score 0 or 1 (never above 1) when distractors can be eliminated without subject knowledge: through conspicuous absolutes (always, never, only, all, every, none, guarantee), self-contradiction, or simple repetition of the stem. Distractors that each encode a plausible misconception or calculation error deserve credit.
- Reading information that the item itself supplies (a printed passage, a case, given data) is legitimate comprehension and must not be treated as the stem disclosing the answer.
- Never inflate a score to be generous. Every mandatory correctness gate (independent key, one defensible answer, decisive assumptions, source support, syllabus entitlement, numerics, passage completeness) remains in force and is unaffected.`;

export const V75_PROMPT = `${V74_PROMPT}\n\n${V75_FIT_INSTRUCTIONS}`;
export const V75_PROMPT_HASH = hashJSON({ prompt: V75_PROMPT, contract: validationContractV75() });

// The blind view with the stated objective added. why_answer_requires_it is author rationale and stays out, so a blind
// solver or judge never receives the proposed key, explanation, option analysis or an author hint about the answer.
export function blindViewV75(candidate, references) {
  const view = blindView(candidate, references), lo = candidate?.learning_objective;
  if (lo && typeof lo === 'object' && !Array.isArray(lo)) {
    view.learning_objective = { syllabus_unit: String(lo.syllabus_unit ?? ''), objective: String(lo.objective ?? ''), target_term: String(lo.target_term ?? '') };
  }
  return view;
}

export function adaptEvaluationRequestV75(provider, body, options = {}) {
  if (!['blind_solution', 'independent_evaluation'].includes(options.stage)) return body;
  const adapted = structuredClone(body);
  if (provider === 'openai') {
    const system = adapted.input?.find(row => row.role === 'system');
    if (typeof system?.content !== 'string') throw new Error('v75_blind_system_prompt_required');
    system.content += `\n\n${V75_FIT_INSTRUCTIONS}`;
  } else if (provider === 'gemini') {
    const system = adapted.systemInstruction?.parts?.[0];
    if (typeof system?.text !== 'string') throw new Error('v75_blind_system_prompt_required');
    system.text += `\n\n${V75_FIT_INSTRUCTIONS}`;
  } else if (provider === 'anthropic') {
    if (typeof adapted.system !== 'string') throw new Error('v75_blind_system_prompt_required');
    adapted.system += `\n\n${V75_FIT_INSTRUCTIONS}`;
  } else throw new Error('v75_blind_provider_required');
  return adapted;
}

export function createFactoryEvidenceV75(config) {
  const { ledger, transport } = config, contract = validationContractV75();
  const stamp = result => ({ ...result, prompt_version: FACTORY_VERIFIER_VERSION_V75,
    evaluation_prompt: V75_PROMPT_HASH, validation_contract_hash: contract });
  // Cache and provider identities are scoped by the v7.5 contract; a v7.4 (or older) model decision is never reused.
  const scopedLedger = {
    getCache: key => ledger.getCache(`v75:${contract}:${key}`),
    setCache: (key, value) => ledger.setCache(`v75:${contract}:${key}`, stamp(value)),
  };
  const currentTransport = { ...transport, generate(provider, body, options = {}) {
    const adapted = adaptEvaluationRequestV75(provider, body, options);
    const key = hashJSON({ contract, previous_key: options.key, provider, body: adapted });
    return transport.generate.call(transport, provider, adapted, { ...options, key });
  } };
  const inherited = createFactoryEvidenceV74({ ...config, ledger: scopedLedger, transport: currentTransport });
  const adapters = {};
  for (const [stage, adapter] of Object.entries(inherited)) {
    if (stage.startsWith('__')) continue;
    adapters[stage] = async view => stamp(await adapter(view));
    adapters[stage].provenance = { ...adapter.provenance, prompt: FACTORY_VERIFIER_VERSION_V75,
      contract: `${adapter.provenance.contract}-v75`, contract_hash: contract };
  }
  adapters.__evaluation = async (...args) => stamp(await inherited.__evaluation(...args));
  adapters.__context = inherited.__context;
  adapters.__efforts = inherited.__efforts;
  return adapters;
}

// The authenticated official questions are reproduced, not authored: only generated practice items carry preparation-value duties.
export const preparationValueApplicableV75 = candidate => candidate?.provenance?.kind !== 'authentic_pyq';

// Reasoning steps reported by the independent evaluations. The larger count is used so a disagreement can only
// withhold, never create, a difficulty_label_overstated finding.
export function reasoningStepsV75(checks) {
  const counts = ['blind_solution', 'independent_evaluation'].map(stage => Number(checks?.[stage]?.cuet_fit_result?.reasoning_steps))
    .filter(n => Number.isFinite(n) && n > 0);
  return counts.length ? Math.max(...counts) : undefined;
}

// Applied by verifyV75 after the inherited evaluation. A blocking finding fails the CUET-fit gate (quarantine); it never
// converts a correctness pass into a failure or the reverse, and the evaluation result itself stays untouched in the cache.
export function applyPreparationValueV75(candidate, result, { checks } = {}) {
  if (!preparationValueApplicableV75(candidate)) return { result, value: { findings: [], blocking: false, applicable: false } };
  const value = { ...preparationValueV75(candidate, { reasoningSteps: reasoningStepsV75(checks) }), applicable: true };
  if (!value.blocking) return { result: { ...result, preparation_value: value }, value };
  const codes = preparationReasonsV75(value);
  return { value, result: { ...result, passed: false, exam_fit: false, preparation_value: value,
    reasons: [...(result.reasons || []), ...codes, ...value.findings.filter(f => f.blocking).map(f => `${f.code}: ${f.basis}`)] } };
}
