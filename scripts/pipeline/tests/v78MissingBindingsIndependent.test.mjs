import test from 'node:test';
import assert from 'node:assert/strict';
import { contentHash } from '../../../data/content_evidence.js';
import { hashJSON } from '../../../data/question_factory_policy.mjs';
import { V78_PROMPT_HASH } from '../lib/factoryEvidenceV78.mjs';
import { FACTORY_VERIFIER_VERSION_V78, validationContractV78 } from '../lib/contractV78.mjs';
import { verifyCandidateV78 } from '../lib/verifyV78.mjs';

const secret = 'missing-v78-binding-local-test';
const text = 'Cash receipts from sale of goods are operating activities.';
const source = 'binding-test-source', family = 'binding-test-family', pack = 'binding-test-pack';
const candidate = {
  id: 'v78-missing-binding', subject: 'accountancy', chapter: 'Cash Flow Statement', family_id: family,
  route: 'conceptual', question_type: 'conceptual_mcq', difficulty: 'easy',
  body: 'A retailer receives cash from customers for goods sold. Which activity is this?',
  options: ['Operating activity.', 'Investing activity.', 'Financing activity.', 'No cash flow.'],
  correct_answer: 'A', explanation: 'Cash from sales is an operating activity.',
  learning_objective: { syllabus_unit: 'Cash Flow Statement', objective: 'Classify operating cash receipts.', target_term: 'cash receipts' },
  provenance: { kind: 'original_practice', adaptation_family: family, syllabus_version: 'offline-syllabus', pattern_version: 'offline-pattern', source_pack_id: pack, source_pack_version: 1 },
  source_refs: [{ id: source, version: 1, locator: 'excerpt', support_hash: hashJSON(text) }],
};
const registry = {
  version: 'offline-binding-test', examples: [],
  families: { [family]: { state: 'active', version: 1 } },
  packs: { [pack]: { state: 'active', version: 1, subject: 'accountancy' } },
  exam_specs: { accountancy: { state: 'verified', syllabus_version: 'offline-syllabus', pattern_version: 'offline-pattern', included_topics: ['Cash Flow Statement'], excluded_topics: [], pattern_rules: {}, exam_rule_version: 'offline' } },
  sources: { [source]: { state: 'active', reuse_permitted: true, identity_sha256: 'a'.repeat(64), extraction_checked: true, version: 1,
    supports: { excerpt: hashJSON(text) }, facts: { excerpt: { text } }, chapters: ['Cash Flow Statement'], kind: 'textbook' } },
};

for (const missing of ['prompt_version', 'validation_contract_hash', 'evaluation_prompt']) {
  test(`verifyCandidateV78 rejects a verdict missing ${missing} before later stages`, async () => {
    const content_hash = contentHash(candidate);
    const result = await verifyCandidateV78(candidate, {
      registry, secret, seen: new Set(), ledger: { getCache: () => null, setCache: () => {} },
      adapters: {
        source_support: async () => {
          const verdict = { candidate_id: candidate.id, content_hash, passed: true,
            prompt_version: FACTORY_VERIFIER_VERSION_V78, validation_contract_hash: validationContractV78(), evaluation_prompt: V78_PROMPT_HASH };
          delete verdict[missing];
          return verdict;
        },
      },
    });
    assert.equal(result.state, 'quarantined');
    assert.deepEqual(result.reasons, ['unbound_v78_verdict:source_support']);
  });
}
