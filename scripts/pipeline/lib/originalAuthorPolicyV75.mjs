import { hashJSON } from '../../../data/question_factory_policy.mjs';
import { ORIGINAL_AUTHOR_POLICY_V74, createOriginalAuthorPolicyTransportV74, OriginalAuthorAbstentionV74 } from './originalAuthorPolicyV74.mjs';
import { preparationValueV75, preparationReasonsV75 } from './preparationValueV75.mjs';

export { OriginalAuthorAbstentionV74 };
export const ORIGINAL_AUTHOR_POLICY_V75 = 'original-practice-learning-objective-v75';

// v7.5 composes v7.4: its source-use, explanation, abstention and identity rules stay in force and are applied first.
export const ORIGINAL_AUTHOR_INSTRUCTIONS_V75 = `Preparation-value contract (v7.5). Everything above still applies; this section adds requirements, it relaxes none.
- learning_objective: state ONE official-syllabus objective in learning_objective.objective (syllabus_unit names the unit it belongs to) and make the final question genuinely require knowing or doing exactly that. why_answer_requires_it says, in one sentence, what a student must know or do. The objective must not reveal the answer: never copy the correct option, the tested fact or the result into it.
- Lexical English items (vocabulary, synonym, antonym, correct word usage, word matching) must test the named target word itself: put it in learning_objective.target_term and make the target word appear in the stem or options. For every item that is not lexical, set target_term to an empty string.
- Do not state the tested fact in the stem. The stem may supply the case, data and decisive assumptions, but a student must not be able to read the answer off it, so a keyed statement must not be a restatement of the stem's own opening sentence.
- Non-English ordering and sequence items (Accountancy, Business Studies, Economics) must not use linking words that reveal the order: no "This", "That", "These", "Those", "Such", "Thus", "Hence", "Then", "Next", "Finally", "Thereafter", "Subsequently", "Following this", "After this" or "Once this" at the start of a step. Write each step as a self-standing statement so that domain knowledge decides the order, and vary the keyed order instead of printing it as A-B-C-D.
- Every distractor must encode one specific, plausible misconception or calculation error that a Class XII student could actually make, and option_analysis must name that error. Avoid conspicuous absolutes (always, never, only, solely, all, every, none, guarantee, completely, entirely, impossible, cannot) in distractors unless the concept itself turns on them; the correct choice and the distractors should read with the same tone and precision.
- Economics numericals must require an economics concept, identity or formula that the stem names or the source excerpts supply (for example multiplier, propensity, elasticity, a national-income aggregate, the money multiplier). Generic arithmetic dressed as economics is not acceptable.
- Difficulty definitions, applied honestly to the item you write: easy = one recall or recognition step (an easy item at past-paper level is excellent); medium = apply one rule or two linked steps; hard = three or more linked reasoning steps, or discriminating between close concepts. Never create difficulty through obscurity, extra length or trick wording, and never label an item hard because it merely looks complex.
- Abstain (abstain=true with a concise abstention_reason) if a genuine item satisfying the above cannot be built from the supplied evidence. A weaker item that satisfies a different objective is not an acceptable substitute.`;

const cloneJson = value => JSON.parse(JSON.stringify(value));

export const LEARNING_OBJECTIVE_SCHEMA_V75 = Object.freeze({
  type: 'object', additionalProperties: false, required: ['syllabus_unit', 'objective', 'target_term', 'why_answer_requires_it'],
  properties: { syllabus_unit: { type: 'string' }, objective: { type: 'string' }, target_term: { type: 'string' }, why_answer_requires_it: { type: 'string' } },
});

export function addLearningObjectiveSchemaV75(body) {
  const schema = body?.text?.format?.schema;
  if (!schema || schema.type !== 'object' || schema.additionalProperties !== false || !schema.properties || !Array.isArray(schema.required)) {
    throw new Error('original_author_v75_schema_shape_required');
  }
  const next = cloneJson(body), target = next.text.format.schema;
  target.properties.learning_objective = cloneJson(LEARNING_OBJECTIVE_SCHEMA_V75);
  if (!target.required.includes('learning_objective')) target.required.push('learning_objective');
  return next;
}

// Applied to a body that the v7.4 adapter has already validated (identity, complete references) and adapted.
export function adaptOriginalAuthorRequestV75(body, job) {
  if (!job?.id) throw new Error('original_author_v75_job_identity_required');
  const adapted = addLearningObjectiveSchemaV75(body);
  let input;
  try { input = JSON.parse(adapted.input?.[1]?.content); } catch { throw new Error('original_author_v75_json_input_required'); }
  if (typeof adapted.input?.[0]?.content !== 'string' || input?.job_id !== job.id) throw new Error('original_author_v75_identity_mismatch');
  input.authoring_policy = { ...(input.authoring_policy || {}), contract: ORIGINAL_AUTHOR_POLICY_V75, parent_contract: ORIGINAL_AUTHOR_POLICY_V74, learning_objective_required: true };
  adapted.input[0].content = `${adapted.input[0].content}\n\n${ORIGINAL_AUTHOR_INSTRUCTIONS_V75}`;
  adapted.input[1].content = JSON.stringify(input);
  return adapted;
}

export class PreparationValueBlockedV75 extends Error {
  constructor(candidate, value, jobId) {
    const reasons = preparationReasonsV75(value);
    super(`preparation_value_blocked:${reasons.join(',')}`);
    this.name = 'PreparationValueBlockedV75';
    this.code = 'preparation_value_blocked';
    this.candidate = candidate;
    this.findings = value.findings;
    this.reasons = reasons;
    this.candidate_id = jobId;
  }
}

export function createOriginalAuthorPolicyTransportV75(transport, job, { detectAbstention = true } = {}) {
  if (!transport || typeof transport.generate !== 'function') throw new Error('original_author_v75_transport_required');
  if (!job?.id) throw new Error('original_author_v75_job_identity_required');
  // The v7.5 layer sits below the v7.4 adapter: v7.4 validates identity and references, appends its instructions and the
  // abstention fields, then this layer adds the learning objective and rekeys the request under the v7.5 contract.
  const layer = { ...transport,
    async generate(provider, body, options = {}) {
      if (options.stage !== 'authoring') return transport.generate.call(transport, provider, body, options);
      const adapted = adaptOriginalAuthorRequestV75(body, job);
      const key = hashJSON({ contract: ORIGINAL_AUTHOR_POLICY_V75, previous_key: options.key || null, job_id: job.id, subject: job.subject, chapter: job.chapter, body: adapted });
      return transport.generate.call(transport, provider, adapted, { ...options, key });
    } };
  return createOriginalAuthorPolicyTransportV74(layer, job, { detectAbstention });
}

export async function authorOriginalV75(authorOriginal, job, { registry, transport } = {}) {
  if (typeof authorOriginal !== 'function') throw new Error('original_author_v75_author_required');
  const candidate = await authorOriginal(job, { registry, transport: createOriginalAuthorPolicyTransportV75(transport, job, { detectAbstention: true }) });
  // Free deterministic check on the finished item; a blocking finding hands the pipeline its single repair or a quarantine.
  const value = preparationValueV75(candidate);
  if (value.blocking) throw new PreparationValueBlockedV75(candidate, value, job.id);
  return candidate;
}
