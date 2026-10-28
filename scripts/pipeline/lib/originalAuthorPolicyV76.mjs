import { hashJSON } from '../../../data/question_factory_policy.mjs';
import { ORIGINAL_AUTHOR_POLICY_V74, createOriginalAuthorPolicyTransportV74, OriginalAuthorAbstentionV74 } from './originalAuthorPolicyV74.mjs';
import { preparationValueV76, preparationReasonsV76 } from './preparationValueV76.mjs';

export { OriginalAuthorAbstentionV74 };
export const ORIGINAL_AUTHOR_POLICY_V76 = 'original-practice-source-complete-objective-v76';

// v7.6 composes v7.4: its source-use, explanation, abstention and identity rules stay in force and are applied first.
export const ORIGINAL_AUTHOR_INSTRUCTIONS_V76 = `Preparation and source-complete construction (v7.6). The v7.4 contract still applies.
- State ONE current official-syllabus objective in learning_objective.objective and its syllabus_unit. Make the complete task genuinely require that knowledge or skill; why_answer_requires_it explains the actual demand without supplying a key hint. Do not copy the keyed proposition or result into the objective. Easy valid recall or recognition at past-paper level is excellent.
- Lexical English questions must test their named target term and print it in the stem or options. Use learning_objective.target_term; otherwise leave target_term empty.
- The stem must provide the case, data, applicable model and decisive statuses. Source rules cannot fill a missing case-specific input. Where accounting treatment depends on fixed asset versus inventory, ownership, payment, premium or timing, state that decisive status explicitly. The supplied excerpts must establish the actual applicable rule or relationship, not merely a nearby concept.
- Build a unique defensible item from the complete supplied authoritative evidence. Audit ALL clauses, conjunctions, quantifiers and scope of every printed option under the actual stem. Partial truth is not full-option truth, and a familiar textbook category is not proof that an alternative is false. Do not dismiss an alternative or institution from source silence. Abstain if uniqueness or the decisive source rule remains uncertain.
- Each distractor should encode a plausible misconception or calculation error. Its rejection and option_analysis must explain its actual evidence-supported error; no unsupported institutional negatives, accounting relations, current-account rules or syllabus assumptions. Logical deductions may use explicit source/stem premises, which must be identifiable. Keep student explanations concise and source-complete; never append broad other-figures or other-institutions claims not established by the premises.
- Linking words, words such as only/always/never, overlap with a supplied passage and printed order are contextual cues. Do not manufacture difficulty by banning useful words, length or obscurity. A passage legitimately supplies information, subject ordering must require the intended syllabus skill, and precise definitions may legitimately use only. Economics calculations must require an economics concept rather than unrelated arithmetic.
- Preserve the requested idea, format, chapter, passage, four distinct options, answer position and job identity. Genuine novelty and campaign allocation are unchanged. Label actual demand honestly: easy recall is excellent, medium applies a rule or linked steps, hard requires sustained reasoning or close conceptual discrimination. Abstain rather than invent evidence, swap the objective or force a pass.`;

const cloneJson = value => JSON.parse(JSON.stringify(value));

export const LEARNING_OBJECTIVE_SCHEMA_V76 = Object.freeze({
  type: 'object', additionalProperties: false, required: ['syllabus_unit', 'objective', 'target_term', 'why_answer_requires_it'],
  properties: { syllabus_unit: { type: 'string' }, objective: { type: 'string' }, target_term: { type: 'string' }, why_answer_requires_it: { type: 'string' } },
});

export function addLearningObjectiveSchemaV76(body) {
  const schema = body?.text?.format?.schema;
  if (!schema || schema.type !== 'object' || schema.additionalProperties !== false || !schema.properties || !Array.isArray(schema.required)) {
    throw new Error('original_author_v76_schema_shape_required');
  }
  const next = cloneJson(body), target = next.text.format.schema;
  target.properties.learning_objective = cloneJson(LEARNING_OBJECTIVE_SCHEMA_V76);
  if (!target.required.includes('learning_objective')) target.required.push('learning_objective');
  return next;
}

// Applied to a body that the v7.4 adapter has already validated (identity, complete references) and adapted.
export function adaptOriginalAuthorRequestV76(body, job) {
  if (!job?.id) throw new Error('original_author_v76_job_identity_required');
  const adapted = addLearningObjectiveSchemaV76(body);
  let input;
  try { input = JSON.parse(adapted.input?.[1]?.content); } catch { throw new Error('original_author_v76_json_input_required'); }
  if (typeof adapted.input?.[0]?.content !== 'string' || input?.job_id !== job.id) throw new Error('original_author_v76_identity_mismatch');
  input.authoring_policy = { ...(input.authoring_policy || {}), contract: ORIGINAL_AUTHOR_POLICY_V76, parent_contract: ORIGINAL_AUTHOR_POLICY_V74, learning_objective_required: true };
  adapted.input[0].content = `${adapted.input[0].content}\n\n${ORIGINAL_AUTHOR_INSTRUCTIONS_V76}`;
  adapted.input[1].content = JSON.stringify(input);
  return adapted;
}

export class PreparationValueBlockedV76 extends Error {
  constructor(candidate, value, jobId) {
    const reasons = preparationReasonsV76(value);
    super(`preparation_value_blocked:${reasons.join(',')}`);
    this.name = 'PreparationValueBlockedV76';
    this.code = 'preparation_value_blocked';
    this.candidate = candidate;
    this.findings = value.findings;
    this.reasons = reasons;
    this.candidate_id = jobId;
  }
}

export function createOriginalAuthorPolicyTransportV76(transport, job, { detectAbstention = true } = {}) {
  if (!transport || typeof transport.generate !== 'function') throw new Error('original_author_v76_transport_required');
  if (!job?.id) throw new Error('original_author_v76_job_identity_required');
  // The v7.6 layer sits below the v7.4 adapter: v7.4 validates identity and references, appends its instructions and the
  // abstention fields, then this layer adds the learning objective and rekeys the request under the v7.6 contract.
  const layer = { ...transport,
    async generate(provider, body, options = {}) {
      if (options.stage !== 'authoring') return transport.generate.call(transport, provider, body, options);
      const adapted = adaptOriginalAuthorRequestV76(body, job);
      const key = hashJSON({ contract: ORIGINAL_AUTHOR_POLICY_V76, previous_key: options.key || null, job_id: job.id, subject: job.subject, chapter: job.chapter, body: adapted });
      return transport.generate.call(transport, provider, adapted, { ...options, key });
    } };
  return createOriginalAuthorPolicyTransportV74(layer, job, { detectAbstention });
}

export async function authorOriginalV76(authorOriginal, job, { registry, transport } = {}) {
  if (typeof authorOriginal !== 'function') throw new Error('original_author_v76_author_required');
  const candidate = await authorOriginal(job, { registry, transport: createOriginalAuthorPolicyTransportV76(transport, job, { detectAbstention: true }) });
  // Free deterministic check on the finished item; a blocking finding hands the pipeline its single repair or a quarantine.
  const value = preparationValueV76(candidate);
  if (value.blocking) throw new PreparationValueBlockedV76(candidate, value, job.id);
  return candidate;
}
