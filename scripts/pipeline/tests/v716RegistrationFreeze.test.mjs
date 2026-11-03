// Registration integrity: the V716 study binds a real execution freeze, a frozen case file and a separately held
// independent-answer custody file. Boolean custody claims alone are refused.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { hashJSON } from '../../../data/question_factory_policy.mjs';
import { assertRegistrationV716 } from '../lib/campaignSessionV716.mjs';
import { buildExecutionFreezeV716, assertExecutionFreezeV716, dependencyClosureV716 } from '../lib/executionFreezeV716.mjs';
import { validationContractV716, FACTORY_VERIFIER_VERSION_V716 } from '../lib/contractV716.mjs';
import { scorecardPromptHashV716 } from '../lib/scorecardReviewV716.mjs';

const sha = bytes => createHash('sha256').update(bytes).digest('hex');
const at = offset => new Date(Date.now() + offset).toISOString();
function fixture({ caseCreated = at(1000), custodyCreated = at(2000), leak = false, custodyIds = null } = {}) {
  const files = new Map();
  const put = (path, value) => { const bytes = Buffer.from(JSON.stringify(value)); files.set(path, bytes); return sha(bytes); };
  const freeze = buildExecutionFreezeV716({ createdAt: at(0) });
  const freezeSha = put('virtual/freeze.json', freeze);
  const candidate = { id: 'q-1', subject: 'english', body: 'Choose the synonym of RESOLUTE.', correct_answer: 'A' };
  const casesSha = put('virtual/cases.json', { created_at: caseCreated, cases: [{ id: 'q-1', subject: 'english', candidate: leak ? { ...candidate } : candidate, ...(leak ? { expected_valid: true } : {}) }] });
  const custodySha = put('virtual/custody.json', { created_at: custodyCreated, answers: (custodyIds || ['q-1']).map(id => ({ id, expected_valid: true, independent_key: 'A' })) });
  const prices = { expires_at: at(86400000), models: { 'gpt-6-luna': { max_input_tokens: 10, input_per_million: 1, output_per_million: 1 }, 'gemini-3.8-flash': { max_input_tokens: 10, input_per_million: 1, output_per_million: 1 } } };
  const registry = { version: 'r' }, preflight = { marker: 'not-reached-unless-bindings-pass' };
  const registration = { id: 'study', profile: FACTORY_VERIFIER_VERSION_V716, contract_hash: validationContractV716(), prompt_hash: scorecardPromptHashV716(),
    registry_hash: hashJSON(registry), pricing_hash: hashJSON(prices), jobs: [{ id: 'q-1', candidate_hash: hashJSON(candidate) }], cap_usd: 1, qualification: true,
    publication: 'never', max_repairs: 0, standard_full_bound_usd: 1, budget_stop_possible: true, input_byte_bound: 33024, full_retry_bounds: true,
    unseen_at_freeze: true, independent_answer_custody_hash: custodySha, execution_freeze: { path: 'virtual/freeze.json', sha256: freezeSha },
    cases: { path: 'virtual/cases.json', sha256: casesSha }, custody: { path: 'virtual/custody.json' }, preflight_hash: 'x' };
  const readFile = path => files.has(path) ? files.get(path) : readFileSync(path);
  return { registration, registry, prices, preflight, readFile, files };
}
const check = f => () => assertRegistrationV716(f.registration, f.registry, f.prices, f.preflight, { readFile: f.readFile });

test('V716 freeze covers the whole reachable module closure of the session, review, publication and runner', () => {
  const closure = dependencyClosureV716();
  for (const file of ['scripts/pipeline/lib/scorecardPolicyV716.mjs', 'scripts/pipeline/lib/difficultyPolicyV713.mjs', 'scripts/pipeline/lib/factoryTransportV713.mjs',
    'scripts/pipeline/lib/factoryEvidenceV76.mjs', 'data/content_evidence.js', 'data/nta_question_selector.js', 'scripts/pipeline/tools/runQualificationV716.mjs',
    'scripts/pipeline/lib/publicationStoreV716Local.mjs']) assert.ok(closure.includes(file), file);
});

test('V716 registration passes its bindings with real freeze, cases and custody artifacts', () => {
  const f = fixture();
  assert.throws(check(f), /v716_sealed_preflight_required/, 'every artifact binding passed and only the deliberately absent preflight seal remains');
});

test('V716 registration refuses a changed freeze file or a changed frozen dependency', () => {
  const f = fixture();
  f.registration.execution_freeze.sha256 = '0'.repeat(64);
  assert.throws(check(f), /execution_freeze_changed/);
  const g = fixture(), freeze = JSON.parse(g.files.get('virtual/freeze.json'));
  freeze.files['scripts/pipeline/lib/scorecardPolicyV716.mjs'] = '1'.repeat(64);
  const bytes = Buffer.from(JSON.stringify(freeze)); g.files.set('virtual/freeze.json', bytes); g.registration.execution_freeze.sha256 = sha(bytes);
  assert.throws(() => assertExecutionFreezeV716('virtual/freeze.json', sha(bytes), { readFile: g.readFile }), /execution_dependency_changed/);
});

test('V716 qualification refuses changed custody, mismatched membership, leaked labels and pre-freeze cases', () => {
  const changed = fixture(); changed.registration.independent_answer_custody_hash = '2'.repeat(64);
  assert.throws(check(changed), /independent_custody_changed/);
  assert.throws(check(fixture({ custodyIds: ['q-1', 'q-2'] })), /case_custody_membership_mismatch/);
  assert.throws(check(fixture({ leak: true })), /cases_file_leaks_custody/);
  assert.throws(check(fixture({ caseCreated: at(-60000) })), /predate_freeze/);
  const boolOnly = fixture(); delete boolOnly.registration.custody;
  assert.throws(check(boolOnly), /independent_custody_changed/);
});
