import { hashJSON } from '../../../data/question_factory_policy.mjs';
import { authorOriginalV76, ORIGINAL_AUTHOR_POLICY_V76 } from './originalAuthorPolicyV76.mjs';

// V7.9 author layer (9 Oct 2026), composed over the unchanged V7.6 author policy. Aimed at the measured V7.9 regression failures:
// valid items were quarantined because a distractor's only fault was a different textbook category or something the cited excerpt never
// mentions (the audit correctly refuses category/silence refutations), or because explanations added unsupported commentary.
// It changes instructions only: no gate, schema, novelty rule or answer-position rule changes.
export const ORIGINAL_AUTHOR_POLICY_V79 = 'original-practice-decisive-distractors-v79';
export const ORIGINAL_AUTHOR_INSTRUCTIONS_V79 = `Decisive-distractor construction (v7.9; the v7.6 contract still applies).
Independent validators will resolve every option and require, for each distractor, an exact contiguous quote from the stem/passage or from ONE cited excerpt (or a calculation from printed givens) that contradicts a specific part of it. Uncertainty is quarantined.
- Build each distractor by changing ONE decisive element that the cited excerpt or the stem states explicitly: wrong account or head, reversed condition, wrong ratio/rate/period/amount, misapplied rule, omitted or reordered step, misread passage detail. It should attract a student holding that specific misconception.
- Do not write distractors whose only fault is belonging to another textbook category, or that rely on a concept the cited excerpts never define (for example an unrelated right, function or principle). Such options cannot be decisively refuted. If alternative concepts must appear, cite an excerpt that defines each, so its mismatch is quotable.
- Passage items: every distractor must be contradicted by, or plainly absent from, the passage, and none may be a reasonable inference from it.
- The key must be fully established by quotable stem/excerpt words or printed-data arithmetic; no outside knowledge for any decisive step.
- Explanation: 2-4 sentences. State the decisive premise and why each distractor's changed element is wrong, using only stem/excerpt facts. No general commentary, no speculation about other effects, no claims about what the source does not say.`;

const appendSystem = (body, text) => {
  const next = structuredClone(body), system = next.input?.find(row => row.role === 'system');
  if (typeof system?.content !== 'string') throw new Error('original_author_v79_system_prompt_required');
  if (system.content.includes('Decisive-distractor construction (v7.9')) throw new Error('original_author_v79_applied_twice');
  system.content += `\n\n${ORIGINAL_AUTHOR_INSTRUCTIONS_V79}`;
  return next;
};

// Innermost layer: it receives the fully adapted V7.4/V7.6 authoring body just before dispatch and adds the V7.9 instructions.
export function createOriginalAuthorPolicyTransportV79(transport, job) {
  if (!transport || typeof transport.generate !== 'function') throw new Error('original_author_v79_transport_required');
  if (!job?.id) throw new Error('original_author_v79_job_identity_required');
  return { ...transport, async generate(provider, body, options = {}) {
    if (options.stage !== 'authoring') return transport.generate.call(transport, provider, body, options);
    const adapted = appendSystem(body, ORIGINAL_AUTHOR_INSTRUCTIONS_V79);
    const key = hashJSON({ contract: ORIGINAL_AUTHOR_POLICY_V79, parent_contract: ORIGINAL_AUTHOR_POLICY_V76, previous_key: options.key || null, job_id: job.id, body: adapted });
    return transport.generate.call(transport, provider, adapted, { ...options, key });
  } };
}

export function authorOriginalV79(authorOriginal, job, { registry, transport } = {}) {
  return authorOriginalV76(authorOriginal, job, { registry, transport: createOriginalAuthorPolicyTransportV79(transport, job) });
}
