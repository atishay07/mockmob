import { hashJSON } from '../../../data/question_factory_policy.mjs';
import { createFactoryEvidenceV76, V76_PROMPT_HASH, blindViewV76, TOPOLOGIES, requiredStagesV7, applyPreparationValueV76 } from './factoryEvidenceV76.mjs';
import { FACTORY_VERIFIER_VERSION_V79, validationContractV79 } from './contractV79.mjs';
import { optionResolutionSchemaV79, applyOptionResolutionV79, resolutionAuditSchemaV79, applyResolutionAuditV79 } from './optionResolutionV79.mjs';
export { FACTORY_VERIFIER_VERSION_V79, TOPOLOGIES, requiredStagesV7, blindViewV76 as blindViewV79, applyPreparationValueV76 };

export const V79_OPTION_RESOLUTION_INSTRUCTIONS = `V7.9 option resolution (mandatory field option_resolution: exactly one row for each printed option A, B, C, D, including your solved option):
- status "supported" only when the FULL printed option holds under the actual stem and supplied evidence; "contradicted" only when a specific part of it is shown false; otherwise "unresolved".
- For "contradicted", copy into false_part the exact contiguous words of that option that are false, and into premise_quote the exact words (verbatim, at least a clause) from the stem/passage or from ONE supplied evidence excerpt that establishes the contradiction.
- premise_source: "excerpt" with its evidence_id; "stem" (stem or passage words, evidence_id empty); "arithmetic" when a calculation from stem givens decides it (premise_quote = the exact stem words giving the inputs, reason = the calculation, evidence_id empty). For "unresolved" use premise_source "none" and empty quotes.
- premise_quote is ONE contiguous span copied character-for-character from a single place (line breaks may differ). Never use "..." or join separate sentences; if several sentences matter, quote the single most decisive one.
- For "supported", premise_quote holds the decisive supporting words. An option's own printed words never prove it.
- A textbook-category label, partial truth of a conjunction, or the source not mentioning something neither supports nor contradicts a full option: mark it "unresolved".
- Passage questions only (a passage is supplied and the question is about it): the passage is the whole universe of the question. An option the passage neither states nor reasonably implies is wrong as an answer: mark it "contradicted" with premise_source "passage_scope", premise_quote = the exact passage words that actually address that point, false_part = the unsupported words of the option, and say in reason why the passage does not state or imply it. If a fair reader could infer the option from the passage, mark it "unresolved". Never use passage_scope for subject-fact questions without a passage.
- Rival-condition check (before supporting a classification or rule): read EVERY supplied excerpt that defines a category or rule named in any option. If such a definition has a condition the stem does not rule out (for example "capital receipts create a liability OR reduce assets" when the stem never says the receipt does not reduce assets), the key depends on an unstated assumption: mark the key unresolved, list the condition in answer_conditions as missing with alters_key_if_changed true, and set single_defensible_answer false.
- solved_key must be the single supported option. If another option is supported or any option stays unresolved, also set single_defensible_answer false. Keep each reason under 25 words.`;

export const V79_AUDIT_INSTRUCTIONS = `V7.9 audit of the two blind resolutions (field resolution_audit, inside this existing explanation check):
You also receive option_resolutions: the two blind solvers' independently frozen per-option resolutions. They are claims to audit, not truth. Using only the printed stem/options and supplied evidence:
- key: the key both solvers chose; key_fully_supported true only if every part of that full option is established.
- unexcluded_rival_conditions: read EVERY supplied excerpt that defines a category or rule named in any option (including the key's and each distractor's). List each defining condition of a rival category/rule that the printed stem does not rule out and that, if true, would change the answer (for example: "capital receipt if it reduces assets — the stem never says the non-tax receipt does not reduce assets"). Return an empty array only when every such condition is excluded by printed words.
- distractors: one row per other option. decisively_wrong is true only when the option is certainly wrong as an answer: a solver's cited premise (or a calculation from stem givens) actually contradicts its stated false part (basis direct_contradiction or arithmetic), or, in a question about a supplied passage, the passage read fairly neither states nor implies it (basis passage_unsupported). Set decisively_wrong false when the evidence leaves the option possibly correct, with the basis that explains why: category_only, source_silence, partial_truth, unsupported or incorrect when the only reason offered is a category label, the source not mentioning it (outside passage questions), a true companion clause, an unsupported rule, or a wrong reading. In a passage question, an option a reasonable reader could infer from the passage is NOT decisively wrong. Do not invent a refutation the evidence does not give. Keep reasons under 25 words.`;

export const V79_OUTPUT_CAPS = Object.freeze({ blind_solution: 10000, independent_evaluation: 6000, explanation_support: 8000 });
export const V79_PROMPT_HASH = hashJSON({ parent_prompt_hash: V76_PROMPT_HASH, option_resolution_instructions: V79_OPTION_RESOLUTION_INSTRUCTIONS,
  audit_instructions: V79_AUDIT_INSTRUCTIONS, output_caps: V79_OUTPUT_CAPS, contract: validationContractV79() });

const userText = (body, provider) => provider === 'openai' ? body.input?.find(x => x.role === 'user')?.content
  : provider === 'gemini' ? body.contents?.find(x => x.role === 'user')?.parts?.[0]?.text : body.messages?.find(x => x.role === 'user')?.content;
function setUser(body, provider, text) {
  if (provider === 'openai') body.input.find(x => x.role === 'user').content = text;
  else if (provider === 'gemini') body.contents.find(x => x.role === 'user').parts[0].text = text;
  else body.messages.find(x => x.role === 'user').content = text;
}
function appendSystem(body, provider, text) {
  if (provider === 'openai') body.input.find(x => x.role === 'system').content += `\n\n${text}`;
  else if (provider === 'gemini') body.systemInstruction.parts[0].text += `\n\n${text}`;
  else body.system += `\n\n${text}`;
}
const systemText = (body, provider) => provider === 'openai' ? body.input?.find(x => x.role === 'system')?.content
  : provider === 'gemini' ? body.systemInstruction?.parts?.[0]?.text : body.system;
const schemaNode = body => body?.text?.format?.schema || body?.generationConfig?.responseFormat?.text?.schema || body?.output_config?.format?.schema || null;
function setCap(body, provider, cap) {
  if (provider === 'openai') body.max_output_tokens = Math.max(body.max_output_tokens || 0, cap);
  else if (provider === 'gemini') body.generationConfig.maxOutputTokens = Math.max(body.generationConfig.maxOutputTokens || 0, cap);
  else body.max_tokens = Math.max(body.max_tokens || 0, cap);
}
const parse = text => { try { return JSON.parse(text); } catch { return null; } };
const identityKey = v => `${v?.candidate_id || ''}\0${v?.content_hash || ''}`;

export function adaptEvaluationRequestV79(provider, body, options = {}, frozenFor = null) {
  if (!['blind_solution', 'independent_evaluation', 'explanation_support'].includes(options.stage)) return body;
  const adapted = structuredClone(body), input = parse(userText(adapted, provider)), schema = schemaNode(adapted);
  if (!input || !schema?.properties || !Array.isArray(input.evidence_catalog)) throw new Error('v79_schema_and_evidence_catalog_required');
  if (String(systemText(adapted, provider)).split('V7.6 ').length - 1 < 1 || /V7\.[89] /.test(systemText(adapted, provider))) throw new Error('v79_expected_single_v76_adaptation');
  if (options.stage === 'explanation_support') {
    const frozen = frozenFor?.({ candidate_id: input.candidate_id, content_hash: input.content_hash });
    input.option_resolutions = frozen.map(f => ({ solver: f.solver, solved_key: f.solved_key, rows: f.rows }));
    schema.properties.resolution_audit = resolutionAuditSchemaV79();
    schema.required = [...new Set([...(schema.required || []), 'resolution_audit'])];
    appendSystem(adapted, provider, V79_AUDIT_INSTRUCTIONS);
    setUser(adapted, provider, JSON.stringify(input));
  } else {
    if (!schema.properties.option_challenges) throw new Error('v79_blind_schema_expected');
    schema.properties.option_resolution = optionResolutionSchemaV79(input.evidence_catalog.map(e => e.id));
    schema.required = [...new Set([...(schema.required || []), 'option_resolution'])];
    appendSystem(adapted, provider, V79_OPTION_RESOLUTION_INSTRUCTIONS);
  }
  setCap(adapted, provider, V79_OUTPUT_CAPS[options.stage]);
  return adapted;
}

export function createFactoryEvidenceV79(config) {
  const { ledger, transport } = config, contract = validationContractV79(), topology = config.topology || TOPOLOGIES.dual_blind;
  const stamp = r => ({ ...r, prompt_version: FACTORY_VERIFIER_VERSION_V79, evaluation_prompt: V79_PROMPT_HASH, validation_contract_hash: contract });
  const providers = [topology.primary, topology.secondary].filter(Boolean), frozenByIdentity = new Map();
  const frozenFor = view => {
    const rows = frozenByIdentity.get(identityKey(view));
    if (!rows || providers.some(p => !rows.has(p))) throw new Error('v79_two_frozen_resolutions_required');
    return providers.map(p => rows.get(p));
  };
  const freeze = (stage, view, result) => {
    if (!['blind_solution', 'independent_evaluation'].includes(stage)) return true;
    if (!result || result.candidate_id !== view.candidate_id || result.content_hash !== view.content_hash || result.option_resolution?.passed !== true ||
        !providers.includes(result.provider)) return false;
    const rows = frozenByIdentity.get(identityKey(view)) || new Map();
    const frozen = { candidate_id: view.candidate_id, content_hash: view.content_hash, solver: result.provider, solved_key: result.solved_key, rows: structuredClone(result.option_resolution_rows) };
    const old = rows.get(result.provider);
    if (old && hashJSON(old) !== hashJSON(frozen)) return false;
    rows.set(result.provider, frozen); frozenByIdentity.set(identityKey(view), rows); return true;
  };
  const scopedLedger = { getCache: key => ledger.getCache(`v79:${contract}:${key}`), setCache: (key, value) => ledger.setCache(`v79:${contract}:${key}`, stamp(value)) };
  const currentTransport = { ...transport, generate(provider, body, options = {}) {
    const adapted = adaptEvaluationRequestV79(provider, body, options, frozenFor);
    return transport.generate.call(transport, provider, adapted, { ...options, key: hashJSON({ contract, previous_key: options.key, provider, body: adapted }) });
  } };
  const inherited = createFactoryEvidenceV76({ ...config, ledger: scopedLedger, transport: currentTransport }), adapters = {};
  const catalogFor = view => inherited.__context(view).evidence_catalog;
  const resolve = (result, view) => applyOptionResolutionV79({ ...result, option_resolution_rows: result.option_resolution_rows ?? result.option_resolution }, view, { evidenceCatalog: catalogFor(view) });
  for (const [stage, adapter] of Object.entries(inherited)) {
    if (stage.startsWith('__')) continue;
    adapters[stage] = async view => {
      let result = await adapter(view);
      if (stage === 'explanation_support') return stamp(applyResolutionAuditV79(result, view, { frozen: frozenFor(view) }));
      if (['blind_solution', 'independent_evaluation', 'alternatives', 'exam_fit', 'syllabus_mapping', 'presentation_quality', 'numeric_solution', 'llm_boundary_cases', 'passage_integrity', 'passage_answerability', 'source_support'].includes(stage))
        result = resolve(result, view);
      if (['blind_solution', 'independent_evaluation'].includes(stage) && !freeze(stage, view, result))
        return stamp({ ...result, passed: false, reasons: [...(result.reasons || []), 'v79_blind_resolution_freeze_failed'] });
      return stamp(result);
    };
    adapters[stage].provenance = { ...adapter.provenance, prompt: FACTORY_VERIFIER_VERSION_V79, contract: `${adapter.provenance.contract}-v79`, contract_hash: contract };
  }
  adapters.__evaluation = async (view, ...args) => stamp(resolve(await inherited.__evaluation(view, ...args), view));
  adapters.__freezeResolution = (stage, view, result) => freeze(stage, view, result);
  adapters.__auditResolution = (view, result) => applyResolutionAuditV79(result, view, { frozen: frozenFor(view) });
  adapters.__context = inherited.__context; adapters.__efforts = inherited.__efforts;
  return adapters;
}
