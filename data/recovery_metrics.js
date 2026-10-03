// Validation metrics for recovery pathways, computed from stored episode projections.
// Descriptive only: every rate carries its sample size and a Wilson interval, and nothing
// here is a causal effect, a mastery level or a recovered-marks figure. No raw answers,
// identities or free text leave this function; a cohort below MIN_REPORTABLE is suppressed.
import { wilson } from './prepos_insights.js';

const HOUR = 3_600_000; const DAY = 24 * HOUR;
export const MIN_REPORTABLE = 5;        // smaller groups are shown as "fewer than 5", never as rates
export const MIN_DECISION_SAMPLE = 30;  // below this, no keep/kill decision is taken (see DECISION record)
export const OVERDUE_GRACE_MS = 3 * DAY;
export const STALLED_REPAIR_MS = 7 * DAY;

// k of n, with a Wilson interval. Small groups are suppressed rather than shown as a rate.
const rate = (k, n) => n < MIN_REPORTABLE ? { n, suppressed: true } : { n, k, ...wilson(k, n) };

function episodeFacts(row, now) {
  const e = row.projection || {}; const checks = e.checks || []; const observations = e.observations || [];
  const probes = observations.filter(o => o.kind === 'probe');
  const stage = name => checks.filter(c => c.stage === name);
  const lastFailure = checks.findLastIndex(c => !c.correct);
  const qualifying = checks.slice(lastFailure + 1).filter(c => c.correct && ['delayed_check_1', 'delayed_check_2'].includes(c.stage));
  return {
    state: e.state, created: Date.parse(row.created_at) || e.createdAt || 0,
    probes: probes.length, diagnosis: e.diagnosis?.conflict ? 'conflict' : e.diagnosis?.supported || (e.state === 'investigating' ? 'pending' : 'unsupported'),
    repaired: Boolean(e.repairAt) || checks.length > 0,
    immediate: stage('immediate_check'), delayed1: stage('delayed_check_1'), delayed2: stage('delayed_check_2'), maintained: stage('maintained'),
    incomplete: checks.filter(c => c.incompleteReason).length,
    passedTwoFresh: e.state !== 'invalidated' && qualifying.length >= 2,
    overdue: ['delayed_check_1', 'delayed_check_2'].includes(e.state) && e.nextDueAt && now - e.nextDueAt > OVERDUE_GRACE_MS,
    overdueMaintenance: e.state === 'maintained' && e.nextDueAt && now - e.nextDueAt > OVERDUE_GRACE_MS,
    stalledRepair: ['investigating', 'repairing', 'needs_repair'].includes(e.state) && now - (Date.parse(row.updated_at) || observations.at(-1)?.at || e.createdAt || 0) > STALLED_REPAIR_MS,
    probePair: probes.length >= 2 ? probes.slice(0, 2) : null,
  };
}

/**
 * @param rows   learning_episodes rows: { id, concept_id, pathway: { version }, projection, created_at, updated_at }
 * @param costs  { paidModelCalls, providerUsd, contentUsd, contentLimitUsd } from receipts/ledgers; unknown stays null
 */
export function recoveryValidationMetrics(rows = [], { now = Date.now(), costs = {}, pathways = {} } = {}) {
  const groups = new Map();
  for (const row of rows) {
    const key = `${row.concept_id}@v${row.pathway?.version ?? '?'}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(row);
  }
  const report = {};
  for (const [key, list] of groups) {
    const facts = list.map(r => episodeFacts(r, now));
    const pathway = pathways[key.split('@')[0]];
    const started = facts.length; const count = f => facts.filter(f).length;
    const checksOf = name => facts.flatMap(f => f[name]);
    const stageRate = name => { const c = checksOf(name).filter(c => !c.incompleteReason); return rate(c.filter(c => c.correct).length, c.length); };
    const diagnoses = {}; for (const f of facts) diagnoses[f.diagnosis] = (diagnoses[f.diagnosis] || 0) + 1;
    // Concordance: did the second probe agree with a hypothesis the first probe allowed?
    // Low agreement means the mapping, not the student, needs revisiting.
    const pairs = facts.map(f => f.probePair).filter(Boolean);
    let agreeing = 0;
    if (pathway) for (const [a, b] of pairs) {
      const allowed = item => { const probe = pathway.probes.find(p => p.id === item.itemId); return probe ? pathway.hypotheses.filter(h => probe.matrix[h].includes(item.value)) : []; };
      const first = allowed(a); if (allowed(b).some(h => first.includes(h))) agreeing++;
    }
    report[key] = {
      sample: { episodes: started, learners: new Set(list.map(r => r.user_id).filter(Boolean)).size, decisionReady: started >= MIN_DECISION_SAMPLE },
      completion: {
        reachedRepair: count(f => f.state !== 'investigating'), finishedRepair: count(f => f.repaired),
        passedTwoFreshChecks: count(f => f.passedTwoFresh), maintained: count(f => f.state === 'maintained'),
        finishedRepairRate: rate(count(f => f.repaired), started),
      },
      freshChecks: { immediate: stageRate('immediate'), delayed1: stageRate('delayed1'), delayed2: stageRate('delayed2'), maintenance: stageRate('maintained'),
        incompleteOrExpired: checksOf('immediate').concat(checksOf('delayed1'), checksOf('delayed2'), checksOf('maintained')).filter(c => c.incompleteReason).length },
      attrition: { overdueDelayedChecks: count(f => f.overdue), overdueMaintenanceChecks: count(f => f.overdueMaintenance), stalledRepairs: count(f => f.stalledRepair),
        overdueRate: rate(count(f => f.overdue), count(f => f.immediate.some(c => c.correct))) },
      diagnosis: { counts: diagnoses, probeConcordance: pathway ? rate(agreeing, pairs.length) : { n: pairs.length, unavailable: 'pathway not supplied' } },
      contentDefects: { blockedContent: count(f => f.state === 'blocked_content'), invalidated: count(f => f.state === 'invalidated') },
    };
  }
  return {
    generatedAt: new Date(now).toISOString(), minimumReportable: MIN_REPORTABLE, minimumDecisionSample: MIN_DECISION_SAMPLE,
    pathways: report,
    cost: { paidModelCallsInCoreFlow: costs.paidModelCalls ?? null, providerUsd: costs.providerUsd ?? null, contentUsd: costs.contentUsd ?? null, contentLimitUsd: costs.contentLimitUsd ?? null,
      perStartedEpisodeUsd: costs.contentUsd != null && rows.length ? Math.round(costs.contentUsd / rows.length * 10000) / 10000 : null },
    caveats: [
      'Descriptive cohort figures. Passing fresh checks is evidence about these checks, not a causal score gain.',
      'Learners chose to start and return; completers are not a random sample.',
      `Groups under ${MIN_REPORTABLE} are suppressed; no keep/kill decision below ${MIN_DECISION_SAMPLE} episodes.`,
    ],
  };
}
