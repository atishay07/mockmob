// End-to-end local persistence for the V716 signed-scorecard publication seam: atomic writer, receipt-only
// recovery, real table shape round trip, six/seven-score retrieval, dispute and family invalidation, whole groups.
import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { hashJSON, FACTORY_POLICY } from '../../../data/question_factory_policy.mjs';
import { contentHash, evidenceSignature } from '../../../data/content_evidence.js';
import { BLIND_SCORE_IDS_V716, deriveScorecardV716 } from '../lib/scorecardPolicyV716.mjs';
import { scorecardPromptHashV716 } from '../lib/scorecardReviewV716.mjs';
import { publicationEligibilityV716, localScorecardChecksV716 } from '../lib/verifyV716.mjs';
import { publishUnitV716, retrievePracticeV716, retrieveNtaV716 } from '../lib/publicationBridgeV716.mjs';
import { openLocalPublicationStoreV716 } from '../lib/publicationStoreV716Local.mjs';
import { FACTORY_VERIFIER_VERSION_V716, validationContractV716 } from '../lib/contractV716.mjs';

const SECRET = 'offline-v716-persistence-secret';
const facts = {
  receipts: 'Cash receipts from sale of goods and rendering of services are operating cash flows.',
  purchase: 'Cash payments to acquire fixed assets are investing cash flows.',
  dividend: 'Dividends paid to shareholders are financing cash flows.',
  passage: 'Meera Traders is a wholesale firm dealing in kitchen appliances. During the year the firm sold goods worth a large amount to retailers and received the full amount in cash at the time of sale. It also purchased a delivery van for its business and paid for it by cheque. At the end of the year the directors declared and paid a dividend to the shareholders of the company out of its profits. The accountant must now prepare the cash flow statement and classify each of these cash movements under the correct activity.',
};
const sources = Object.fromEntries(Object.entries(facts).map(([locator, text]) => [locator, hashJSON(text)]));
const registry = { version: 'registry-v716-persist', examples: [], packs: { 'pack-v716': { state: 'active', version: 1, subject: 'accountancy' } },
  families: Object.fromEntries(['fam-a', 'fam-b', 'fam-c', 'fam-g'].map(id => [id, { state: 'active', version: 1 }])),
  exam_specs: { accountancy: { state: 'verified', included_topics: ['Cash Flow Statement'], excluded_topics: [], syllabus_version: 'offline',
    pattern_version: 'offline', pattern_rules: {}, exam_rule_version: 'offline' } },
  passage_groups: { 'grp-v716': { id: 'grp-v716', state: 'active', kind: 'original_practice', candidate_ids: ['g-1', 'g-2'], passage_text: facts.passage, source_pack_id: 'pack-v716' } },
  sources: { 'source-v716': { id: 'source-v716', state: 'active', reuse_permitted: true, identity_sha256: 'e'.repeat(64), extraction_checked: true,
    version: 1, supports: sources, facts: Object.fromEntries(Object.entries(facts).map(([k, text]) => [k, { text }])), chapters: ['Cash Flow Statement'],
    kind: 'textbook', title: 'Offline source', url: 'https://example.test/v716' } } };
const manifest = { scorecard_releases: { [FACTORY_VERIFIER_VERSION_V716]: { state: 'released', validation_contract_hash: validationContractV716(),
  prompt_hash: scorecardPromptHashV716(), source_registry_version: registry.version, policy: 'cuet-scorecard-routing-v716', topology: 'dual_blind',
  critical_false_accepts: 0, valid_survival: 0.9, by_subject: Object.fromEntries(['english', 'accountancy', 'business_studies', 'economics'].map(s => [s, { valid_survival: 0.8 }])),
  benchmark: { state: 'completed', unseen_at_freeze: true, payload_hash: 'f'.repeat(64) } } } };
const context = { registry, manifest, secret: SECRET };

function candidate(id, { family = 'fam-a', locator = 'receipts', body, options, key = 'A', explanation, group = null, difficulty = 'medium', order = null }) {
  const passage = group ? facts.passage : '';
  return { id, subject: 'accountancy', chapter: 'Cash Flow Statement', family_id: family, route: group ? 'passage' : 'conceptual',
    question_type: group ? 'passage_comprehension' : 'conceptual_mcq', difficulty, body, passage_text: passage, ...(group ? { passage_group_id: group, order_index: order } : {}),
    options: options.map((text, i) => ({ key: 'ABCD'[i], text })), correct_answer: key, explanation,
    learning_objective: { syllabus_unit: 'Cash Flow Statement', objective: 'Classify cash flows by activity.', target_term: '' },
    provenance: { kind: 'original_practice', adaptation_family: family, syllabus_version: 'offline', pattern_version: 'offline', source_pack_id: 'pack-v716', source_pack_version: 1 },
    source_refs: [{ id: 'source-v716', version: 1, locator, support_hash: sources[locator] }], evidence_quotes: [facts[locator]] };
}
const stamp = { validation_contract_hash: validationContractV716(), evaluation_prompt: scorecardPromptHashV716(), prompt_version: FACTORY_VERIFIER_VERSION_V716 };
function reports(c, score, level) {
  const na = id => ['11', '12'].includes(id) || id === '15' && c.route !== 'passage';
  return ['openai', 'gemini'].map(provider => ({ ...stamp, candidate_id: c.id, content_hash: contentHash(c), provider,
    model: provider === 'openai' ? 'gpt-6-luna' : 'gemini-3.8-flash', stage: provider === 'openai' ? 'blind_solution' : 'independent_evaluation',
    solved_key: c.correct_answer, answer_set: [c.correct_answer], source_ids: ['E1.1'], derivation: 'The registered rule classifies the printed transaction.',
    options: ['A', 'B', 'C', 'D'].map(option => ({ option, status: option === c.correct_answer ? 'defensible' : 'not_answer', basis: 'excerpt', source_ids: ['E1.1'], reason: 'Checked against the rule.' })),
    academic: { syllabus_entitlement: 'supported', source_support: 'supported', decisive_assumptions: 'supported', numerical_accuracy: 'not_applicable',
      boundary_cases: 'not_applicable', passage_answerability: c.route === 'passage' ? 'supported' : 'not_applicable', completeness: 'supported', format_valid: 'supported', presentation_readable: 'supported' },
    difficulty_assessment: { level, reason: 'Independent demand assessment.', comparison_basis: 'heuristic' },
    scores: Object.fromEntries(BLIND_SCORE_IDS_V716.map(id => [id, { score: na(id) ? null : score, note: 'Evaluated.' }])), issues: [] }));
}
function audit(c, score) {
  return { ...stamp, candidate_id: c.id, content_hash: contentHash(c), provider: 'openai', model: 'gpt-6-luna', stage: 'explanation_support', answer_set: [c.correct_answer],
    explanation_status: 'supported', options_status: 'supported', source_ids: ['E1.1'],
    claims: [{ claim: c.explanation, basis: 'excerpt', status: 'supported', source_ids: ['E1.1'], reason: 'Supported by the excerpt.' }], issues: [],
    scores: Object.fromEntries(['13', '14', '17', '20'].map(id => [id, { score, note: 'Audited.' }])) };
}
// Mirrors validateFactoryCandidateV716's signed record so the round trip covers the actual record shape.
function sign(c, { score = 8, level = c.difficulty, passageGroup = null } = {}) {
  const r = reports(c, score, level), a = audit(c, score), localChecks = localScorecardChecksV716(c, registry, new Set());
  const decision = deriveScorecardV716(c, r, a, { evidenceCatalog: [{ id: 'E1.1' }], localChecks });
  assert.equal(decision.state, 'eligible', JSON.stringify(decision.reasons));
  const record = { candidate_id: c.id, content_hash: contentHash(c), state: 'eligible', policy_version: FACTORY_POLICY, verifier_version: FACTORY_VERIFIER_VERSION_V716,
    validation_contract_hash: validationContractV716(), evaluation_prompt: scorecardPromptHashV716(), scorecard_policy: 'cuet-scorecard-routing-v716', topology: 'dual_blind',
    source_registry_version: registry.version, sources: c.source_refs, family_id: c.family_id, family_version: 1, route: c.route, question_type: c.question_type,
    passage_group: passageGroup, provenance: c.provenance, author_target_difficulty: c.difficulty, difficulty_target_match: c.difficulty === decision.difficulty.level,
    verified_at: new Date().toISOString(), expires_at: new Date(Date.now() + 86400000).toISOString(), reports: r, audit: a, local_checks: localChecks, decision };
  return { ...c, evidence: { record, signature: evidenceSignature(record, SECRET) } };
}
const nta = sign(candidate('q-nta', { body: 'A trader receives cash from customers for goods sold. How is this receipt classified in the cash flow statement?',
  options: ['Operating activity', 'Investing activity', 'Financing activity', 'Not a cash flow'], explanation: 'Cash received from sale of goods is an operating cash flow.' }), { score: 8 });
const practice = sign(candidate('q-practice', { family: 'fam-b', locator: 'purchase', key: 'B',
  body: 'A company pays cash to buy new machinery for its factory. Under which activity is this payment shown?',
  options: ['Operating activity', 'Investing activity', 'Financing activity', 'Not a cash flow'], explanation: 'Payment to acquire a fixed asset is an investing cash flow.' }), { score: 6.5 });
const groupMembers = { id: 'grp-v716', member_ids: ['g-1', 'g-2'] };
const groupFirst = sign(candidate('g-1', { family: 'fam-g', locator: 'passage', group: 'grp-v716', order: 1, body: 'Based on the passage, how is the cash from selling goods classified?',
  options: ['Operating activity', 'Investing activity', 'Financing activity', 'Not a cash flow'], explanation: 'Selling goods for cash is an operating cash flow.' }), { score: 7.5, passageGroup: groupMembers });
const groupSecond = sign(candidate('g-2', { family: 'fam-g', locator: 'passage', key: 'C', group: 'grp-v716', order: 2, body: 'Based on the passage, how is the dividend paid to shareholders classified?',
  options: ['Operating activity', 'Investing activity', 'Financing activity', 'Not a cash flow'], explanation: 'Paying a dividend to shareholders is a financing cash flow.' }), { score: 7.5, passageGroup: groupMembers });

function freshStore(t, options) {
  const directory = mkdtempSync(join(tmpdir(), 'mockmob-v716-persist-'));
  const store = openLocalPublicationStoreV716(join(directory, 'store.sqlite'), options);
  t.after(() => { try { store.close(); } catch {} rmSync(directory, { recursive: true, force: true }); });
  return store;
}
const publish = (store, questions) => publishUnitV716({ questions, ...context, target: 'local', adapter: store });
const counted = store => { let writes = 0; return { adapter: { ...store, writeAtomic: async prepared => { writes++; return store.writeAtomic(prepared); } }, writes: () => writes }; };

test('V716 signed rows persist with only real columns and stay eligible after the database round trip', async t => {
  const store = freshStore(t);
  const first = await publish(store, [nta]);
  assert.equal(first.state, 'published', JSON.stringify(first));
  const second = await publish(store, [practice]);
  assert.equal(second.state, 'published', JSON.stringify(second));
  const rows = store.readRows();
  assert.equal(rows.length, 2);
  const stored = rows.find(row => row.id === 'q-nta');
  for (const field of ['route', 'source_refs', 'learning_objective', 'evidence_quotes']) assert.equal(Object.hasOwn(stored, field), false, field + ' is not a questions column');
  assert.equal(stored.status, 'live'); assert.equal(stored.verification_state, 'verified'); assert.equal(stored.quality_band, 'strong');
  assert.equal(stored.evidence.record.state, 'published');
  assert.equal(rows.find(row => row.id === 'q-practice').quality_band, 'useful');
  assert.equal(rows.find(row => row.id === 'q-practice').quality_score, 0.65);
  const ntaCheck = publicationEligibilityV716(stored, { ...context, mode: 'nta' });
  assert.equal(ntaCheck.eligible, true, JSON.stringify(ntaCheck.reasons));
  const practiceRow = rows.find(row => row.id === 'q-practice');
  assert.equal(publicationEligibilityV716(practiceRow, { ...context, mode: 'practice' }).eligible, true);
  assert.ok(publicationEligibilityV716(practiceRow, { ...context, mode: 'nta' }).reasons.includes('practice_only_below_7'));
  // Six-score practice reaches ordinary practice; only the seven-score item reaches NTA.
  const practiceSet = retrievePracticeV716(rows, { ...context, familyHolds: await store.readFamilyHolds() });
  assert.deepEqual(practiceSet.rows.map(row => row.id).sort(), ['q-nta', 'q-practice']);
  const ntaSet = retrieveNtaV716(rows, 50, { ...context, subjectId: 'accountancy', seed: 'v716-persist', familyHolds: await store.readFamilyHolds() });
  assert.deepEqual(ntaSet.selectedRows.map(row => row.id), ['q-nta'], JSON.stringify(ntaSet.scorecard_rejections));
  // A direct edit of persisted content invalidates the signed scorecard.
  store.db.prepare(`UPDATE questions SET correct_answer='B' WHERE id='q-nta'`).run();
  assert.ok(publicationEligibilityV716(store.readRows().find(row => row.id === 'q-nta'), { ...context, mode: 'practice' }).reasons.includes('content_changed'));
});

test('V716 publication is idempotent and recovers a committed-but-unacknowledged write from its receipt only', async t => {
  let crash = true;
  const store = freshStore(t, { failpoint: point => { if (point === 'after_commit' && crash) { crash = false; throw Error('simulated_crash_after_commit'); } } });
  const tracked = counted(store);
  const crashed = await publishUnitV716({ questions: [nta], ...context, target: 'local', adapter: tracked.adapter });
  assert.equal(crashed.state, 'uncertain');
  assert.equal(store.readRows().length, 1, 'the transaction committed before the simulated crash');
  const recovered = await publishUnitV716({ questions: [nta], ...context, target: 'local', adapter: tracked.adapter });
  assert.equal(recovered.state, 'published'); assert.equal(recovered.recovered, true);
  assert.equal(tracked.writes(), 1, 'an uncertain committed unit is never re-dispatched');
  const again = await publishUnitV716({ questions: [nta], ...context, target: 'local', adapter: tracked.adapter });
  assert.equal(again.state, 'published'); assert.equal(again.recovered, true);
  assert.equal(tracked.writes(), 1);
  assert.equal(store.readRows().length, 1);
});

test('V716 rolled-back writes leave nothing behind and re-dispatch only after definitive absence', async t => {
  let crash = true;
  const store = freshStore(t, { failpoint: (point, index) => { if (point === 'after_row' && index === 0 && crash) { crash = false; throw Error('simulated_crash_mid_group'); } } });
  let writes = 0;
  // The process "dies" mid-transaction: the bridge never learns that the store rolled back.
  const adapter = { ...store, writeAtomic: async prepared => { writes++; try { return await store.writeAtomic(prepared); } catch (error) { const lost = Error(error.message); throw lost; } } };
  const failed = await publishUnitV716({ questions: [groupFirst, groupSecond], ...context, target: 'local', adapter });
  assert.equal(failed.state, 'uncertain', JSON.stringify(failed).slice(0, 2000));
  assert.equal(store.db.prepare('SELECT count(*) AS n FROM questions').get().n, 0, 'no partial passage group');
  assert.equal(store.db.prepare('SELECT count(*) AS n FROM passage_groups').get().n, 0);
  const retried = await publishUnitV716({ questions: [groupFirst, groupSecond], ...context, target: 'local', adapter });
  assert.equal(retried.state, 'published', JSON.stringify(retried));
  assert.equal(writes, 2);
  const rows = store.readRows();
  assert.deepEqual(rows.map(row => row.id).sort(), ['g-1', 'g-2']);
  const group = store.db.prepare('SELECT mode_visibility FROM passage_groups WHERE id=?').get('grp-v716');
  assert.deepEqual(JSON.parse(group.mode_visibility), ['practice', 'full_mock', 'nta_mode']);
  const ntaSet = retrieveNtaV716(rows, 50, { ...context, subjectId: 'accountancy', seed: 'v716-group', familyHolds: [] });
  assert.deepEqual(ntaSet.selectedRows.map(row => row.id).sort(), ['g-1', 'g-2'], JSON.stringify(ntaSet.diagnostics).slice(0, 1500));
});

test('V716 a store-proven rollback is reported as withheld, not uncertain, and the unit can publish later', async t => {
  let reject = true;
  const store = freshStore(t, { failpoint: point => { if (point === 'before_commit' && reject) { reject = false; throw Error('simulated_constraint_violation'); } } });
  const first = await publish(store, [nta]);
  assert.equal(first.state, 'withheld');
  assert.ok(first.reasons[0].startsWith('write_rejected_before_commit:'));
  assert.equal(store.readRows().length, 0);
  const second = await publish(store, [nta]);
  assert.equal(second.state, 'published', JSON.stringify(second));
  // Malformed and unsigned-column tampering cannot abort or steer retrieval.
  const rows = store.readRows();
  const tampered = rows.map(row => ({ ...row, question_type: 'passage_comprehension' }));
  const result = retrievePracticeV716([null, ...tampered], { ...context, familyHolds: [] });
  assert.deepEqual(result.rows, []);
  assert.ok(result.scorecard_rejections.some(row => row.reasons.includes('malformed_row')));
  assert.ok(result.scorecard_rejections.some(row => row.reasons.includes('source_or_provenance_changed')));
  const rawFlag = rows.map(row => ({ ...row, is_deleted: 1 }));
  assert.deepEqual(retrievePracticeV716(rawFlag, { ...context, familyHolds: [] }).rows, []);
});

test('V716 disputes and family holds invalidate persisted rows, and one disputed child withholds the whole passage group', async t => {
  const store = freshStore(t);
  for (const unit of [[nta], [practice], [groupFirst, groupSecond]]) assert.equal((await publish(store, unit)).state, 'published');
  assert.equal(store.recordDispute({ id: 'dispute-1', questionId: 'g-2', contentHash: contentHash(groupSecond), receipt: { solved_key: 'A' } }), true);
  const rows = store.readRows();
  assert.equal(rows.some(row => row.id === 'g-2'), false, 'a disputed row is not read as live');
  const practiceSet = retrievePracticeV716(rows, { ...context, familyHolds: [] });
  assert.deepEqual(practiceSet.rows.map(row => row.id).sort(), ['q-nta', 'q-practice'], 'the surviving sibling is withheld with its group');
  assert.ok(practiceSet.scorecard_rejections.some(row => row.id === 'g-1' && row.reasons.includes('atomic_passage_group_ineligible')));
  // Even a careless read that includes the disputed row cannot pass the V716 gate.
  const raw = store.db.prepare(`SELECT * FROM questions WHERE id='g-2'`).get();
  const disputedRow = { ...raw, options: JSON.parse(raw.options), evidence: JSON.parse(raw.evidence), provenance: JSON.parse(raw.provenance), tags: JSON.parse(raw.tags), is_deleted: false };
  assert.ok(publicationEligibilityV716(disputedRow, { ...context, mode: 'practice' }).reasons.includes('question_disputed'));
  store.holdFamily('fam-a');
  const held = retrievePracticeV716(store.readRows(), { ...context, familyHolds: await store.readFamilyHolds() });
  assert.deepEqual(held.rows.map(row => row.id), ['q-practice']);
  const heldStore = freshStore(t); heldStore.holdFamily('fam-a');
  assert.equal((await publish(heldStore, [nta])).state, 'withheld');
});

test('V716 writer re-checks preconditions inside the transaction', async t => {
  const store = freshStore(t);
  const stale = { unit_key: 'v716-publication:stale', content_hash: 'c', payload_hash: 'p', preconditions: { inventory_version: 'stale-version' },
    rows: [{ id: 'x', author_id: 'a', subject: 'accountancy', chapter: 'Cash Flow Statement', body: 'b', correct_answer: 'A', difficulty: 'medium', tags: [] }], group: null };
  await assert.rejects(() => store.writeAtomic(stale), /precondition_changed/);
  assert.equal(store.db.prepare('SELECT count(*) AS n FROM questions').get().n, 0);
  const wrongShape = { ...stale, preconditions: { inventory_version: store.inventoryVersion() }, rows: [{ ...stale.rows[0], route: 'conceptual' }] };
  await assert.rejects(() => store.writeAtomic(wrongShape), /non_column_field:route/);
});
