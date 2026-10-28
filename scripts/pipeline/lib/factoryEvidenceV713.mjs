import { compactSystemV713, RESOLUTION_V713, AUDIT_V713, COMMON_V713, DIFFICULTY_V713 } from './compactValidationV713.mjs';
import { DIFFICULTY_SCHEMA_V713 } from './difficultyPolicyV713.mjs';
import { hashJSON } from '../../../data/question_factory_policy.mjs';
import { createFactoryEvidenceV76, V76_PROMPT_HASH, blindViewV76, TOPOLOGIES, requiredStagesV7, applyPreparationValueV76 } from './factoryEvidenceV76.mjs';
import { FACTORY_VERIFIER_VERSION_V713, validationContractV713 } from './contractV713.mjs';
import { readingTaskV712, illustrationTaskV712 } from './questionScopeV712.mjs';
import { optionResolutionSchemaV712, applyOptionResolutionV712, resolutionAuditSchemaV712, applyResolutionAuditV712 } from './optionResolutionV712.mjs';
export { FACTORY_VERIFIER_VERSION_V713, TOPOLOGIES, requiredStagesV7, blindViewV76 as blindViewV713, applyPreparationValueV76 };

export const V713_OPTION_RESOLUTION_INSTRUCTIONS = RESOLUTION_V713;
export const V713_AUDIT_INSTRUCTIONS = AUDIT_V713;
export const V713_EXPLANATION_DEDUCTION = COMMON_V713;
export const V713_OUTPUT_CAPS = Object.freeze({ blind_solution: 16000, independent_evaluation: 6000, explanation_support: 8000 });
export const V713_PROMPT_HASH = hashJSON({ parent_prompt_hash: V76_PROMPT_HASH, option_resolution_instructions: V713_OPTION_RESOLUTION_INSTRUCTIONS,
  audit_instructions: V713_AUDIT_INSTRUCTIONS, explanation_deduction: V713_EXPLANATION_DEDUCTION, difficulty: DIFFICULTY_V713, output_caps: V713_OUTPUT_CAPS, contract: validationContractV713() });

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
const hasPassage = input => typeof input?.passage === 'string' && input.passage.trim().length > 0;
const parse = text => { try { return JSON.parse(text); } catch { return null; } };
const identityKey = v => `${v?.candidate_id || ''}\0${v?.content_hash || ''}`;

export function adaptEvaluationRequestV713(provider, body, options = {}, frozenFor = null) {
  if (!['blind_solution', 'independent_evaluation', 'explanation_support'].includes(options.stage)) return body;
  const adapted = structuredClone(body), input = parse(userText(adapted, provider)), schema = schemaNode(adapted);
  if (!input || !schema?.properties || !Array.isArray(input.evidence_catalog)) throw new Error('v713_schema_and_evidence_catalog_required');
  if (String(systemText(adapted, provider)).split('V7.6 ').length - 1 < 1 || /V7\.[89] /.test(systemText(adapted, provider))) throw new Error('v713_expected_single_v76_adaptation');
  if (options.stage === 'explanation_support') {
    const frozen = frozenFor?.({ candidate_id: input.candidate_id, content_hash: input.content_hash });
    input.option_resolutions = frozen.map(f => ({ solver: f.solver, solved_key: f.solved_key, rows: f.rows }));
    schema.properties.resolution_audit = resolutionAuditSchemaV712();
    // Non-passage items: remove the passage-only basis from the enum so the audit cannot pick a label the binder must reject (measured q1 regression).
    // V7.12: offer scope bases only where the deterministic task detector would let them count.
    { const basis = schema.properties.resolution_audit.properties.distractors.items.properties.basis;
      basis.enum = basis.enum.filter(b => (b !== 'passage_unsupported' || readingTaskV712(input)) && (b !== 'not_exhibited_by_case' || illustrationTaskV712(input))); }
    schema.required = [...new Set([...(schema.required || []), 'resolution_audit'])];
    appendSystem(adapted, provider, V713_AUDIT_INSTRUCTIONS);
    appendSystem(adapted, provider, V713_EXPLANATION_DEDUCTION);
    setUser(adapted, provider, JSON.stringify(input));
  } else {
    if (!schema.properties.option_challenges) throw new Error('v713_blind_schema_expected');
    schema.properties.difficulty_assessment = structuredClone(DIFFICULTY_SCHEMA_V713);
    schema.required = [...new Set([...schema.required, 'difficulty_assessment'])];
    schema.properties.option_resolution = optionResolutionSchemaV712(input.evidence_catalog.map(e => e.id));
    { const src = schema.properties.option_resolution.items.properties.premise_source;
      src.enum = src.enum.filter(b => (b !== 'passage_scope' || hasPassage(input)) && (b !== 'case_scope' || illustrationTaskV712(input))); }
    schema.required = [...new Set([...(schema.required || []), 'option_resolution'])];
    appendSystem(adapted, provider, V713_OPTION_RESOLUTION_INSTRUCTIONS);
  }
  const concise = compactSystemV713(options.stage);
  if (provider === 'openai') adapted.input.find(r => r.role === 'system').content = concise;
  else if (provider === 'gemini') adapted.systemInstruction.parts[0].text = concise;
  else if (provider === 'anthropic') adapted.system = concise;
  const inheritedCap = provider === 'openai' ? (options.stage === 'explanation_support' ? 5000 : 7500)
    : provider === 'gemini' ? 4500 : (options.stage === 'explanation_support' ? 7000 : 9000);
  const incomingCap = provider === 'openai' ? body.max_output_tokens : provider === 'gemini'
    ? body.generationConfig?.maxOutputTokens : body.max_tokens;
  const multiplier = incomingCap / inheritedCap;
  if (![1, 2].includes(multiplier)) throw Error('v713_unbounded_completion_multiplier');
  setCap(adapted, provider, V713_OUTPUT_CAPS[options.stage] * multiplier);
  return adapted;
}

export function createFactoryEvidenceV713(config) {
  const { ledger, transport } = config, contract = validationContractV713(), topology = config.topology || TOPOLOGIES.dual_blind;
  const stamp = r => ({ ...r, prompt_version: FACTORY_VERIFIER_VERSION_V713, evaluation_prompt: V713_PROMPT_HASH, validation_contract_hash: contract });
  const providers = [topology.primary, topology.secondary].filter(Boolean), frozenByIdentity = new Map();
  const frozenFor = view => {
    const rows = frozenByIdentity.get(identityKey(view));
    if (!rows || providers.some(p => !rows.has(p))) throw new Error('v713_two_frozen_resolutions_required');
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
  const scopedLedger = { getCache: key => ledger.getCache(`v713:${contract}:${key}`), setCache: (key, value) => ledger.setCache(`v713:${contract}:${key}`, stamp(value)) };
  const currentTransport = { ...transport, generate(provider, body, options = {}) {
    const adapted = adaptEvaluationRequestV713(provider, body, options, frozenFor);
    return transport.generate.call(transport, provider, adapted, { ...options, key: hashJSON({ contract, previous_key: options.key, provider, body: adapted }) });
  } };
  const inherited = createFactoryEvidenceV76({ ...config, ledger: scopedLedger, transport: currentTransport }), adapters = {};
  const catalogFor = view => inherited.__context(view).evidence_catalog;
  const resolve = (result, view) => applyOptionResolutionV712({ ...result, option_resolution_rows: result.option_resolution_rows ?? result.option_resolution }, view, { evidenceCatalog: catalogFor(view) });
  for (const [stage, adapter] of Object.entries(inherited)) {
    if (stage.startsWith('__')) continue;
    adapters[stage] = async view => {
      let result = await adapter(view);
      if (stage === 'explanation_support') return stamp(applyResolutionAuditV712(result, view, { frozen: frozenFor(view) }));
      if (['blind_solution', 'independent_evaluation', 'alternatives', 'exam_fit', 'syllabus_mapping', 'presentation_quality', 'numeric_solution', 'llm_boundary_cases', 'passage_integrity', 'passage_answerability', 'source_support'].includes(stage))
        result = resolve(result, view);
      if (['blind_solution', 'independent_evaluation'].includes(stage) && !freeze(stage, view, result))
        return stamp({ ...result, passed: false, reasons: [...(result.reasons || []), 'v713_blind_resolution_freeze_failed'] });
      return stamp(result);
    };
    adapters[stage].provenance = { ...adapter.provenance, prompt: FACTORY_VERIFIER_VERSION_V713, contract: `${adapter.provenance.contract}-v713`, contract_hash: contract };
  }
  adapters.__evaluation = async (view, ...args) => stamp(resolve(await inherited.__evaluation(view, ...args), view));
  adapters.__freezeResolution = (stage, view, result) => freeze(stage, view, result);
  adapters.__auditResolution = (view, result) => applyResolutionAuditV712(result, view, { frozen: frozenFor(view) });
  adapters.__context = inherited.__context; adapters.__efforts = inherited.__efforts;
  return adapters;
}
