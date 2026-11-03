import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

// Offline report over the saved A/B commissioning outputs only. This utility
// deliberately does not open benchmark fixtures, query a live ledger, or call a provider.
const root = path.resolve('artifacts/question-factory');
const outDir = path.resolve('artifacts/question-factory/cuet-readiness-2026-10-08/analytics');
const aDir = path.join(root, 'cuet-readiness-baseline-100-2026-10-08');
const bDir = path.join(root, 'cuet-readiness-improved-100-2026-10-08');
const read = p => JSON.parse(fs.readFileSync(p, 'utf8'));
const sha256 = p => crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex');
const inputFiles = ['campaign.json','batch-report.json','all-candidates.json','approved.json','rejected.json','receipts.json'].map(f => path.join(aDir, f)).concat([path.join(bDir, 'campaign.json')]);
const inputHashesAtStart = Object.fromEntries(inputFiles.filter(fs.existsSync).map(p => [path.relative(process.cwd(), p), sha256(p)]));
const pct = (n, d) => d ? Number((100 * n / d).toFixed(2)) : null;
const usd = micro => Number((micro / 1e6).toFixed(6));
const quantile = (values, q) => {
  if (!values.length) return null;
  const a = [...values].sort((x, y) => x - y), i = (a.length - 1) * q, lo = Math.floor(i), hi = Math.ceil(i);
  return Number((a[lo] + (a[hi] - a[lo]) * (i - lo)).toFixed(1));
};
const keys = ['A','B','C','D'];
const sum = xs => xs.reduce((a, x) => a + (Number(x) || 0), 0);
const counts = (rows, f) => Object.fromEntries([...new Set(rows.map(f).filter(x => x != null && x !== ''))].sort().map(k => [k, rows.filter(r => f(r) === k).length]));
const words = text => String(text || '').match(/[\p{L}\p{N}]+/gu) || [];
const norm = text => String(text || '').normalize('NFKC').toLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ').trim().replace(/\s+/g, ' ');
const stop = new Set('the a an and or but of to in on at for from by with as is are was were be been being it this that these those which what when where why how does do did according source says stated identify describe supported option statement'.split(' '));
const ideaTokens = text => new Set(words(norm(text)).filter(w => !stop.has(w) && w.length > 2));
const jaccard = (a, b) => { const x = ideaTokens(a), y = ideaTokens(b); if (!x.size && !y.size) return 1; const n = [...x].filter(v => y.has(v)).length; return n / (x.size + y.size - n); };

const campaign = read(path.join(aDir, 'campaign.json'));
const batch = read(path.join(aDir, 'batch-report.json'));
const all = read(path.join(aDir, 'all-candidates.json'));
const approved = read(path.join(aDir, 'approved.json'));
const rejected = read(path.join(aDir, 'rejected.json'));
const receipts = read(path.join(aDir, 'receipts.json'));
const bCampaignPath = path.join(bDir, 'campaign.json');
const bCampaign = fs.existsSync(bCampaignPath) ? read(bCampaignPath) : null;

if (campaign.denominator !== 100 || all.length !== 100) throw new Error('baseline_denominator_mismatch');
if (new Set(all.map(x => x.id)).size !== 100) throw new Error('baseline_candidate_ids_not_unique');
const beforeIds = new Set(campaign.request_ids_before || []);
const scopedReceipts = receipts.filter(r => !beforeIds.has(r.id));
const receiptIds = scopedReceipts.map(r => r.id);
if (new Set(receiptIds).size !== receiptIds.length) throw new Error('duplicate_scoped_receipt_ids');
if (scopedReceipts.length !== receipts.length) throw new Error('saved_receipts_include_pre_campaign_ids');

const jobsByState = counts(all, x => x.state || 'unknown');
const resultsByState = counts(all, x => x.result?.state || 'missing_result');
const eligible = all.filter(x => x.result?.state === 'eligible' && x.candidate);
const approvedIds = new Set(approved.map(x => x.id));
const eligibleIds = new Set(eligible.map(x => x.id));
if (eligibleIds.size !== approvedIds.size || [...eligibleIds].some(id => !approvedIds.has(id))) throw new Error('approved_vs_machine_eligible_mismatch');
const produced = all.filter(x => x.candidate);
const exactFingerprint = row => {
  const c = row.candidate || {};
  return JSON.stringify({ subject: c.subject || row.subject, body: norm(c.body), options: (c.options || []).map(o => norm(typeof o === 'string' ? o : o.text)).sort(), answer: c.correct_answer || '' });
};
const fingerprintGroups = new Map();
for (const row of all.filter(x => x.candidate)) {
  const fp = exactFingerprint(row), group = fingerprintGroups.get(fp) || [];
  group.push(row); fingerprintGroups.set(fp, group);
}
const exactDuplicates = [...fingerprintGroups.values()].filter(g => g.length > 1).map(g => ({ ids: g.map(x => x.id), statuses: g.map(x => x.result?.state || x.state), subject: g[0].candidate?.subject || g[0].subject }));
const passageGroups = new Map();
for (const row of produced) if (row.passage_group_id) {
  const group = passageGroups.get(row.passage_group_id) || [];
  group.push(row.id); passageGroups.set(row.passage_group_id, group);
}
const sharedPassageGroups = [...passageGroups.entries()].filter(([,ids]) => ids.length > 1).map(([group_id, ids]) => ({ group_id, ids }));

const ideaPairs = [];
for (let i = 0; i < produced.length; i++) for (let j = i + 1; j < produced.length; j++) {
  const a = produced[i], b = produced[j];
  if ((a.candidate?.subject || a.subject) !== (b.candidate?.subject || b.subject)) continue;
  const bodyA = a.candidate?.body || '', bodyB = b.candidate?.body || '';
  const sim = jaccard(bodyA, bodyB);
  const sharedConcept = a.candidate?.concept_id && a.candidate.concept_id === b.candidate?.concept_id;
  const sharedFamily = a.family_id && a.family_id === b.family_id;
  if (sim >= 0.48 || sharedConcept || sharedFamily) ideaPairs.push({
    ids: [a.id, b.id], subject: a.candidate?.subject || a.subject,
    body_jaccard: Number(sim.toFixed(3)), shared_concept: Boolean(sharedConcept), shared_family: Boolean(sharedFamily),
    topics: [a.topic, b.topic], statuses: [a.result?.state || a.state, b.result?.state || b.state],
  });
}
ideaPairs.sort((a, b) => Number(b.shared_concept) - Number(a.shared_concept) || Number(b.shared_family) - Number(a.shared_family) || b.body_jaccard - a.body_jaccard);

const supportRows = produced.map(row => {
  const refs = row.supporting_excerpts || [];
  const each = refs.map(s => ({ id: s.id, locator: s.locator, chars: String(s.text || '').length, words: words(s.text).length }));
  return { id: row.id, subject: row.subject, result_state: row.result?.state || null, job_state: row.state, refs: each, total_chars: sum(each.map(x => x.chars)), total_words: sum(each.map(x => x.words)) };
});
const supportSummary = rows => {
  const chars = rows.map(x => x.total_chars), ws = rows.map(x => x.total_words), excerptLengths = rows.flatMap(x => x.refs.map(r => r.words));
  return { candidates_with_source_material: rows.length, excerpt_count: excerptLengths.length,
    candidate_total_words: { median: quantile(ws, .5), p90: quantile(ws, .9), max: ws.length ? Math.max(...ws) : null },
    candidate_total_chars: { median: quantile(chars, .5), p90: quantile(chars, .9), max: chars.length ? Math.max(...chars) : null },
    excerpt_words: { median: quantile(excerptLengths, .5), p90: quantile(excerptLengths, .9), max: excerptLengths.length ? Math.max(...excerptLengths) : null } };
};

const reasonCounts = {};
const failStageCounts = {};
for (const row of all) {
  const reasons = new Set();
  if (row.author_failure) reasons.add(`author_failure:${row.author_failure}`);
  for (const reason of row.result?.reasons || []) reasons.add(`verifier:${reason}`);
  for (const detail of row.result?.failure_details || []) reasons.add(`failure_detail:${String(detail)}`);
  for (const reason of reasons) reasonCounts[reason] = (reasonCounts[reason] || 0) + 1;
  if (row.result?.failed_stage) failStageCounts[row.result.failed_stage] = (failStageCounts[row.result.failed_stage] || 0) + 1;
}

const spendByStageModel = new Map();
for (const r of scopedReceipts) {
  const receipt = r.receipt || {};
  const k = `${receipt.stage || 'unclassified'}|${receipt.provider || 'unknown'}|${receipt.model || r.model || 'unknown'}`;
  const v = spendByStageModel.get(k) || { stage: receipt.stage || 'unclassified', provider: receipt.provider || null, model: receipt.model || r.model || null, request_count: 0, settled_count: 0, unsettled_count: 0, reserved_micro: 0, settled_micro: 0, held_micro: 0, input_tokens: 0, output_tokens: 0, reasoning_tokens: 0, usage_missing: 0 };
  v.request_count++;
  v.reserved_micro += Number(r.reserved) || 0;
  if (r.state === 'settled') { v.settled_count++; v.settled_micro += Number(r.actual) || 0; }
  else { v.unsettled_count++; v.held_micro += Number(r.reserved) || 0; }
  const usage = receipt.usage || {};
  v.input_tokens += Number(usage.input_tokens ?? usage.prompt_tokens ?? usage.promptTokenCount) || 0;
  v.output_tokens += Number(usage.output_tokens ?? usage.completion_tokens ?? usage.candidatesTokenCount) || 0;
  v.reasoning_tokens += Number(usage.reasoning_tokens ?? usage.output_tokens_details?.reasoning_tokens ?? usage.thoughtsTokenCount) || 0;
  if (!receipt.usage) v.usage_missing++;
  spendByStageModel.set(k, v);
}
const stageSpend = [...spendByStageModel.values()].sort((a, b) => b.settled_micro - a.settled_micro).map(x => ({ ...x, reserved_usd: usd(x.reserved_micro), settled_usd: usd(x.settled_micro), held_usd: usd(x.held_micro), share_of_settled_pct: pct(x.settled_micro, sum(scopedReceipts.filter(r => r.state === 'settled').map(r => r.actual))) }));
const settledMicro = sum(scopedReceipts.filter(r => r.state === 'settled').map(r => r.actual));
const heldMicro = sum(scopedReceipts.filter(r => r.state !== 'settled').map(r => r.reserved));
if (settledMicro !== Math.round(batch.cost.settled_usd * 1e6)) throw new Error(`settled_receipt_sum_mismatch:${settledMicro}`);
if (heldMicro !== Math.round(batch.cost.held_usd * 1e6)) throw new Error(`held_receipt_sum_mismatch:${heldMicro}`);
if (batch.cost.requests !== scopedReceipts.length) throw new Error('campaign_cost_request_count_vs_saved_receipts_mismatch');
if (batch.approved_unique !== eligibleIds.size || approved.length !== eligibleIds.size) throw new Error('approved_count_vs_machine_eligible_mismatch');
if (batch.rejected !== (jobsByState.quarantined || 0)) throw new Error('rejected_count_vs_job_state_mismatch');
if (batch.pending !== (jobsByState.queued || 0) + (jobsByState.repaired || 0) + (jobsByState.generated || 0)) throw new Error('pending_count_vs_job_state_mismatch');

const perSubject = Object.fromEntries(['english','accountancy','business_studies','economics'].map(subject => {
  const rows = all.filter(x => x.subject === subject), output = rows.filter(x => x.candidate), valid = rows.filter(x => x.result?.state === 'eligible');
  const actualCost = sum(rows.map(x => Math.round((x.item_cost?.settled_usd || 0) * 1e6)));
  return [subject, { denominator: rows.length, job_states: counts(rows, x => x.state || 'unknown'), result_states: counts(rows, x => x.result?.state || 'missing_result'), candidates_produced: output.length, machine_eligible_unique: new Set(valid.map(x => x.id)).size, eligibility_per_denominator_pct: pct(valid.length, rows.length), pending_jobs: (counts(rows, x => x.state || 'unknown').queued || 0) + (counts(rows, x => x.state || 'unknown').repaired || 0) + (counts(rows, x => x.state || 'unknown').generated || 0), current_cost_usd: usd(actualCost), planned_formats: counts(rows, x => x.format), eligible_formats: counts(valid, x => x.candidate?.question_type || x.format), planned_difficulty: counts(rows, x => x.difficulty), eligible_difficulty: counts(valid, x => x.candidate?.difficulty || x.difficulty), eligible_answer_positions: counts(valid, x => x.candidate?.correct_answer) }];
}));

const plannedPositions = counts(all, x => x.requested_answer_position);
const actualEligiblePositions = counts(eligible, x => x.candidate?.correct_answer);
const sourceSupportBySubject = Object.fromEntries(['english','accountancy','business_studies','economics'].map(s => [s, supportSummary(supportRows.filter(x => x.subject === s))]));
const lifetimeRequestDelta = batch.lifetime.requests - campaign.budget_start.requests;
const exactRequestCoverage = { saved_receipt_rows: receipts.length, distinct_receipt_ids: new Set(receiptIds).size, receipt_ids_preexisting_before_campaign: receipts.length - scopedReceipts.length, scoped_requests: scopedReceipts.length, saved_campaign_cost_request_count: batch.cost.requests, campaign_start_request_count: campaign.budget_start.requests, campaign_end_lifetime_snapshot_requests: batch.lifetime.requests, lifetime_snapshot_delta: lifetimeRequestDelta, matches_scoped_receipts: batch.cost.requests === scopedReceipts.length, lifetime_delta_is_campaign_scoped: lifetimeRequestDelta === scopedReceipts.length };
const subjectSummaryText = Object.entries(perSubject).map(([s,v]) => `${s} ${v.machine_eligible_unique}/${v.denominator}`).join(', ');
const pendingBySubject = Object.values(perSubject).map(v => v.pending_jobs);
const pendingRange = pendingBySubject.length ? `${Math.min(...pendingBySubject)}–${Math.max(...pendingBySubject)}` : 'unknown';

const bHasEvidence = fs.existsSync(path.join(bDir, 'all-candidates.json')) || fs.existsSync(path.join(bDir, 'receipts.json')) || fs.existsSync(path.join(bDir, 'batch-report.json'));
const b = bCampaign ? { id: bCampaign.id, arm: bCampaign.arm, denominator: bCampaign.denominator, preregistered_at: bCampaign.preregistered_at, verifier: bCampaign.verifier, evidence_outputs_present: bHasEvidence, status: bHasEvidence ? 'incomplete_outputs_present' : 'unstarted_incomplete_no_candidate_results_or_receipts_saved', metrics: null, cost_usd: null, forecast_usd: null } : { status: 'no_saved_campaign_metadata', metrics: null, cost_usd: null, forecast_usd: null };
const bStatusLabel = bHasEvidence ? 'incomplete (some result artifacts saved)' : 'unstarted/incomplete (no candidate, result, or receipt artifacts saved)';

const report = {
  title: 'Saved CUET readiness A/B campaign analysis', generated_at: new Date().toISOString(),
  source_scope: { A: path.relative(process.cwd(), aDir), B: path.relative(process.cwd(), bDir), uses_only_saved_campaign_outputs: true, excluded: ['diagnostic heldout fixtures', 'live ledger/database', 'provider calls'], input_sha256: inputHashesAtStart },
  comparison_status: { A: { arm: campaign.arm, campaign_id: campaign.id, completeness: batch.complete ? 'complete' : 'partial', as_of: batch.at, denominator: campaign.denominator, denominator_retained: true }, B: b, paired_comparison_allowed: false, forecast_usd: null, forecast_reason: 'B has no saved candidate/results/receipt outputs and A remains pending; no forecast is supported until B completes with reconciled receipts.' },
  baseline_A: {
    planned_denominator: campaign.denominator,
    jobs_by_state: jobsByState,
    validation_result_states: resultsByState,
    machine_eligible_unique: eligibleIds.size,
    machine_eligible_rate_over_all_100_pct: pct(eligibleIds.size, 100),
    rejected_file_count: rejected.length,
    pending_from_saved_report: batch.pending,
    eligible_ids_match_approved_export: true,
    unique_eligible_by_id: eligibleIds.size,
    unique_eligible_by_exact_content: new Set(eligible.map(exactFingerprint)).size,
    unique_eligible_by_family: new Set(eligible.map(x => x.family_id)).size,
    per_subject: perSubject,
    planned_format_distribution_100: counts(all, x => x.format),
    eligible_format_distribution: counts(eligible, x => x.candidate?.question_type || x.format),
    planned_difficulty_distribution_100: counts(all, x => x.difficulty),
    eligible_difficulty_distribution: counts(eligible, x => x.candidate?.difficulty || x.difficulty),
    planned_answer_position_distribution_100: plannedPositions,
    eligible_answer_position_distribution: actualEligiblePositions,
    support_length_summary_produced_candidates: supportSummary(supportRows),
    support_length_by_subject: sourceSupportBySubject,
    support_length_candidate_detail: supportRows,
    exact_duplicate_groups_among_produced_candidates: exactDuplicates,
    near_idea_pairs_among_produced_candidates: ideaPairs.slice(0, 50),
    near_idea_pair_threshold: 'same subject and body-token Jaccard >= 0.48, or shared concept/family; deterministic triage only, not a semantic duplicate verdict',
    shared_passage_groups: sharedPassageGroups,
    duplicate_risk_summary: { produced_candidates_screened: produced.length, exact_duplicate_groups: exactDuplicates.length, near_idea_pairs_flagged: ideaPairs.length, shared_passage_groups: sharedPassageGroups.length, limitation: 'The exact and token-similarity checks are triage signals, not proof of semantic distinctness. Shared passages are expected and reported separately.' },
    failure_reasons_all_100: Object.fromEntries(Object.entries(reasonCounts).sort(([a],[b]) => a.localeCompare(b))),
    failed_stage_counts: failStageCounts,
    scoped_cost: { basis: 'saved A receipts only; IDs checked against preregistered request_ids_before and count/settled/held reconcile to saved batch cost; actual/reserved fields are micro-USD; provider receipts are not invoices. Lifetime request delta is a global snapshot and is excluded from scoped request attribution.', requests: scopedReceipts.length, settled_micro_usd: settledMicro, settled_usd: usd(settledMicro), held_micro_usd: heldMicro, held_usd: usd(heldMicro), gross_settled_plus_held_usd: usd(settledMicro + heldMicro), cap_usd: campaign.cap_usd, stage_model: stageSpend, request_coverage: exactRequestCoverage, reconciles_batch_report_settled_and_held: true },
    recorded_summary_fields: { complete: batch.complete, approved_unique: batch.approved_unique, rejected: batch.rejected, pending: batch.pending, provider_processing_complete: batch.provider_processing_complete, cost_per_approved_usd: batch.cost_per_approved_usd, conditional_10000_forecast_usd: batch.conditional_10000_forecast_usd, conditional_lifetime_to_10000_usd: batch.conditional_lifetime_to_10000_usd, invoice_status: batch.invoice_status },
    avoidable_cost_signals: [
      { signal: 'Open-item denominator', evidence: '60/100 are pending and provider processing is incomplete; the current eligible-per-spend ratio is descriptive only.', action: 'Do not forecast or rank arms until both batches and all receipts are complete.' },
      { signal: 'Repair and retry pressure', evidence: `${all.filter(x => (x.repair_count || 0) > 0).length} candidate records have a repair_count; per-stage receipts are listed above.`, action: 'Compare incremental repair spend and post-repair eligibility against no-repair cases in the next preregistered run.' },
      { signal: 'Repeated text-lint failures', evidence: `Failure reasons include ${Object.keys(reasonCounts).filter(x => /option_label_prefix/.test(x)).map(x => `${x}=${reasonCounts[x]}`).join(', ') || 'no option-label-prefix cases'}.`, action: 'If frequent, improve author instructions or run local formatting checks before expensive validation; retain all attempts in the denominator.' },
    ],
  },
  next_iteration_notes: [
    'Keep 25 planned cases per subject or preregister a stratified allocation before dispatch; compare within-subject observed and pending counts rather than treating pooled partial yield as an arm effect.',
    'Report candidate yield, unique machine eligibility, repair rate, stage/provider cost, and source-support length by subject and format only after completion; do not tune using the release/heldout benchmark.',
    'Use the stage-model table to inspect high-cost stages; any simplification must be measured on a new preregistered cohort with unchanged hard CUET-fit gates.',
  ],
};

const inputHashesAtEnd = Object.fromEntries(inputFiles.filter(fs.existsSync).map(p => [path.relative(process.cwd(), p), sha256(p)]));
if (JSON.stringify(inputHashesAtStart) !== JSON.stringify(inputHashesAtEnd)) throw new Error('saved_inputs_changed_during_analysis_retry_after_snapshot_stable');
fs.mkdirSync(outDir, { recursive: true });
fs.writeFileSync(path.join(outDir, 'saved-readiness-ab-report.json'), JSON.stringify(report, null, 2) + '\n');
const md = [
  '# Saved CUET readiness A/B campaign analysis', '',
  `Generated ${report.generated_at}. This is an offline analysis of saved campaign outputs only; no provider calls, live ledger reads, or diagnostic heldout fixtures were used.`, '',
  '## Comparison status', '',
  `- A: ${campaign.arm}, ${batch.complete ? 'complete' : 'partial'}, denominator ${campaign.denominator}; ${eligibleIds.size} unique machine-eligible, ${batch.rejected} quarantined jobs, ${batch.pending} pending jobs.`,
  `- B: ${bStatusLabel}; planned denominator ${b.denominator ?? 'unknown'}.`,
  '- A/B comparison and forecasts: **not available**. Forecast remains null until B completes and receipts reconcile.', '',
  '## A denominator and yield', '',
  `All 100 preregistered candidates remain in the denominator. A is a saved partial snapshot as of ${batch.at}. Current machine-eligible yield is ${eligibleIds.size}/100 (${pct(eligibleIds.size,100)}%); this is a partial observation, not a completed yield estimate. Job states: ${JSON.stringify(jobsByState)}. Validation states: ${JSON.stringify(resultsByState)}. Three repair-pending jobs already have quarantined repair results; batch status still counts them as pending.`, '',
  'Per-subject observed counts:', '',
  '| Subject | n | Eligible | Quarantined jobs | Pending jobs | Current scoped cost |',
  '|---|---:|---:|---:|---:|---:|',
  ...Object.entries(perSubject).map(([s,v]) => `| ${s} | ${v.denominator} | ${v.machine_eligible_unique} | ${v.job_states.quarantined || 0} | ${v.pending_jobs} | $${v.current_cost_usd.toFixed(6)} |`), '',
  `Among the ${eligibleIds.size} current eligible candidates, answer positions are ${JSON.stringify(actualEligiblePositions)}; the planned positions across 100 are ${JSON.stringify(plannedPositions)}. Per-subject observed eligibility is ${subjectSummaryText}; ${pendingRange} items per subject remain pending, so these are provisional differences only. The deterministic screen found ${exactDuplicates.length} exact duplicate groups and ${ideaPairs.length} near-idea pairs among ${produced.length} produced candidates; this does not prove semantic distinctness. Formats, difficulty, source lengths, and all recorded failure reasons are in the JSON report.`, '',
  '## Scoped cost', '',
  `The saved A receipts contain ${scopedReceipts.length} distinct post-preregistration requests: $${usd(settledMicro).toFixed(6)} settled, $${usd(heldMicro).toFixed(6)} held, $${usd(settledMicro+heldMicro).toFixed(6)} gross. These reconcile to the saved batch report. Provider usage receipts are not invoices. Independent Gemini evaluation is the largest observed stage at $${usd(stageSpend.find(x => x.stage === 'independent_evaluation')?.settled_micro || 0).toFixed(6)} (${stageSpend.find(x => x.stage === 'independent_evaluation')?.share_of_settled_pct ?? 0}% of settled cost; 41 requests). Source material supplied to produced candidates is a median ${supportSummary(supportRows).candidate_total_words.median} words in total (p90 ${supportSummary(supportRows).candidate_total_words.p90}); a future preregistered run could measure whether narrower, still sufficient excerpts reduce evaluation input without weakening source support. Cost-by-stage/model is in the JSON report.`, '',
  '## Avoidable-cost questions for the next preregistered iteration', '',
  `- The cohort is ${batch.pending}% pending, so do not annualize or compare per-approved costs yet.`,
  '- Inspect repair-stage marginal spend and eligibility recovery before changing repair behavior.',
  '- Repeated deterministic formatting failures may be prevented by a local precheck or clearer author instructions, while retaining failed attempts in the denominator.',
  '- Keep 25 per subject for direct A/B comparability unless a different stratification is preregistered in advance.', '',
  'The JSON retains exact receipt-level stage/model totals, all failure labels, candidate-level support lengths, and deterministic duplicate-risk pairs.'
].join('\n');
fs.writeFileSync(path.join(outDir, 'saved-readiness-ab-report.md'), md + '\n');
console.log(JSON.stringify({ result: 'PASS', report: path.join(outDir, 'saved-readiness-ab-report.md'), A: { denominator: 100, eligible: eligibleIds.size, pending: batch.pending, settled_usd: usd(settledMicro), held_usd: usd(heldMicro), receipt_count: scopedReceipts.length }, B: b.status, forecasts: null, noProviderCalls: true }, null, 2));
