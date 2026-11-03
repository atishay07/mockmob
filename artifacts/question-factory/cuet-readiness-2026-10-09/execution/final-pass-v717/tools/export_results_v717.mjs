import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { pathToFileURL } from 'node:url';
const root = process.cwd(), [directoryArg, outputArg] = process.argv.slice(2);
if (!directoryArg || !outputArg) throw Error('usage: <registered-study-directory> <fresh-export-directory>');
const directory = resolve(directoryArg), output = resolve(outputArg);
const read = name => JSON.parse(readFileSync(join(directory, name), 'utf8'));
const registration = read('registration.json'), state = read('state.json'), registry = read('registry.json');
if (!Array.isArray(registration.jobs) || !registration.jobs.length || new Set(registration.jobs.map(job => job.id)).size !== registration.jobs.length) throw Error('invalid_fixed_denominator');
const { scopedAccounting } = await import(pathToFileURL(join(root, 'scripts/pipeline/lib/scopedAccounting.mjs')).href);
const { QUALITY_DIMENSIONS_V717 } = await import(pathToFileURL(join(root, 'scripts/pipeline/lib/scorecardPolicyV717.mjs')).href);
const { canonicalQuestion, contentHash } = await import(pathToFileURL(join(root, 'data/content_evidence.js')).href);
const { hashJSON } = await import(pathToFileURL(join(root, 'data/question_factory_policy.mjs')).href);
const db = new DatabaseSync(join(root, 'data/pipeline-budget.sqlite'), { readOnly: true });
let accounting, cachedReports;
try {
  accounting = scopedAccounting({ db }, registration.id + ':');
  // A stopped wave may have one completed blind report before the two-solver
  // checkpoint exists. Export that receipt-bound evidence without promoting it
  // to a complete validation or changing the frozen study outcome.
  cachedReports = db.prepare("SELECT id,value FROM cache WHERE substr(id,1,15)='v717-scorecard:'").all().map(row => ({ id: row.id, report: JSON.parse(row.value) }));
} finally { db.close(); }
const fixed = existsSync(join(directory, 'cases.json')) ? new Map(read('cases.json').cases.map(row => [row.id, row.candidate])) : new Map();
if (fixed.size && (fixed.size !== registration.jobs.length || registration.jobs.some(job => !fixed.has(job.id)))) throw Error('fixed_case_membership_mismatch');
const items = registration.jobs.map(job => {
  const result = state.cases[job.id] || {}, candidate = result.question || result.generated_candidate || result.rejected_draft || fixed.get(job.id) || null;
  const record = result.question?.evidence?.record, reports = result.checks?.reports || record?.reports || result.blind_frozen?.reports || [];
  const audit = result.checks?.audit || record?.audit || null, decision = record?.decision || result;
  const requests = accounting.requests.filter(row => row.candidate_id === job.id);
  const settled_usd = requests.reduce((sum, row) => sum + row.settled_micro, 0) / 1e6;
  const held_usd = requests.reduce((sum, row) => sum + row.held_micro, 0) / 1e6;
  const content = candidate ? canonicalQuestion(candidate) : null;
  const knownKeys = new Set([...reports, ...(audit ? [audit] : [])].map(report => report.request_key));
  const partialReports = candidate ? cachedReports.filter(({ id, report }) =>
    id === 'v717-scorecard:' + report.request_key && report.candidate_id === job.id && report.content_hash === contentHash(candidate) &&
    report.prompt_version === registration.profile && report.validation_contract_hash === registration.contract_hash && report.evaluation_prompt === registration.prompt_hash &&
    ['blind_solution', 'independent_evaluation', 'explanation_support'].includes(report.stage) && !knownKeys.has(report.request_key) &&
    requests.some(request => request.state === 'settled' && request.provider === report.provider && request.stage === report.stage &&
      request.request_id === hashJSON({ campaign: registration.id, parent: report.request_key }))
  ).map(({ report }) => report) : [];
  return { id: job.id, subject: candidate?.subject || job.subject, state: result.state || 'not_started',
    outcome: result.outcome || null, academic_sound: result.academic_sound ?? null, quality_score: result.quality_score ?? null,
    difficulty_target: candidate?.difficulty || null, difficulty_verified: result.difficulty || null,
    route_band: result.route_band || null, modes: result.modes || null,
    question: content?.body || null, passage: candidate?.passage_text || null, options: content?.options || null,
    proposed_key: content?.key || null, proposed_explanation: content?.explanation || null,
    independently_solved_keys: [...reports, ...partialReports.filter(report => report.stage !== 'explanation_support')].map(report => ({ provider: report.provider, key: report.solved_key, answer_set: report.answer_set, derivation: report.derivation })),
    decisive_registered_excerpts: (candidate?.source_refs || []).map(ref => ({ ...ref, title: registry.sources[ref.id]?.title || null, text: registry.sources[ref.id]?.facts?.[ref.locator]?.text || null })),
    criteria: Object.entries(QUALITY_DIMENSIONS_V717).map(([id, parameter]) => ({ id, parameter,
      verified_aggregate: decision.criteria?.find(row => row.id === id) || null,
      feedback: [...reports, ...(audit ? [audit] : []), ...partialReports].filter(report => report.scores?.[id]).map(report => ({ provider: report.provider, stage: report.stage, ...report.scores[id] })) })),
    validation_reports: reports, explanation_audit: audit,
    partial_independent_reports: partialReports,
    reasons: result.reasons || (result.error ? [result.error] : []), advisory_feedback: result.advisory_issues || [],
    actual_cost: { settled_usd, held_usd, complete_receipts: requests.length > 0 && requests.every(row => row.state === 'settled'), requests }
  };
});
const eligible = items.filter(row => row.state === 'eligible'), nta = eligible.filter(row => row.modes?.nta === true);
const settled_usd = accounting.settled_micro / 1e6, held_usd = accounting.held_micro / 1e6;
const terminal = items.filter(row => ['eligible', 'quarantined', 'error'].includes(row.state)).length;
const actualMeasured = registration.kind === 'pilot' && accounting.requests.length > 0 && accounting.receipt_complete && held_usd === 0 && terminal === items.length && eligible.every(row => row.actual_cost.requests.length > 0);
const forecast = count => actualMeasured && count > 0 ? settled_usd / count * 10000 : null;
const summary = { schema: 'cuet-v717-full-results-export-v1', created_at: new Date().toISOString(), id: registration.id,
  kind: registration.kind, profile: registration.profile, denominator: items.length, terminal, not_started: items.filter(row => row.state === 'not_started').length,
  eligible: eligible.length, nta_eligible: nta.length, settled_usd, held_usd, receipt_complete: accounting.receipt_complete,
  partial_report_items: items.filter(row => row.partial_independent_reports.length > 0).length,
  cost_attribution: 'Persistent request reservations and receipts scoped by campaign prefix, including failures/retries/reasoning; lifetime deltas never used.',
  accounted_item_settled_usd: items.reduce((sum, row) => sum + row.actual_cost.settled_usd, 0),
  accounted_item_held_usd: items.reduce((sum, row) => sum + row.actual_cost.held_usd, 0),
  approved_eligibility_estimate_usd_per_10000: forecast(eligible.length), nta_eligibility_estimate_usd_per_10000: forecast(nta.length),
  publication_verified: false, production_published: 0,
  forecast_limits: registration.kind === 'pilot' ? 'Eligibility-based sample extrapolation only; publication inspection, complete atomic groups and actual retrieval may reduce yield. Fixed startup/development/research and unpriced future supply effects are not estimated here. Budget-stop/held/incomplete studies produce no completed-yield forecast.' : 'Qualification has intentionally defective controls and no authoring; it cannot estimate cost per generated publishable question.',
  by_subject: Object.fromEntries(['accountancy', 'business_studies', 'economics', 'english'].map(subject => [subject, { denominator: items.filter(row => row.subject === subject).length, eligible: eligible.filter(row => row.subject === subject).length, nta_eligible: nta.filter(row => row.subject === subject).length }])),
  eligible_quality_parameters: Object.entries(QUALITY_DIMENSIONS_V717).map(([id, parameter]) => {
    const values = eligible.map(row => row.criteria.find(criterion => criterion.id === id).verified_aggregate?.score).filter(score => typeof score === 'number');
    return { id, parameter, scored_items: values.length, mean: values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : null };
  }), difficulty_counts: eligible.reduce((counts, row) => { const level = row.difficulty_verified?.level || 'unknown'; counts[level] = (counts[level] || 0) + 1; return counts; }, {}),
  answer_positions: eligible.reduce((counts, row) => { counts[row.proposed_key] = (counts[row.proposed_key] || 0) + 1; return counts; }, {}),
  items };
if (Math.abs(summary.accounted_item_settled_usd - settled_usd) > 0.000001) throw Error('unattributed_campaign_cost');
if (Math.abs(summary.accounted_item_held_usd - held_usd) > 0.000001 || items.reduce((sum, row) => sum + row.actual_cost.requests.length, 0) !== accounting.requests.length) throw Error('unattributed_campaign_hold_or_request');
mkdirSync(output, { recursive: true });
writeFileSync(join(output, 'questions-and-evidence.json'), JSON.stringify(summary, null, 2) + '\n', { flag: 'wx' });
console.log(JSON.stringify({ path: join(output, 'questions-and-evidence.json'), denominator: summary.denominator, eligible: summary.eligible, settled_usd, held_usd, forecast_available: actualMeasured }));
