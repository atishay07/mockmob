import test from 'node:test';
import assert from 'node:assert/strict';
import { hashJSON, FACTORY_POLICY } from '../../../data/question_factory_policy.mjs';
import { contentHash, evidenceSignature } from '../../../data/content_evidence.js';
import { BLIND_SCORE_IDS_V716, QUALITY_DIMENSIONS_V716, CRAFT_IDS_V716, deriveScorecardV716 } from '../lib/scorecardPolicyV716.mjs';
import { createScorecardReviewV716, scorecardPromptHashV716 } from '../lib/scorecardReviewV716.mjs';
import { scorecardSchemaV716, BLIND_PROMPT_V716, AUDIT_PROMPT_V716 } from '../lib/scorecardPromptV716.mjs';
import { publicationEligibilityV716, localScorecardChecksV716 } from '../lib/verifyV716.mjs';
import { filterPracticeRowsV716, rankPracticeRowsV716, selectNtaQuestionSetV716 } from '../lib/practiceSelectionV716.mjs';
import { FACTORY_VERIFIER_VERSION_V716, validationContractV716 } from '../lib/contractV716.mjs';

const SECRET = 'offline-v716-scorecard-regression-secret';
const fullSource = 'Cash receipts from sale of goods and rendering of services are operating cash flows.';
const sourceHash = hashJSON(fullSource);
function makeCandidate({ id = 'v716-policy-case', difficulty = 'medium', route = 'conceptual', key = 'A', body = 'A retailer receives cash from customers for goods sold. How should the receipt be classified?' } = {}) {
  return { id, subject: 'accountancy', chapter: 'Cash Flow Statement', family_id: 'family-v716', route,
    question_type: route === 'passage' ? 'passage_comprehension' : 'conceptual_mcq', difficulty,
    body,
    passage_text: route === 'passage' ? 'The retailer received cash from customers for goods sold.' : '',
    options: [{ key: 'A', text: 'Operating activity.' }, { key: 'B', text: 'Investing activity.' },
      { key: 'C', text: 'Financing activity.' }, { key: 'D', text: 'No cash flow.' }], correct_answer: key,
    explanation: 'Cash received from customers for goods sold is an operating activity.',
    learning_objective: { syllabus_unit: 'Cash Flow Statement', objective: 'Classify operating cash receipts from sales of goods.', target_term: '' },
    provenance: { kind: 'original_practice', adaptation_family: 'family-v716', syllabus_version: 'offline', pattern_version: 'offline',
      source_pack_id: 'pack-v716', source_pack_version: 1 },
    status: 'active', verification_state: 'verified', quality_band: 'strong', anchor_tier: 1,
    source_refs: [{ id: 'source-v716', version: 1, locator: 'excerpt', support_hash: sourceHash }], evidence_quotes: [fullSource] };
}
function makeRegistry() {
  return { version: 'registry-v716-offline', examples: [], packs: { 'pack-v716': { state: 'active', version: 1, subject: 'accountancy' } },
    families: { 'family-v716': { state: 'active', version: 1 } },
    exam_specs: { accountancy: { state: 'verified', included_topics: ['Cash Flow Statement'], excluded_topics: [], syllabus_version: 'offline',
      pattern_version: 'offline', pattern_rules: {}, exam_rule_version: 'offline' } },
    sources: { 'source-v716': { id: 'source-v716', state: 'active', reuse_permitted: true, identity_sha256: 'e'.repeat(64), extraction_checked: true,
      version: 1, supports: { excerpt: sourceHash }, facts: { excerpt: { text: fullSource } }, chapters: ['Cash Flow Statement'], kind: 'textbook',
      title: 'Offline source', url: 'https://example.test/v716' } } };
}
function localChecks({ numeric = false } = {}) {
  return { structure: true, presentation: true, provenance: true, syllabus_registry: true, source_integrity: true, novelty: true, numeric_required: numeric };
}
function blindScores(value, candidate) {
  return Object.fromEntries(BLIND_SCORE_IDS_V716.map(id => {
    const na = ['11', '12'].includes(id) && !['numerical', 'calculation'].includes(candidate.route) || id === '15' && candidate.route !== 'passage';
    return [id, { score: na ? null : value, note: na ? 'Not applicable to this item.' : `Score ${value}: evaluated this dimension.` }];
  }));
}
function blindReport(candidate, provider, { score = 8, solved = candidate.correct_answer, answerSet = [solved], optionOverrides = {}, issue = null, difficulty = candidate.difficulty } = {}) {
  const id = candidate.id, hash = contentHash(candidate), stage = provider === 'openai' ? 'blind_solution' : 'independent_evaluation';
  return { candidate_id: id, content_hash: hash, provider, model: provider === 'openai' ? 'gpt-6-luna' : 'gemini-3.8-flash', stage,
    solved_key: solved, answer_set: answerSet, source_ids: ['E1.1'], derivation: 'The printed application and registered rule support the selected classification.',
    options: ['A', 'B', 'C', 'D'].map(option => ({ option,
      status: option === solved ? 'defensible' : 'not_answer', basis: 'excerpt', source_ids: ['E1.1'],
      reason: 'The registered rule supports or excludes this full option in the printed context.', ...(optionOverrides[option] || {}) })),
    academic: { syllabus_entitlement: 'supported', source_support: 'supported', decisive_assumptions: 'supported', numerical_accuracy: 'not_applicable',
      boundary_cases: 'not_applicable', passage_answerability: candidate.route === 'passage' ? 'supported' : 'not_applicable', completeness: 'supported',
      format_valid: 'supported', presentation_readable: 'supported' },
    difficulty_assessment: { level: difficulty, reason: 'Independent demand assessment from the actual task.', comparison_basis: 'heuristic' },
    scores: blindScores(score, candidate), issues: issue ? [issue] : [] };
}
function auditReport(candidate, { score = 8, answerSet = [candidate.correct_answer], claimStatus = 'supported', issue = null } = {}) {
  return { candidate_id: candidate.id, content_hash: contentHash(candidate), provider: 'openai', model: 'gpt-6-luna', stage: 'explanation_support',
    answer_set: answerSet, explanation_status: 'supported', options_status: 'supported', source_ids: ['E1.1'],
    claims: [{ claim: candidate.explanation, basis: 'excerpt', status: claimStatus, source_ids: ['E1.1'], reason: 'The registered source supports this explanation claim.' }],
    issues: issue ? [issue] : [], scores: Object.fromEntries(['13', '14', '17', '20'].map(id => [id, { score, note: `Audit score ${score}: checked this dimension.` }])) };
}
function derive(candidate, { score = 8, reports, audit, checks = localChecks() } = {}) {
  return deriveScorecardV716(candidate, reports || [blindReport(candidate, 'openai', { score }), blindReport(candidate, 'gemini', { score })],
    audit || auditReport(candidate, { score }), { evidenceCatalog: [{ id: 'E1.1' }], localChecks: checks });
}

test('V716 routes by the unrounded five-dimension craft mean at exact boundaries', () => {
  const c = makeCandidate();
  for (const [value, state, band, nta] of [[5.999, 'quarantined', 'below_practice_quality', false], [6, 'eligible', 'practice_only', false],
    [6.999, 'eligible', 'practice_only', false], [7, 'eligible', 'nta_eligible', true]]) {
    const result = derive(c, { score: value });
    assert.equal(result.quality_score, value, JSON.stringify(result));
    assert.equal(result.state, state);
    assert.equal(result.route_band, band);
    assert.equal(result.modes.nta, nta);
  }
});

test('V716 practice selector entrypoint imports and handles an empty eligible set', () => {
  const result = rankPracticeRowsV716([], { mode: { id: 'full_mock' } });
  assert.ok(Array.isArray(result.rows));
  assert.deepEqual(result.rows, []);
  assert.deepEqual(result.scorecard_rejections, []);
});

test('V716 reports all 20 parameters, excludes N/A and mandatory correctness dimensions from the craft composite', () => {
  const c = makeCandidate(), result = derive(c, { score: 8 });
  assert.equal(result.criteria.length, 20);
  assert.deepEqual(result.composite_basis, ['3', '4', '6', '17', '18']);
  assert.equal(result.quality_score, 8);
  assert.equal(result.criteria.find(row => row.id === '19').score, 8, 'novelty remains reported feedback');
  assert.equal(result.composite_basis.includes('19'), false, 'novelty feedback cannot inflate craft quality');
  assert.equal(result.criteria.find(row => row.id === '7').score, 10, 'answer accuracy is reported from key agreement, not averaged into craft');
  for (const id of ['11', '12', '15']) {
    const row = result.criteria.find(item => item.id === id);
    assert.equal(row.applicable, false);
    assert.equal(row.score, null, 'N/A must not become an artificial ten in the reported mean');
  }
  assert.ok(result.reported_mean > result.quality_score, 'the full report mean remains separate from the craft score');
});

test('V716 allows excellent easy questions without treating difficulty as a quality band', () => {
  const c = makeCandidate({ difficulty: 'easy' });
  const result = derive(c, { score: 9 });
  assert.equal(result.state, 'eligible');
  assert.equal(result.quality_score, 9);
  assert.equal(result.difficulty.level, 'easy');
  assert.equal(result.modes.nta, true);
});

test('V716 mandatory answer, rival, source and audit failures override perfect scores', () => {
  const c = makeCandidate(), high = 10;
  const cases = [
    { label: 'wrong key', reports: [blindReport(c, 'openai', { score: high, solved: 'B', answerSet: ['B'] }), blindReport(c, 'gemini', { score: high })] },
    { label: 'two answers', reports: [blindReport(c, 'openai', { score: high, answerSet: ['A', 'B'] }), blindReport(c, 'gemini', { score: high })] },
    { label: 'unresolved rival', reports: [blindReport(c, 'openai', { score: high, optionOverrides: { B: { status: 'unresolved' } } }), blindReport(c, 'gemini', { score: high })] },
    { label: 'missing excerpt source id', reports: [blindReport(c, 'openai', { score: high, optionOverrides: { B: { source_ids: [] } } }), blindReport(c, 'gemini', { score: high })] },
    { label: 'unsupported explanation claim', audit: auditReport(c, { score: high, claimStatus: 'unsupported' }) },
    { label: 'wrong audit answer set', audit: auditReport(c, { score: high, answerSet: ['A', 'B'] }) },
  ];
  for (const item of cases) {
    const result = derive(c, { score: high, reports: item.reports, audit: item.audit });
    assert.equal(result.state, 'quarantined', item.label);
    assert.equal(result.quality_score, null, `${item.label} cannot be rescued by ten-point ratings`);
  }
});

test('V716 treats a source-backed classification as a legitimate skill, but keeps V75 B/D unresolved blocking', () => {
  const classification = makeCandidate({ id: 'v716-classification' });
  assert.equal(derive(classification, { score: 8 }).academic_sound, true,
    'the report may derive functional structure from printed departments through the supplied rule');
  const c = makeCandidate({ id: 'v75f-825e60a00f', key: 'D' });
  const reports = [blindReport(c, 'openai', { solved: 'D', answerSet: ['B', 'D'], optionOverrides: { B: { status: 'unresolved' } } }),
    blindReport(c, 'gemini', { solved: 'D', answerSet: ['D', 'B'], optionOverrides: { B: { status: 'unresolved' } } })];
  const result = derive(c, { reports });
  assert.equal(result.state, 'quarantined');
  assert.ok(result.reasons.some(reason => /not_one_defensible_answer|unresolved_or_defensible_rival/.test(reason)));
});

test('V716 blocks a source-ID-only explanation audit when a claim is unsupported', () => {
  const c = makeCandidate();
  const result = derive(c, { score: 10, audit: auditReport(c, { score: 10, claimStatus: 'unsupported' }) });
  assert.equal(result.state, 'quarantined');
  assert.ok(result.reasons.includes('explanation_claim_unsupported'));
});

test('V716 treats malformed empty issue details as incomplete evidence', () => {
  const c = makeCandidate();
  const reports = [blindReport(c, 'openai', { issue: { category: 'ambiguous', detail: '' } }), blindReport(c, 'gemini')];
  const result = derive(c, { reports });
  assert.equal(result.state, 'error');
  assert.equal(result.academic_sound, null);
  assert.ok(result.reasons.includes('issue_format_invalid:blind_solution'));
  const audit = auditReport(c, { issue: { category: 'unsupported', detail: '' } });
  const audited = derive(c, { audit });
  assert.equal(audited.state, 'error');
  assert.equal(audited.academic_sound, null);
  assert.ok(audited.reasons.includes('audit_issue_format_invalid'));
});

test('V716 classifies malformed blind review records as incomplete evidence, not academic rejection', () => {
  const c = makeCandidate();
  const malformed = [
    ['missing score', report => { delete report.scores['3']; }, /score_format_invalid:blind_solution/],
    ['missing option', report => { report.options.pop(); }, /option_format_invalid:blind_solution/],
    ['missing difficulty', report => { delete report.difficulty_assessment; }, /difficulty_report_format_invalid:blind_solution/],
    ['wrong identity', report => { report.candidate_id = 'other-candidate'; }, /report_binding_invalid:blind_solution/],
    ['nonstring option reason', report => { report.options[0].reason = 42; }, /option_format_invalid:blind_solution/],
  ];
  for (const [label, mutate, reason] of malformed) {
    const reports = [blindReport(c, 'openai'), blindReport(c, 'gemini')];
    mutate(reports[0]);
    const result = derive(c, { reports });
    assert.equal(result.state, 'error', label);
    assert.equal(result.academic_sound, null, label);
    assert.ok(result.reasons.some(value => reason.test(value)), label);
  }
  const ambiguous = [blindReport(c, 'openai', { optionOverrides: { B: { status: 'unresolved' } } }), blindReport(c, 'gemini')];
  const academic = derive(c, { reports: ambiguous });
  assert.equal(academic.state, 'quarantined');
  assert.equal(academic.academic_sound, false);
  assert.ok(academic.reasons.includes('unresolved_or_defensible_rival:blind_solution:B'));
});

test('V716 keeps independent difficulty assessments separate and routes by the confirmed band, not the author target', () => {
  const hard = makeCandidate({ difficulty: 'hard' });
  const agreement = derive(hard, { reports: [blindReport(hard, 'openai', { score: 9, difficulty: 'hard' }),
    blindReport(hard, 'gemini', { score: 9, difficulty: 'hard' })] });
  assert.equal(agreement.difficulty.level, 'hard');
  assert.equal(agreement.difficulty.agreement, true);
  const disagreement = derive(hard, { reports: [blindReport(hard, 'openai', { score: 9, difficulty: 'hard' }),
    blindReport(hard, 'gemini', { score: 9, difficulty: 'medium' })] });
  assert.equal(disagreement.state, 'quarantined');
  assert.equal(disagreement.outcome, 'routing_hold');
  assert.equal(disagreement.academic_sound, true, 'an unconfirmed Hard band is a routing hold, not an academic rejection');
  assert.ok(disagreement.reasons.includes('hard_demand_not_independently_confirmed'));
  const mismatch = makeCandidate({ difficulty: 'medium' });
  const wrongTarget = derive(mismatch, { reports: [blindReport(mismatch, 'openai', { score: 9, difficulty: 'easy' }),
    blindReport(mismatch, 'gemini', { score: 9, difficulty: 'easy' })] });
  assert.equal(wrongTarget.state, 'eligible');
  assert.equal(wrongTarget.difficulty.level, 'easy', 'both reviewers confirm Easy, so it is routed as Easy');
  const mixed = derive(mismatch, { reports: [blindReport(mismatch, 'openai', { score: 9, difficulty: 'easy' }),
    blindReport(mismatch, 'gemini', { score: 9, difficulty: 'medium' })] });
  assert.equal(mixed.difficulty.level, 'medium', 'Easy/Medium disagreement takes the more demanding non-Hard band');
});

test('V716 local policy decides which reported issue categories block; advisory notes stay feedback', () => {
  const c = makeCandidate();
  const advisory = derive(c, { reports: [blindReport(c, 'openai', { issue: { category: 'craft_suggestion', detail: 'Option D could be more plausible.' } }),
    blindReport(c, 'gemini')], audit: auditReport(c, { issue: { category: 'presentation_suggestion', detail: 'Shorter explanation possible.' } }) });
  assert.equal(advisory.state, 'eligible', JSON.stringify(advisory.reasons));
  assert.equal(advisory.advisory_issues.length, 2);
  for (const category of ['ambiguous_wording', 'missing_decisive_input', 'false_or_unsupported_fact', 'off_syllabus']) {
    const blocked = derive(c, { score: 10, reports: [blindReport(c, 'openai', { score: 10 }), blindReport(c, 'gemini', { score: 10, issue: { category, detail: 'Concrete defect.' } })] });
    assert.equal(blocked.state, 'quarantined', category);
    assert.equal(blocked.academic_sound, false, category);
    assert.ok(blocked.reasons.includes('reported_academic_issue:independent_evaluation:' + category));
  }
  const unknown = derive(c, { reports: [blindReport(c, 'openai', { issue: { category: 'vibes', detail: 'Unclear.' } }), blindReport(c, 'gemini')] });
  assert.equal(unknown.state, 'error', 'an off-schema category is incomplete evidence, not a rejection');
  const duplicate = derive(c, { checks: { ...localChecks(), novelty: false } });
  assert.equal(duplicate.outcome, 'duplicate_idea');
  assert.equal(duplicate.academic_sound, null);
});

function requestBody(provider, body) { return provider === 'openai' ? JSON.parse(body.input.find(row => row.role === 'user').content)
  : JSON.parse(body.contents[0].parts[0].text); }
function syntheticReviewResponse(candidate, input, provider, stage) {
  const catalogId = input.evidence_catalog[0]?.id || 'E1.1';
  if (stage === 'explanation_support') return { candidate_id: input.candidate_id, content_hash: input.content_hash, answer_set: [candidate.correct_answer],
    explanation_status: 'supported', options_status: 'supported', source_ids: [catalogId],
    claims: [{ claim: candidate.explanation, status: 'supported', source_ids: [catalogId], reason: 'The supplied source confirms this explanation.' }],
    issues: [], scores: Object.fromEntries(['13', '14', '17', '20'].map(id => [id, { score: 8, note: 'Checked and supported.' }])) };
  const report = blindReport(candidate, provider, { score: 8, solved: candidate.correct_answer, answerSet: [candidate.correct_answer] });
  report.candidate_id = input.candidate_id; report.content_hash = input.content_hash;
  report.source_ids = [catalogId];
  report.options = report.options.map(row => ({ ...row, source_ids: [catalogId] }));
  return report;
}

test('V716 blind reports omit key/explanation, freeze two decisions before audit, and carry current profile stamps', async () => {
  const candidate = makeCandidate(), registry = makeRegistry(), cache = new Map(), frozen = [], requests = [];
  let frozenDone = false;
  const ledger = { getCache: key => cache.get(key) ?? null, setCache: (key, value) => cache.set(key, structuredClone(value)) };
  const transport = { async generate(provider, body, options = {}) {
    const input = requestBody(provider, body); requests.push({ stage: options.stage, provider, input });
    if (options.stage !== 'explanation_support') {
      assert.equal(Object.hasOwn(input, 'correct_answer'), false);
      assert.equal(Object.hasOwn(input, 'proposed_key'), false);
      assert.equal(Object.hasOwn(input, 'explanation'), false);
      assert.equal(Object.hasOwn(input, 'proposed_explanation'), false);
      assert.equal(input.body, candidate.body);
      assert.notEqual(JSON.stringify(input).includes(candidate.explanation), true);
    } else assert.equal(frozenDone, true, 'audit cannot run until the two reports have been frozen');
    const raw = syntheticReviewResponse(candidate, input, provider, options.stage);
    return { output_text: JSON.stringify(raw) };
  } };
  const reviewer = createScorecardReviewV716({ registry, ledger, transport });
  const outcome = await reviewer.review(candidate, { onBlindFrozen: async record => {
    assert.equal(record.reports.length, 2); frozen.push(record); frozenDone = true;
  } });
  assert.deepEqual(outcome.reports.map(row => row.stage), ['blind_solution', 'independent_evaluation']);
  assert.deepEqual(outcome.reports.map(row => row.provider), ['openai', 'gemini']);
  assert.ok([...outcome.reports, outcome.audit].every(row => row.validation_contract_hash === validationContractV716() &&
    row.evaluation_prompt === scorecardPromptHashV716() && row.prompt_version === FACTORY_VERIFIER_VERSION_V716));
  assert.equal(requests.length, 3);
  assert.equal(frozen.length, 1);
  const auditInput = requests.find(row => row.stage === 'explanation_support').input;
  assert.equal(auditInput.proposed_key, candidate.correct_answer);
  assert.equal(auditInput.proposed_explanation, candidate.explanation);
  assert.equal(auditInput.frozen_reports.length, 2);
});

test('V716 malformed blind records stop before explanation audit dispatch', async () => {
  const candidate = makeCandidate(), registry = makeRegistry(), cache = new Map(), stages = [];
  const ledger = { getCache: key => cache.get(key) ?? null, setCache: (key, value) => cache.set(key, structuredClone(value)) };
  const transport = { async generate(provider, body, options = {}) {
    stages.push(options.stage);
    const input = requestBody(provider, body);
    return { output_text: JSON.stringify({ candidate_id: input.candidate_id, content_hash: input.content_hash }) };
  } };
  const reviewer = createScorecardReviewV716({ registry, ledger, transport });
  const outcome = await reviewer.review(candidate, { onBlindFrozen: async () => {} });
  assert.equal(outcome.audit, null);
  assert.deepEqual(stages, ['blind_solution', 'independent_evaluation']);
});

test('V716 freezes valid wrong-key and multiple-answer blind reports, then skips explanation audit', async () => {
  const cases = [
    ['wrong key', { solved: 'B', answerSet: ['B'] }, 'independent_key_mismatch:blind_solution'],
    ['multiple answers', { solved: 'A', answerSet: ['A', 'B'] }, 'not_one_defensible_answer:blind_solution'],
  ];
  for (const [label, outcome, expectedReason] of cases) {
    const candidate = makeCandidate({ id: `v716-early-stop-${label.replaceAll(' ', '-')}` });
    const registry = makeRegistry(), cache = new Map(), stages = [], frozen = [];
    const ledger = { getCache: key => cache.get(key) ?? null, setCache: (key, value) => cache.set(key, structuredClone(value)) };
    const transport = { async generate(provider, body, options = {}) {
      stages.push(options.stage);
      const input = requestBody(provider, body);
      const report = blindReport(candidate, provider, outcome);
      report.candidate_id = input.candidate_id; report.content_hash = input.content_hash;
      const catalogId = input.evidence_catalog[0]?.id || 'E1.1';
      report.source_ids = [catalogId];
      report.options = report.options.map(row => ({ ...row, source_ids: [catalogId] }));
      return { output_text: JSON.stringify(report) };
    } };
    const reviewer = createScorecardReviewV716({ registry, ledger, transport });
    const result = await reviewer.review(candidate, { onBlindFrozen: async record => { frozen.push(record); } });
    assert.equal(result.reports.length, 2, label);
    assert.equal(result.audit, null, label);
    assert.deepEqual(stages, ['blind_solution', 'independent_evaluation'], label);
    assert.equal(frozen.length, 1, label);
    assert.equal(frozen[0].reports.length, 2, label);
    const decision = deriveScorecardV716(candidate, result.reports, result.audit, { evidenceCatalog: [{ id: 'E1.1' }], localChecks: localChecks() });
    assert.equal(decision.state, 'quarantined', label);
    assert.equal(decision.explanation_review, 'not_performed_key_gate_failed', label);
    assert.ok(decision.reasons.includes(expectedReason), label);
  }
});

test('V716 schema and prompts request reports, not reviewer acceptance or blind key comparison', () => {
  const blind = scorecardSchemaV716(['E1.1']), audit = scorecardSchemaV716(['E1.1'], true);
  assert.equal(Object.hasOwn(blind.properties, 'publishable'), false);
  assert.equal(Object.hasOwn(blind.properties, 'key_agrees'), false);
  assert.equal(Object.hasOwn(blind.properties, 'critical_issue'), false);
  assert.equal(Object.hasOwn(audit.properties, 'publishable'), false);
  assert.match(BLIND_PROMPT_V716, /no proposed key or explanation/i);
  assert.match(BLIND_PROMPT_V716, /category label is not a refutation/i);
  assert.match(BLIND_PROMPT_V716, /Classifying printed facts through a supplied rule.*legitimate tested skills/i);
  assert.doesNotMatch(BLIND_PROMPT_V716, /publishable|key_agrees|accept or reject/i);
  assert.match(AUDIT_PROMPT_V716, /Both independent blind reports below are frozen claims, not truth/);
});

function releaseManifest(registry) {
  return { scorecard_releases: { [FACTORY_VERIFIER_VERSION_V716]: { state: 'released', validation_contract_hash: validationContractV716(),
    prompt_hash: scorecardPromptHashV716(), source_registry_version: registry.version, policy: 'cuet-scorecard-routing-v716', topology: 'dual_blind',
    critical_false_accepts: 0, valid_survival: 0.85, by_subject: Object.fromEntries(['english', 'accountancy', 'business_studies', 'economics'].map(subject => [subject, { valid_survival: 0.7 }])),
    benchmark: { state: 'completed', unseen_at_freeze: true, payload_hash: 'f'.repeat(64) } } } };
}
function signedQuestion(candidate, reports, audit, registry, score = 8) {
  const currentStamp = { validation_contract_hash: validationContractV716(), evaluation_prompt: scorecardPromptHashV716(), prompt_version: FACTORY_VERIFIER_VERSION_V716 };
  reports = reports.map(report => ({ ...report, ...currentStamp }));
  audit = { ...audit, ...currentStamp };
  const decision = derive(candidate, { score, reports, audit, checks: localScorecardChecksV716(candidate, registry, new Set()) });
  assert.equal(decision.state, 'eligible');
  const record = { candidate_id: candidate.id, content_hash: contentHash(candidate), state: 'eligible', policy_version: FACTORY_POLICY,
    verifier_version: FACTORY_VERIFIER_VERSION_V716, validation_contract_hash: validationContractV716(), evaluation_prompt: scorecardPromptHashV716(),
    scorecard_policy: 'cuet-scorecard-routing-v716', topology: 'dual_blind', source_registry_version: registry.version,
    sources: candidate.source_refs, family_id: candidate.family_id, family_version: registry.families[candidate.family_id].version,
    route: candidate.route, question_type: candidate.question_type, provenance: candidate.provenance, verified_at: new Date().toISOString(), expires_at: new Date(Date.now() + 86400000).toISOString(), reports, audit,
    local_checks: localScorecardChecksV716(candidate, registry, new Set()), decision };
  return { ...candidate, evidence: { record, signature: evidenceSignature(record, SECRET) } };
}

test('V716 mode selection rejects forged score/signature and requires the current released policy', () => {
  const candidate = makeCandidate(), registry = makeRegistry(), reports = [blindReport(candidate, 'openai'), blindReport(candidate, 'gemini')], audit = auditReport(candidate);
  const signed = signedQuestion(candidate, reports, audit, registry, 8), manifest = releaseManifest(registry);
  const published = publicationEligibilityV716(signed, { registry, manifest, secret: SECRET, mode: 'nta' });
  assert.equal(published.eligible, true, JSON.stringify(published));
  const noRelease = publicationEligibilityV716(signed, { registry, secret: SECRET, mode: 'nta' });
  assert.equal(noRelease.eligible, false);
  assert.ok(noRelease.reasons.includes('qualified_scorecard_release_required'));
  const forgedSignature = structuredClone(signed); forgedSignature.evidence.signature = '0'.repeat(64);
  assert.ok(publicationEligibilityV716(forgedSignature, { registry, manifest, secret: SECRET, mode: 'nta' }).reasons.includes('untrusted_scorecard'));
  const forgedScore = structuredClone(signed); forgedScore.evidence.record.decision.quality_score = 9;
  forgedScore.evidence.record.decision.modes.nta = true;
  forgedScore.evidence.signature = evidenceSignature(forgedScore.evidence.record, SECRET);
  assert.ok(publicationEligibilityV716(forgedScore, { registry, manifest, secret: SECRET, mode: 'nta' }).reasons.includes('scorecard_decision_not_reproducible'));
  const stalePolicy = structuredClone(manifest); stalePolicy.scorecard_releases[FACTORY_VERIFIER_VERSION_V716].policy = 'stale-policy';
  assert.ok(publicationEligibilityV716(signed, { registry, manifest: stalePolicy, secret: SECRET, mode: 'nta' }).reasons.includes('qualified_scorecard_release_required'));
  assert.equal(noRelease.eligible, false, 'an unreleased policy must not enter mode selection');
});

test('V716 explicit easy/medium/hard selection filters candidates by independently assessed band', () => {
  const registry = makeRegistry(), manifest = releaseManifest(registry);
  const medium = makeCandidate({ id: 'select-medium', difficulty: 'medium' });
  const easy = makeCandidate({ id: 'select-easy', difficulty: 'easy' });
  const reportsFor = candidate => [blindReport(candidate, 'openai', { difficulty: candidate.difficulty }), blindReport(candidate, 'gemini', { difficulty: candidate.difficulty })];
  const signedMedium = signedQuestion(medium, reportsFor(medium), auditReport(medium), registry);
  const signedEasy = signedQuestion(easy, reportsFor(easy), auditReport(easy), registry);
  const context = { registry, manifest, secret: SECRET };
  assert.deepEqual(filterPracticeRowsV716([signedMedium, signedEasy], context, 'medium').rows.map(row => row.id), ['select-medium']);
  assert.deepEqual(filterPracticeRowsV716([signedMedium, signedEasy], context, 'easy').rows.map(row => row.id), ['select-easy']);
  assert.deepEqual(filterPracticeRowsV716([signedMedium, signedEasy], context, 'hard').rows, []);
});

test('V716 NTA selection exhausts Medium and Easy before Hard, and suppresses Hard for truncated inventory', () => {
  const registry = makeRegistry(), manifest = releaseManifest(registry), context = { registry, manifest, secret: SECRET, subjectId: 'accountancy', seed: 'v716-selection' };
  const signBand = (id, difficulty) => {
    const candidate = makeCandidate({ id, difficulty, body: `${id}: a retailer receives cash from customers for goods sold. Classify this operating receipt.` });
    const reports = [blindReport(candidate, 'openai', { difficulty }), blindReport(candidate, 'gemini', { difficulty })];
    return signedQuestion(candidate, reports, auditReport(candidate), registry);
  };
  const rows = [signBand('nta-hard', 'hard'), signBand('nta-easy', 'easy'), signBand('nta-medium', 'medium')];
  const filtered = filterPracticeRowsV716(rows, context, 'nta');
  assert.deepEqual(filtered.rows.map(row => row.id), ['nta-hard', 'nta-easy', 'nta-medium'], JSON.stringify(filtered.rejected));
  const truncated = selectNtaQuestionSetV716(rows, 50, context);
  assert.deepEqual(truncated.selectedRows.map(row => row.id), ['nta-medium', 'nta-easy'], JSON.stringify(truncated.diagnostics));
  const complete = selectNtaQuestionSetV716(rows, 50, { ...context, inventoryComplete: true });
  assert.deepEqual(complete.selectedRows.map(row => row.id), ['nta-medium', 'nta-easy', 'nta-hard'], JSON.stringify(complete.diagnostics));
  assert.equal(complete.diagnostics.selectionStrategy, 'medium_then_easy_then_hard_fallback');
  assert.equal(complete.diagnostics.hardRejectReasons?.untrusted_scorecard || 0, 0);
});

test('V716 excludes incomplete atomic passage groups even when siblings individually verify', () => {
  const registry = makeRegistry(), manifest = releaseManifest(registry), context = { registry, manifest, secret: SECRET };
  const first = makeCandidate({ id: 'group-first' });
  const second = makeCandidate({ id: 'group-second' });
  first.passage_group_id = 'group-v716'; second.passage_group_id = 'group-v716';
  const sign = candidate => signedQuestion(candidate, [blindReport(candidate, 'openai'), blindReport(candidate, 'gemini')], auditReport(candidate), registry);
  const result = filterPracticeRowsV716([sign(first), sign(second)], context, 'medium');
  assert.deepEqual(result.rows, []);
  assert.deepEqual(new Set(result.rejected.filter(row => row.reasons.includes('atomic_passage_group_ineligible')).map(row => row.id)), new Set(['group-first', 'group-second']));
});

test('V716 derived contract and file hashes stay version-bound', () => {
  assert.match(validationContractV716(), /^[a-f0-9]{64}$/);
  assert.match(scorecardPromptHashV716(), /^[a-f0-9]{64}$/);
  assert.equal(QUALITY_DIMENSIONS_V716['20'], 'source_fidelity');
});

test('V716 schemas never share string nodes: identity enums cannot constrain derivations, reasons or notes', () => {
  const first = scorecardSchemaV716(['E1.1']);
  first.properties.candidate_id.enum = ['leak-id']; first.properties.content_hash.enum = ['leak-hash'];
  const walk = (node, path, out) => { if (node && typeof node === 'object') { if (node.type === 'string' && Array.isArray(node.enum) && node.enum.some(v => /leak/.test(v))) out.push(path);
    for (const [key, value] of Object.entries(node)) walk(value, path + '.' + key, out); } return out; };
  assert.deepEqual(walk(first.properties.derivation, 'derivation', []), []);
  assert.deepEqual(walk(first.properties.options, 'options', []), []);
  assert.deepEqual(walk(first.properties.scores, 'scores', []), []);
  for (const schema of [scorecardSchemaV716(['E1.1']), scorecardSchemaV716(['E1.1'], true)]) assert.deepEqual(walk(schema, 'schema', []), [], 'a later schema is unaffected');
  const free = ['derivation'].map(key => first.properties[key]);
  for (const node of free) assert.equal(node.enum, undefined);
});

test('V716 native-diagnostic regressions: unscored novelty and N/A assumptions/boundaries are feedback, not rejections', () => {
  const c = makeCandidate();
  const nullNovelty = blindReport(c, 'openai'); nullNovelty.scores['19'] = { score: null, note: 'No calibration anchors were supplied.' };
  const naAssumptions = blindReport(c, 'gemini'); naAssumptions.academic.decisive_assumptions = 'not_applicable'; naAssumptions.academic.boundary_cases = 'not_applicable';
  const result = derive(c, { reports: [nullNovelty, naAssumptions] });
  assert.equal(result.state, 'eligible', JSON.stringify(result.reasons));
  const required = blindReport(c, 'gemini'); required.academic.source_support = 'not_applicable';
  assert.equal(derive(c, { reports: [blindReport(c, 'openai'), required] }).academic_sound, false, 'source support itself can never be waived');
  const noCraft = [blindReport(c, 'openai'), blindReport(c, 'gemini')];
  for (const report of noCraft) report.scores['18'] = { score: null, note: 'Not scored.' };
  const incomplete = derive(c, { reports: noCraft });
  assert.equal(incomplete.state, 'error');
  assert.equal(incomplete.outcome, 'review_incomplete');
  assert.ok(incomplete.reasons.includes('craft_score_unavailable:18'));
});
