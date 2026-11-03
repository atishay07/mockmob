import { hashJSON } from '../../../data/question_factory_policy.mjs';
import { responseJSON } from './factoryTransport.mjs';

export const ORIGINAL_AUTHOR_POLICY_V74 = 'original-practice-source-explanations-v74';

export const ORIGINAL_AUTHOR_INSTRUCTIONS_V74 = `Student-facing explanation and source-use contract:
- Keep every supplied reference excerpt available while solving. Do not summarize away a definition, decisive rule, formula, exception, boundary, or explicit assumption needed to establish the key or assess an option. Use the exact stem values and show arithmetic where calculation decides the answer.
- Write the explanation for a student. Never include page, column, locator, source ID, URL, publisher, or evidence-catalog metadata in it. Keep source identity and locator data in the request's references/evidence metadata; use evidence_quotes for exact proof text.
- Explain the keyed option from the applicable definition, rule, explicit stem assumption, or calculation. Choose distractors only when their actual error is supported by the excerpt, stem, or calculation. Do not treat lack of support as proof that an option is false. Do not invent broad negative claims, exceptions, or generalizations; abstain if a unique defensible item cannot be built.
- Preserve the requested idea, format, chapter, difficulty, passage, four distinct options, answer-position request, and all job identity fields. Solve before ordering options. Never change the true key to satisfy a requested position.
- Keep evidence quotes exact and source-complete. Do not fabricate a claim to fill an explanation or option-analysis slot. Set abstain=true and provide a concise abstention_reason when the supplied evidence cannot support a unique, defensible item; otherwise set abstain=false and abstention_reason to an empty string.`;

function cloneJson(value) {
  return JSON.parse(JSON.stringify(value));
}

function readAuthorRequest(body, job) {
  if (!body || !Array.isArray(body.input) || body.input.length < 2 ||
      body.input[0]?.role !== 'system' || body.input[1]?.role !== 'user' ||
      typeof body.input[0].content !== 'string' || typeof body.input[1].content !== 'string') {
    throw new Error('original_author_v74_request_shape_required');
  }
  let input;
  try { input = JSON.parse(body.input[1].content); }
  catch { throw new Error('original_author_v74_json_input_required'); }
  if (input.job_id !== job.id || input.subject !== job.subject || input.chapter !== job.chapter) {
    throw new Error('original_author_v74_identity_mismatch');
  }
  if (!Array.isArray(input.references) || input.references.length === 0 || input.references.some(ref =>
      typeof ref?.id !== 'string' || typeof ref?.locator !== 'string' || typeof ref?.text !== 'string' || !ref.text.trim())) {
    throw new Error('original_author_v74_complete_references_required');
  }
  return input;
}

export function adaptOriginalAuthorRequestV74(body, job) {
  if (!job?.id || !job?.subject || !job?.chapter) throw new Error('original_author_v74_job_identity_required');
  const adapted = cloneJson(body);
  const input = readAuthorRequest(adapted, job);
  input.authoring_policy = {
    contract: ORIGINAL_AUTHOR_POLICY_V74,
    reference_count: input.references.length,
    source_text_complete: true,
  };
  adapted.input[0].content = `${adapted.input[0].content}\n\n${ORIGINAL_AUTHOR_INSTRUCTIONS_V74}`;
  adapted.input[1].content = JSON.stringify(input);
  return adapted;
}

export class OriginalAuthorAbstentionV74 extends Error {
  constructor(candidate, response, jobId) {
    const reason = typeof candidate?.abstention_reason === 'string' ? candidate.abstention_reason.trim() : '';
    super(reason ? `original_author_abstained:${reason}` : 'original_author_abstained');
    this.name = 'OriginalAuthorAbstentionV74';
    this.code = 'original_author_abstained';
    this.candidate = candidate;
    this.provider_response = response;
    this.candidate_id = jobId;
  }
}

function addAbstentionSchema(body) {
  const schema = body?.text?.format?.schema;
  if (!schema || schema.type !== 'object' || schema.additionalProperties !== false || !schema.properties || !Array.isArray(schema.required)) {
    throw new Error('original_author_v74_schema_shape_required');
  }
  const next = cloneJson(body);
  const target = next.text.format.schema;
  target.properties.abstain = { type: 'boolean' };
  target.properties.abstention_reason = { type: 'string' };
  for (const key of ['abstain', 'abstention_reason']) if (!target.required.includes(key)) target.required.push(key);
  return next;
}

export function createOriginalAuthorPolicyTransportV74(transport, job, { detectAbstention = false } = {}) {
  if (!transport || typeof transport.generate !== 'function') throw new Error('original_author_v74_transport_required');
  if (!job?.id) throw new Error('original_author_v74_job_identity_required');
  return {
    ...transport,
    async generate(provider, body, options = {}) {
      if (options.stage !== 'authoring') return transport.generate.call(transport, provider, body, options);
      let adaptedBody = adaptOriginalAuthorRequestV74(body, job);
      if (detectAbstention) adaptedBody = addAbstentionSchema(adaptedBody);
      const key = hashJSON({
        contract: ORIGINAL_AUTHOR_POLICY_V74,
        previous_key: options.key || null,
        job_id: job.id,
        subject: job.subject,
        chapter: job.chapter,
        body: adaptedBody,
      });
      const response = await transport.generate.call(transport, provider, adaptedBody, { ...options, key });
      if (detectAbstention) {
        const candidate = responseJSON(response);
        if (candidate?.abstain === true) throw new OriginalAuthorAbstentionV74(candidate, response, job.id);
        if (candidate?.abstain !== false || typeof candidate?.abstention_reason !== 'string') {
          throw new Error('original_author_v74_abstention_fields_required');
        }
      }
      return response;
    },
  };
}

export async function authorOriginalV74(authorOriginal, job, { registry, transport } = {}) {
  if (typeof authorOriginal !== 'function') throw new Error('original_author_v74_author_required');
  const adaptedTransport = createOriginalAuthorPolicyTransportV74(transport, job, { detectAbstention: true });
  return authorOriginal(job, { registry, transport: adaptedTransport });
}
