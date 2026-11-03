// Read-only analyzer for the already completed diagnostic72-v2 run.
// It reads frozen fixtures, saved judgments, the first-pass key record and the
// persistent budget ledger. It makes no provider calls and does not write to the ledger.
import fs from 'node:fs';
import crypto from 'node:crypto';
import { DatabaseSync } from 'node:sqlite';
import { scopedAccounting } from '../../../../../../../scripts/pipeline/lib/scopedAccounting.mjs';
import { expectedReleaseBinding, RELEASE_POLICY_V7 } from '../../../../../../../scripts/pipeline/lib/releaseEvidenceV7.mjs';
import { CALIBRATION_RELEASE } from '../../../../../../../data/question_factory_policy.mjs';

const root = 'artifacts/question-factory/cuet-readiness-2026-10-08/benchmark/verified-rule-v4';
const dir = `${root}/diagnostic72-v2`;
const out = `${dir}/analysis`;
fs.mkdirSync(out, { recursive: true });
const read = path => JSON.parse(fs.readFileSync(path, 'utf8'));
const sha = path => crypto.createHash('sha256').update(fs.readFileSync(path)).digest('hex');
const round = (n, d = 4) => Number(n.toFixed(d));
const frozen = read(`${dir}/frozen.json`);
const results = read(`${dir}/results.json`);
const summary = read(`${dir}/summary.json`);
const prereg = read(`${dir}/PREREGISTRATION.json`);
const keyAudit = read(`${root}/key-audit/independent-keys.json`);
const topology = results.topologies.dual_blind;
const fixtures = frozen.fixtures;
const evaluations = results.evaluations;
const providers = ['openai', 'gemini', 'anthropic'];
const providerNames = { openai: 'GPT-6 Luna', gemini: 'Gemini Flash', anthropic: 'Claude Haiku 5.5' };
const keyById = new Map(keyAudit.cases.map(row => [row.case_id, row.key]));
const fixtureById = new Map(fixtures.map(row => [row.id, row]));
const topologyById = new Map(topology.map(row => [row.id, row]));

function wilson(successes, n, z = 1.96) {
  if (!n) return null;
  const p = successes / n, z2 = z * z, den = 1 + z2 / n;
  const mid = (p + z2 / (2 * n)) / den;
  const half = z * Math.sqrt((p * (1 - p) / n) + z2 / (4 * n * n)) / den;
  return [round(Math.max(0, mid - half) * 100, 1), round(Math.min(1, mid + half) * 100, 1)];
}

const valid = fixtures.filter(row => row.expected_valid);
const controls = fixtures.filter(row => !row.expected_valid);
const modelStats = {};
for (const provider of providers) {
  const stats = {
    model: providerNames[provider], provider,
    judgments: 0, errors: 0,
    valid: { n: 0, key_match_first_pass: 0, key_mismatch: 0, abstain: 0, fit_pass: 0, fit_scores: [], conditions_ok: 0, conditions_failed: 0 },
    controls: { n: 0, judgments: 0, errors: 0, abstain: 0, correct_source_key_on_wrong_key: 0, correct_source_key_on_numeric: 0, overlap_blocked: 0, missing_condition_blocked: 0, syllabus_mismatch_blocked: 0, unsupported_explanation_blind_action: 0 },
  };
  for (const fixture of fixtures) {
    const ev = evaluations[fixture.id]?.[provider];
    if (!ev) continue;
    if (ev.status !== 'judged') {
      stats.errors++;
      if (!fixture.expected_valid) stats.controls.errors++;
      continue;
    }
    stats.judgments++;
    if (fixture.expected_valid) {
      stats.valid.n++;
      const independentlyRecordedKey = keyById.get(fixture.id);
      if (ev.solved_key === 'abstain') stats.valid.abstain++;
      else if (ev.solved_key === independentlyRecordedKey) stats.valid.key_match_first_pass++;
      else stats.valid.key_mismatch++;
      if (ev.cuet_fit_result?.pass === true) stats.valid.fit_pass++;
      if (Number.isFinite(ev.cuet_fit_result?.score)) stats.valid.fit_scores.push(ev.cuet_fit_result.score);
      if (ev.conditions_ok === true) stats.valid.conditions_ok++;
      else if (ev.conditions_ok === false) stats.valid.conditions_failed++;
    } else {
      stats.controls.n++;
      stats.controls.judgments++;
      if (ev.solved_key === 'abstain') stats.controls.abstain++;
      const oracleKeys = String(fixture.oracle.key ?? '').split('|');
      if (fixture.category === 'wrong_key' && oracleKeys.includes(String(ev.solved_key)) && ev.solved_key !== fixture.candidate.correct_answer) stats.controls.correct_source_key_on_wrong_key++;
      if (fixture.category === 'numeric_error' && oracleKeys.includes(String(ev.solved_key)) && ev.solved_key !== fixture.candidate.correct_answer) stats.controls.correct_source_key_on_numeric++;
      const blocked = ev.blocking_defects || [];
      if (fixture.category === 'overlapping_options' && (ev.single_defensible_answer === false || blocked.some(x => x.category === 'multiple_correct_options'))) stats.controls.overlap_blocked++;
      if (fixture.category === 'missing_decisive_condition' && (ev.conditions_ok === false || blocked.some(x => /missing_decisive_assumption|multiple_correct/.test(x.category)))) stats.controls.missing_condition_blocked++;
      if (fixture.category === 'syllabus_mismatch' && (ev.syllabus_entitlement === false || blocked.some(x => x.category === 'syllabus_mismatch'))) stats.controls.syllabus_mismatch_blocked++;
      // Explanations are hidden from the blind evaluator. This is intentionally not counted here.
      if (fixture.category === 'unsupported_explanation') stats.controls.unsupported_explanation_blind_action = null;
    }
  }
  const vals = stats.valid.fit_scores;
  stats.valid.fit_mean = vals.length ? round(vals.reduce((a, b) => a + b, 0) / vals.length, 3) : null;
  stats.valid.fit_distribution = Object.fromEntries([...new Set(vals)].sort().map(k => [k, vals.filter(v => v === k).length]));
  delete stats.valid.fit_scores;
  modelStats[provider] = stats;
}

function pairMetrics(a, b, subset) {
  const rows = subset.filter(f => evaluations[f.id]?.[a]?.status === 'judged' && evaluations[f.id]?.[b]?.status === 'judged');
  const fields = ['solved_key', 'single_defensible_answer', 'source_support', 'syllabus_entitlement', 'conditions_ok'];
  return {
    n: rows.length,
    fields: Object.fromEntries(fields.map(field => [field, { agree: rows.filter(f => evaluations[f.id][a][field] === evaluations[f.id][b][field]).length, n: rows.length }])),
    blocking_defect_presence_agree: rows.filter(f => Boolean(evaluations[f.id][a].blocking_defects?.length) === Boolean(evaluations[f.id][b].blocking_defects?.length)).length,
  };
}

const pairwise = {};
for (const [a, b] of [['openai', 'gemini'], ['openai', 'anthropic'], ['gemini', 'anthropic']]) {
  pairwise[`${a}_${b}`] = {
    all72: pairMetrics(a, b, fixtures),
    valid40: pairMetrics(a, b, valid),
    controls32: pairMetrics(a, b, controls),
  };
}

const stateCounts = Object.fromEntries([...new Set(topology.map(row => row.state))].map(state => [state, topology.filter(row => row.state === state).length]));
const subjectRetention = Object.fromEntries([...new Set(valid.map(row => row.candidate.subject))].map(subject => {
  const rows = valid.filter(row => row.candidate.subject === subject);
  return [subject, { denominator: rows.length, eligible: rows.filter(row => topologyById.get(row.id)?.state === 'eligible').length }];
}));
const rejectionRows = topology.filter(row => row.expected_valid && row.state !== 'eligible').map(row => ({ id: row.id, stage: row.failed_stage, reasons: row.reasons, details: row.failure_details }));
const controlResults = Object.fromEntries([...new Set(controls.map(row => row.category))].map(category => {
  const rows = controls.filter(row => row.category === category).map(row => topologyById.get(row.id));
  return [category, {
    n: rows.length,
    quarantined: rows.filter(row => row.state === 'quarantined').length,
    errors: rows.filter(row => row.state === 'error').length,
    eligible: rows.filter(row => row.state === 'eligible').length,
    outcomes: Object.fromEntries([...new Set(rows.flatMap(row => row.reasons || []))].map(reason => [reason, rows.filter(row => row.reasons?.includes(reason)).length])),
  }];
}));

const db = new DatabaseSync('data/pipeline-budget.sqlite', { readOnly: true });
const accounting = scopedAccounting({ db }, 'cuet-readiness-diagnostic72-v2:');
const ledgerRows = accounting.requests.map(item => {
  const q = db.prepare('SELECT receipt_json, created_at FROM requests WHERE id=?').get(item.reservation_id);
  let receipt = {}; try { receipt = JSON.parse(q?.receipt_json || '{}'); } catch { /* malformed receipts remain separately visible in state */ }
  const usage = receipt.usage || {};
  const input = usage.input_tokens ?? usage.promptTokenCount ?? usage.prompt_tokens ?? 0;
  const output = usage.output_tokens ?? usage.completion_tokens ?? ((usage.candidatesTokenCount || 0) + (usage.thoughtsTokenCount || 0));
  return { ...item, created_at: q?.created_at, receipt, input, output };
});
const costByModel = {};
for (const item of ledgerRows) {
  const row = costByModel[item.model] ||= { requests: 0, settled_usd: 0, input_tokens: 0, output_tokens: 0, stages: {}, rates: item.receipt.rates || null };
  row.requests++;
  row.settled_usd += item.settled_micro / 1e6;
  row.input_tokens += item.input;
  row.output_tokens += item.output;
  row.stages[item.stage] = (row.stages[item.stage] || 0) + 1;
}
for (const value of Object.values(costByModel)) value.settled_usd = round(value.settled_usd, 6);
const firstCallCost = {};
for (const model of Object.keys(costByModel)) {
  const rows = ledgerRows.filter(row => row.model === model).sort((a, b) => a.created_at.localeCompare(b.created_at));
  const byCandidate = new Map();
  for (const row of rows) {
    const id = row.candidate_id || 'unattributed';
    if (!byCandidate.has(id)) byCandidate.set(id, []);
    byCandidate.get(id).push(row);
  }
  const first = [...byCandidate.values()].map(items => items[0]);
  const extra = [...byCandidate.values()].flatMap(items => items.slice(1));
  firstCallCost[model] = {
    unique_candidates: byCandidate.size,
    first_call_per_candidate_usd: round(first.reduce((n, row) => n + row.settled_micro, 0) / 1e6, 6),
    repeated_calls: extra.length,
    repeated_call_cost_usd: round(extra.reduce((n, row) => n + row.settled_micro, 0) / 1e6, 6),
  };
}
db.close();

const allSettled = accounting.settled_micro / 1e6;
const expectedBinding = expectedReleaseBinding();
const bindingMatches = JSON.stringify(frozen.contract_binding) === JSON.stringify(expectedBinding);
const fullValidRetention = summary.valid_eligible / summary.valid_denominator;
const primaryValidRetention = summary.primary_valid_eligible / summary.primary_valid_denominator;
const subjectPolicyStatus = Object.fromEntries(Object.entries(subjectRetention).map(([subject, value]) => [subject, {
  eligible: value.eligible, denominator: value.denominator,
  survival: value.eligible / value.denominator,
  meets_minimum: value.eligible / value.denominator >= RELEASE_POLICY_V7.per_subject_valid_survival_min,
}]));
const report = {
  schema: 'mockmob-diagnostic72-v2-independent-analysis-v1',
  captured_at: new Date().toISOString(),
  run: {
    preregistration_id: prereg.id,
    preregistration_payload_sha256: prereg.payload_hash,
    diagnostic_scope: 'diagnostic; never a release or publication decision',
    fixture_denominator: fixtures.length,
    source_key_valid_roots: valid.length,
    controlled_defects: controls.length,
    expected_provider_judgments: prereg.expected_blind_judgments,
    observed_judgments: summary.judgments,
    provider_errors: summary.provider_errors,
    topology_rows: topology.length,
    topology_complete: summary.complete,
    topology_states: stateCounts,
    valid_eligible: summary.valid_eligible,
    valid_denominator: summary.valid_denominator,
    primary_valid_eligible: summary.primary_valid_eligible,
    primary_valid_denominator: summary.primary_valid_denominator,
    controlled_eligible_false_accepts: summary.controlled_false_accepts,
    publication_writes: summary.publication_writes,
  },
  release_policy_context: {
    release_evidence_v7_policy: RELEASE_POLICY_V7,
    factory_calibration_policy: CALIBRATION_RELEASE,
    expected_release_binding_matches_frozen: bindingMatches,
    expected_release_binding: expectedBinding,
    measured_diagnostic_survival: {
      all_valid_including_contested: { eligible: summary.valid_eligible, denominator: summary.valid_denominator, rate: round(fullValidRetention, 4), meets_overall_floor_numerically: fullValidRetention >= RELEASE_POLICY_V7.valid_survival_min },
      unambiguous_primary: { eligible: summary.primary_valid_eligible, denominator: summary.primary_valid_denominator, rate: round(primaryValidRetention, 4), meets_overall_floor_numerically: primaryValidRetention >= RELEASE_POLICY_V7.valid_survival_min },
      by_subject: subjectPolicyStatus,
    },
    interpretation: 'Observed survival in this diagnostic exceeds the V7 85% overall floor, but Economics is below the V7 70% subject minimum. The 95% figure is answered-key accuracy in factory calibration, not valid survival; this diagnostic does not establish that release metric. Incomplete judgments/topology, diagnostic-only scope and absence of the required paired fresh/regression release evidence independently prevent a release conclusion.',
  },
  raw_provider_results: modelStats,
  pairwise_blind_agreement: pairwise,
  subject_retention: subjectRetention,
  controlled_defect_topology_actions: controlResults,
  valid_rejections: rejectionRows,
  conditional_answer_notes: {
    general_rule_vs_missing_case_fact: 'The CUET-fit contract treats a sourced definition or rule as academic knowledge and blocks only an omitted answer-changing case fact. EC-04, EC-07 and EC-09 have exact supporting source spans, yet Luna classified the sourced proposition as inferred_fact; Gemini marked it convention and Haiku did not flag it as a missing case fact. This is the main likely false-rejection mechanism.',
    reference_completeness: 'BS-10 and EC-05 explicitly ask what an absent cited passage/text says. The saved source excerpt supports the intended key, but the student-facing passage field is empty. Their current stems have a real completeness defect; the underlying syllabus knowledge is valid and could be tested with direct wording.',
    tested_conditional_control: 'AC-COND-CAPITAL-INTEREST: Luna and Haiku flag missing deed/rate conditions; Gemini solves D and reports no blocker. The fused topology quarantines it. This is direct evidence that pairwise blind agreement is not a uniformly reliable substitute for condition audits.',
    positive_condition_contest: 'AC-05: all three judges accept A as a convention, but the quoted rule only says no interest is charged if the deed is silent. The converse is not stated. Preserve the independently recorded wording dispute; model agreement does not settle it.',
    haiku_overflag_example: 'AC-09: Luna and Gemini accept the stated general guarantee rule; Haiku marks the guarantors/shortfall setup missing even though the question asks for the generic rule and its source gives the guarantee mechanism. This is a likely over-flag, not evidence of an incorrect key.',
  },
  five_valid_rejection_review: [
    { id: 'business_studies-BS-10-valid', key: 'B', source_quote: 'Development refers to the learning opportunities designed to help employees grow.', syllabus: 'Unit VI Staffing: Training and Development – meaning, need, methods; also steps in staffing process.', judgment: 'The key and syllabus topic are supported. The phrase “in the cited passage” points to a passage that is absent from passage_text, and the source-support failure explicitly records incomplete stimulus. A valid completeness block for this wording; likely easy to repair as a direct definition question.' },
    { id: 'economics-EC-04-valid', key: 'D', source_quote: 'work in agriculture is seasonal; there are no employment opportunities in the village for all months in the year. When there is no work to do on farms, people go to urban areas and look for jobs.', syllabus: 'Unit III Current challenges: Employment – growth and changes in workforce participation in formal and informal sectors; problems and policies.', judgment: 'The source directly entails D and no case-specific fact is missing. Luna alone tags the sourced seasonal-work rule as inferred_fact; Gemini and Haiku pass the condition. Likely false rejection under the contract, not a legitimate academic gate.' },
    { id: 'economics-EC-05-valid', key: 'A', source_quote: 'Those who are working in the formal sector enjoy social security benefits.', syllabus: 'Unit III Current challenges: Employment – growth and changes in workforce participation in formal and informal sectors; problems and policies.', judgment: 'The content/key are source- and syllabus-supported. The exact stem asks what “the text” says, but no text is present; the source-support failure explicitly records incomplete stimulus and missing text identity. Legitimate completeness block for this wording; the underlying recall concept is CUET-appropriate.' },
    { id: 'economics-EC-09-valid', key: 'A', source_quote: 'Non-renewable resources ... get exhausted with extraction and use, for example, fossil fuel.', syllabus: 'Unit III Current challenges: Environment and Sustainable Development – definition and functions, state of India’s environment, strategies for sustainable development.', judgment: 'The source directly states A and syllabus fit is true. Luna marks this sourced textbook classification as inferred_fact; Gemini treats it as convention. The recorded failure contains no unsupported-key or out-of-syllabus finding. Likely false rejection; the “in the source” phrasing could still be made more direct.' },
    { id: 'economics-EC-07-valid', key: 'C', source_quote: 'Physical capital is separable from its owner, whereas human capital is inseparable from its owner.', syllabus: 'Unit III Current challenges: Human Capital Formation – how people become a resource; role of human capital in economic development; growth of education sector.', judgment: 'The source directly entails C and all three judges mark the syllabus entitled. Luna labels the exact source statement inferred_fact and Haiku treats the source reference as missing; Gemini marks it convention. The topology reason does not identify a second defensible key. Likely false rejection under the stated rule-versus-case-fact contract, with a minor source-reference clarity opportunity.' },
  ],
  key_and_fit_uncertainty: {
    independent_first_pass_key_agreement: '40/40 with author oracle and proposed key; one root AC-05 is expressly contested on positive-condition entailment, leaving 39 unambiguous roots.',
    valid_key_wilson95_descriptive_percent: { all40: wilson(40, 40), uncontested39: wilson(39, 39) },
    current_primary_retention_wilson95_descriptive_percent: wilson(summary.primary_valid_eligible, summary.primary_valid_denominator),
    caveat: 'Intervals are illustrative binomial intervals only. This is a deliberately selected diagnostic with shared source families, controlled variants and a tiny fixed root set; they are not population confidence bounds or proof of CUET academic truth.'
  },
  haiku_slot_recommendation: {
    recommendation: 'Keep Luna and Gemini in their existing roles; keep Haiku measurement-only. Do not promote Haiku or replace Gemini on this run.',
    measured_haiku: '40/40 first-pass key matches and no valid abstentions, but only 26/40 CUET-fit pass scores and 9/40 valid condition failures. It showed no valid-key accuracy lift over Luna/Gemini on this easy, correlated set and its stricter condition judgments include likely false flags.',
    measured_slot_cost: { haiku_72_raw_judgments_usd: 0.19125, gemini_first_call_for_each_of_72_candidates_usd: 0.83351, gemini_additional_8_topology_requests_usd: 0.169522, caveat: 'This is observed diagnostic cost, not an equal-topology future estimate. Gemini’s 8 repeated calls arose in the measured pipeline; a Haiku topology was not executed.' },
    conclusion_limit: 'No end-to-end Luna+Haiku topology, independent academic truth set or representative student timing was measured. Do not infer lower future costs or better/worse production yield from the 72 raw Haiku calls.'
  },
  cost: {
    scope_prefix: 'cuet-readiness-diagnostic72-v2:',
    ledger_receipts: accounting.requests.length,
    receipts_complete: accounting.receipt_complete,
    settled_usd: round(allSettled, 6),
    held_usd: round(accounting.held_micro / 1e6, 6),
    gross_usd: round(accounting.committed_micro / 1e6, 6),
    cap_usd: prereg.cap_usd,
    by_model: costByModel,
    first_call_cost_by_model: firstCallCost,
    invoices: 'No provider invoices were present; these are usage-receipt ledger charges, including billable failed/incomplete responses and repeat requests.',
  },
  limits: [
    '40 valid roots (10 per subject), with only five valid roots per subject in the release partition.',
    '45 declared roots across 72 selected rows; controlled mutations share source roots and do not add independent sample size.',
    'Accountancy valid roots share one partnership-basics NCERT document; Business Studies roots share one Staffing chapter; economics chapters and authored English stimuli do not create a representative CUET sample.',
    'Benchmark designer contributed to validator design. The independent first-pass keys help audit answer selection but do not establish CUET fit, source truth or the truth of author certificates.',
    'All 214 judgments and this completed payload are now observed regression evidence, never a fresh release benchmark. No changes to fixtures, labels or contracts were made.',
    'The 0 controlled false accepts applies only to 31 conclusive controlled-defect verdicts. One of 32 controlled rows ended in provider/topology error; this is not a successful rejection. The 32 fixtures are a coverage set, not a prevalence sample.',
    'Estimated solve times are rubric heuristics, not measured candidate timing. CUET 2026 syllabus is the cached baseline and remains provisional for CUET UG 2027.',
  ],
  input_hashes: Object.fromEntries(['frozen.json', 'results.json', 'summary.json', 'PREREGISTRATION.json'].map(name => [name, sha(`${dir}/${name}`)])),
  first_pass_key_sha256: sha(`${root}/key-audit/independent-keys.json`),
  first_pass_audit_report_sha256: sha(`${root}/key-audit/audit-report.json`),
};

const reportJson = JSON.stringify(report, null, 2) + '\n';
fs.writeFileSync(`${out}/report.json`, reportJson);
const pct = (a, b) => `${a}/${b} (${round(100 * a / b, 1)}%)`;
const modelRows = providers.map(provider => {
  const s = report.raw_provider_results[provider];
  return `| ${s.model} | ${s.judgments} judged; ${s.errors} errors | ${pct(s.valid.key_match_first_pass, s.valid.n)} | ${s.valid.abstain} | ${pct(s.valid.fit_pass, s.valid.n)} | ${s.valid.fit_mean}/10 | ${s.valid.conditions_failed} |`;
}).join('\n');
const controlRows = Object.entries(controlResults).map(([category, s]) => `| ${category} | ${s.n} | ${s.quarantined} | ${s.errors} | ${s.eligible} | ${Object.entries(s.outcomes).map(([k, v]) => `${k} ${v}`).join('; ')} |`).join('\n');
const costRows = Object.entries(costByModel).map(([model, s]) => `| ${model} | ${s.requests} | ${s.input_tokens.toLocaleString('en-US')} | ${s.output_tokens.toLocaleString('en-US')} | $${s.settled_usd.toFixed(6)} |`).join('\n');
const pairRows = Object.entries(pairwise).map(([pair, groups]) => {
  const all = groups.all72, v = groups.valid40;
  return `| ${pair.replace('_', ' + ')} | ${all.n} | ${all.fields.solved_key.agree}/${all.n} | ${v.fields.solved_key.agree}/${v.n} | ${all.fields.conditions_ok.agree}/${all.n} |`;
}).join('\n');
const md = `# Diagnostic72-v2: independent saved-run analysis\n\nCaptured ${report.captured_at}. This is a read-only analysis of the completed, already-observed payload. It does not certify a release and does not make another provider call.\n\n## Outcome and denominator\n\nThe full denominator remains **72 fixtures**: 40 valid roots and 32 controlled defects. The runner produced 72 topology rows, but the run is **incomplete**: 214 of 216 expected blind judgments were returned and two Gemini responses were incomplete. Topology states were 35 eligible, 36 quarantined, and one error. Within those rows, 35/40 valid items were eligible; among the 39 unambiguous valid roots, 34 were eligible. The 32 controls yielded 31 quarantine verdicts and one provider/topology error. There were zero controlled false accepts among the 31 resolved control verdicts, not 32/32 resolved defect judgments. No question was published.\n\nValid eligibility by subject: ${Object.entries(subjectRetention).map(([k, v]) => `${k} ${v.eligible}/${v.denominator}`).join(', ')}.\n\n## Raw model judgments\n\nThe independent key record has 40/40 agreement with the authored proposed and oracle keys, but AC-05 remains contested on whether the excerpt establishes a positive sufficient condition. The key counts below are agreement with the previously recorded first-pass keys, not proof of truth. All three providers matched those recorded keys on 40/40 valid roots and abstained on none.\n\n| Provider | Output | Valid first-pass key match | Valid abstain | CUET-fit pass | Mean fit score | Valid condition failures |\n|---|---:|---:|---:|---:|---:|---:|\n${modelRows}\n\nGemini returned 70 judgments and two \`provider_output_incomplete\` errors (\`business_studies-BS-01-unsupported-explanation\` and \`business_studies-BS-06-unsupported-explanation\`). The second error left the topology row unresolved; the first item was already quarantined by an earlier stage.\n\nWrong-key controls: each provider solved the source key on all eight and disagreed with the mutated proposed key. Numerical controls: each solved all four correctly. All three flagged all eight overlapping-option controls; Luna abstained on one, Gemini and Haiku on seven each. On the single missing-condition control, Luna and Haiku blocked it; Gemini selected D and did not block it. Gemini and Haiku flagged all three syllabus-mismatch fixtures; Luna flagged two directly.\n\nThe blind judgments do not see the proposed explanation, so unsupported-explanation detection belongs to the later explanation-support stage. The full topology quarantined seven of eight: five failed that stage, two were stopped at source-support first, and one failed with the provider error.\n\n## Pairwise blind agreement\n\n| Pair | Shared rows | Key agreement, all rows | Key agreement, valid roots | Condition-status agreement |\n|---|---:|---:|---:|---:|\n${pairRows}\n\nOn the 40 valid roots, every pair selected the same key 40/40, while condition acceptability agreed only 35/40 for Luna/Gemini, 34/40 for Luna/Haiku and 31/40 for Gemini/Haiku. Across controls the key-agreement rates fell to 23/30, 24/32 and 26/30 respectively, largely because overlap cases elicited abstentions. Agreement is supporting evidence from correlated models, not academic ground truth.\n\nThe actual \`dual_blind\` fusion used Luna as primary, Gemini as secondary and Luna for explanation support. It did not use Haiku. Its 35 eligible results reflect the intersection of all required gates, not just key agreement.\n\n## Why the five valid items were rejected\n\nAll five were stopped at \`source_support\`. Three show a likely false rejection under the contract’s distinction between a sourced academic rule and a missing case-specific fact: EC-04, EC-07 and EC-09. Their NCERT excerpts directly state the intended answer; Luna labelled the rule itself \`inferred_fact\` and failed the conditions gate. Gemini marked the corresponding rule as a cited convention. The current gate appears to conflate a source-supported principle with an unstated case assumption.\n\nBS-10 and EC-05 have correct, syllabus-supported underlying content, but their stems refer to a “cited passage” or “the text” while \`passage_text\` is empty. The failure details explicitly identify the absent referenced text. That is a real completeness problem in the frozen wording, although rewriting the stem as direct subject recall would preserve the concept and fit CUET. These are not out-of-syllabus or wrong-key findings. Full source excerpts and clause analysis are in \`report.json\`.\n\nThe V7 release-evidence policy is 85% overall valid survival and 70% minimum per subject. The diagnostic measures 35/40 (87.5%) including the contested root and 34/39 (87.2%) among unambiguous primary roots, both numerically above the overall floor; Economics is 6/10 (60%), below the subject floor. The 95% figure is answered-key accuracy in factory calibration, not valid survival. These diagnostic measurements do not constitute a release assessment: the run is incomplete, diagnostic-only, and lacks the paired fresh/regression release evidence.\n\n## Conditional-answer inconsistencies\n\nThe clearest inconsistency is EC-04/EC-07/EC-09: Luna marks a source-quoted definition/rule as an inferred fact, Gemini calls it a source-supported convention, and Haiku either accepts it or asks for the absent source. The tested conditional control AC-COND-CAPITAL-INTEREST shows a different split: Luna and Haiku detect missing deed/rate conditions; Gemini gives D and no blocker. AC-05 is the cautionary counterpart: all three call “deed mentions it” a convention, but the excerpt only says interest is not charged if the deed is silent. The positive converse is not explicit, so retain the earlier dispute. Haiku also flags missing guarantor details on AC-09 even though the item asks for the generic rule and the source supplies it.\n\n## CUET-fit and retention\n\nRaw valid-item CUET-fit pass counts were 40/40 for Luna (mean 8.475), 40/40 for Gemini (mean 9.775) and 26/40 for Haiku (mean 7.725). Luna/Gemini scores are anchored ratings, not truth. Haiku’s lower pass rate and nine valid condition failures signal that a Luna/Haiku fusion might quarantine more valid content; an end-to-end Haiku topology was not run, so no alternate eligible count is claimed. Against V7 release-evidence thresholds, the observed overall primary retention is 34/39 (87.2%), numerically above the 85% overall floor, while Economics is 6/10 (60%), below the 70% per-subject minimum. The 95% value is answered-key accuracy, not survival. This diagnostic does not establish a release pass: its provider judgments/topology are incomplete and it is not the required paired fresh-plus-regression evidence.\n\n## Defect actions\n\n| Controlled category | N | Quarantined | Error | Eligible | Topology reason counts |\n|---|---:|---:|---:|---:|---|\n${controlRows}\n\nThis was a deliberately selected coverage set with correlated mutations; the zero false-accept observation cannot estimate a production false-accept rate. Some controls were stopped by an earlier gate, so rejection does not prove the targeted defect checker itself caught each one.\n\n## Ledger cost\n\nThe read-only ledger scope \`cuet-readiness-diagnostic72-v2:\` contains ${report.cost.ledger_receipts} settled requests, complete receipts, $${report.cost.settled_usd.toFixed(6)} settled, $${report.cost.held_usd.toFixed(6)} held. The $${prereg.cap_usd.toFixed(2)} cap was not approached.\n\n| Model | Requests | Input tokens | Output tokens | Settled cost |\n|---|---:|---:|---:|---:|\n${costRows}\n\nSaved pricing schemas were Luna $0.10/$0.50 per million input/output tokens, with cached input $0.01 and cache writes $0.125; Gemini Flash $0.75/$3.75; Haiku 5.5 $0.10/$0.50. Ledger receipts include reasoning tokens in provider-reported output usage and include incomplete responses and repeated requests. No provider invoice was present. Gemini’s first request per each of 72 candidates cost $0.833510; eight additional topology calls cost $0.169522. Haiku’s 72 raw judgments cost $0.191250. This is observed cost for these prompts, not a future topology cost forecast.\n\nHaiku therefore showed a lower direct measurement-slot cost but no valid-key accuracy lift on this sample and a materially lower fit pass rate. Keep Luna and Gemini in the existing roles and Haiku measurement-only; this run does not justify adding Haiku to, or replacing a member of, the production topology.\n\n## Limits and hashes\n\nThis payload has 40 valid roots (10 per subject), five release roots per subject, 45 roots across 72 rows, and source-family correlation (one NCERT partnership document for Accountancy and one staffing chapter for Business Studies). All results are now observed regression evidence. The 2026 NTA syllabus is provisional for 2027; solve time is heuristic rather than student timing. Independent key agreement does not establish CUET fit or source truth.\n\nFrozen input hashes: ${Object.entries(report.input_hashes).map(([k, v]) => `${k} ${v}`).join('; ')}. First-pass key record ${report.first_pass_key_sha256}; key-audit report ${report.first_pass_audit_report_sha256}.\n`;
fs.writeFileSync(`${out}/report.md`, md);
console.log(JSON.stringify({ report_json: `${out}/report.json`, report_markdown: `${out}/report.md`, fixture_denominator: report.run.fixture_denominator, judgments: report.run.observed_judgments, errors: report.run.provider_errors, topology: report.run.topology_states, valid_retention: `${summary.primary_valid_eligible}/${summary.primary_valid_denominator}`, settled_usd: report.cost.settled_usd }));
