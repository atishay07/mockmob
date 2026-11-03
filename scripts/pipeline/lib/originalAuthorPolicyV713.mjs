import { hashJSON } from '../../../data/question_factory_policy.mjs';
import { authorOriginalV79 } from './originalAuthorPolicyV79.mjs';
export const ORIGINAL_AUTHOR_POLICY_V713 = 'original-cuet-medium-first-v713';
export const AUTHOR_DEMAND_V713 = `Demand calibration: preserve the requested difficulty and report actual demand honestly. Easy is direct meaningful warm-up; medium is normal CUET demand and the main NTA practice objective, calibrated to supplied authenticated subject/format examples where available; hard requires explicitly above-normal sustained reasoning within syllabus. Do not manufacture hard difficulty with ambiguity, obscurity or length. A value-changed item is not automatically medium. Original practice must be independently constructed; never label it authentic PYQ. Medium distractors should encode plausible syllabus misconceptions, not giveaway opposites or arbitrary outside facts. Keep the explanation concise and source-supported, with no incidental speculative commentary. Preserve all inherited source/uniqueness/learning-objective/format/identity requirements. No academic gate or difficulty target can be bypassed to improve yield.`;
export function authorOriginalV713(author, job, { registry, transport } = {}) {
  if (!['easy', 'medium', 'hard'].includes(job?.difficulty)) throw Error('v713_explicit_difficulty_required');
  const layer = { ...transport, generate(provider, body, options = {}) {
    if (options.stage !== 'authoring') return transport.generate.call(transport, provider, body, options);
    const adapted = structuredClone(body), system = adapted.input?.find(r => r.role === 'system');
    if (typeof system?.content !== 'string') throw Error('v713_author_system_required');
    system.content += `\n${AUTHOR_DEMAND_V713}`;
    return transport.generate.call(transport, provider, adapted, { ...options,
      key: hashJSON({ version: ORIGINAL_AUTHOR_POLICY_V713, previous: options.key, job: job.id, body: adapted }) });
  } };
  return authorOriginalV79(author, job, { registry, transport: layer });
}
