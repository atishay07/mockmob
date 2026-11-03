import { hashJSON } from '../../../data/question_factory_policy.mjs';
import { createFactoryEvidenceV73, V73_PROMPT, TOPOLOGIES, requiredStagesV7 } from './factoryEvidenceV73.mjs';
import { FACTORY_VERIFIER_VERSION_V74, validationContractV74 } from './contractV74.mjs';
export { FACTORY_VERIFIER_VERSION_V74, TOPOLOGIES, requiredStagesV7 };

export const V74_ASSUMPTION_INSTRUCTIONS = `V7.4 prerequisite classification:
answer_conditions lists INPUT prerequisites, not the result of solving. Ask whether a proposed condition can vary independently while preserving every explicit stem fact and applicable supplied source rule.
Do not list an arithmetic remainder calculated from given amounts, a logical relationship derived from two supplied propositions, or the answer itself as an inferred_fact or missing prerequisite. Show those deductions and their exact premises in reasons instead. For example, the remainder obtained by subtracting two explicitly given amounts is a calculation, not an omitted amount. This never supplies an absent original amount, payment status, transaction, model, method or exception.
Keep inferred_fact for a case-specific INPUT assumed or guessed instead of given; keep implied_decisive and missing for genuinely unstated, answer-changing prerequisites. A source illustration cannot fill a missing case value/status. If different reasonable case realizations consistent with all printed facts produce different keys, report the missing prerequisite and reject. Never remove such a blocker merely because solvers agree.
An Assertion–Reason explanatory relationship is assessed by reasoning from the two supported statements; it is not an additional transaction fact. Check the actual printed format: a wrong assigned format still fails question_type_match.
For an item whose answer depends on the supplied literary/factual/narrative passage, identify the reading-comprehension chapter by that stimulus and record the vocabulary/inference skill as the topic. A standalone lexical question belongs to Vocabulary. Do not copy the assigned chapter to conceal a mismatch; verify the official syllabus and source coverage.
Every mandatory source, key, uniqueness, option-challenge, numerical, passage and explanation gate remains in force. No score compensates for a failure.`;

export const V74_PROMPT = `${V73_PROMPT}\n\n${V74_ASSUMPTION_INSTRUCTIONS}`;
export const V74_PROMPT_HASH = hashJSON({ prompt: V74_PROMPT, contract: validationContractV74() });

export function adaptEvaluationRequestV74(provider, body, options = {}) {
  if (!['blind_solution', 'independent_evaluation'].includes(options.stage)) return body;
  const adapted = structuredClone(body);
  if (provider === 'openai') {
    const system = adapted.input?.find(row => row.role === 'system');
    if (typeof system?.content !== 'string') throw new Error('v74_blind_system_prompt_required');
    system.content += `\n\n${V74_ASSUMPTION_INSTRUCTIONS}`;
  } else if (provider === 'gemini') {
    const system = adapted.systemInstruction?.parts?.[0];
    if (typeof system?.text !== 'string') throw new Error('v74_blind_system_prompt_required');
    system.text += `\n\n${V74_ASSUMPTION_INSTRUCTIONS}`;
  } else if (provider === 'anthropic') {
    if (typeof adapted.system !== 'string') throw new Error('v74_blind_system_prompt_required');
    adapted.system += `\n\n${V74_ASSUMPTION_INSTRUCTIONS}`;
  } else throw new Error('v74_blind_provider_required');
  return adapted;
}

export function createFactoryEvidenceV74(config) {
  const { ledger, transport } = config, contract = validationContractV74();
  const stamp = result => ({ ...result, prompt_version: FACTORY_VERIFIER_VERSION_V74,
    evaluation_prompt: V74_PROMPT_HASH, validation_contract_hash: contract });
  // Cache and provider identities are separated even though the parent performs
  // the same deterministic interpretation. Never reuse a v7.3 model decision.
  const scopedLedger = {
    getCache: key => ledger.getCache(`v74:${contract}:${key}`),
    setCache: (key, value) => ledger.setCache(`v74:${contract}:${key}`, stamp(value)),
  };
  const currentTransport = { ...transport, generate(provider, body, options = {}) {
    const adapted = adaptEvaluationRequestV74(provider, body, options);
    const key = hashJSON({ contract, previous_key: options.key, provider, body: adapted });
    return transport.generate.call(transport, provider, adapted, { ...options, key });
  } };
  const inherited = createFactoryEvidenceV73({ ...config, ledger: scopedLedger, transport: currentTransport });
  const adapters = {};
  for (const [stage, adapter] of Object.entries(inherited)) {
    if (stage.startsWith('__')) continue;
    adapters[stage] = async view => stamp(await adapter(view));
    adapters[stage].provenance = { ...adapter.provenance, prompt: FACTORY_VERIFIER_VERSION_V74,
      contract: `${adapter.provenance.contract}-v74`, contract_hash: contract };
  }
  adapters.__evaluation = async (...args) => stamp(await inherited.__evaluation(...args));
  adapters.__context = inherited.__context;
  adapters.__efforts = inherited.__efforts;
  return adapters;
}
