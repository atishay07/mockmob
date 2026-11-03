import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { runProgressAwareCContinuation, PROGRESS_AWARE_C_POLICY_VERSION } from '../lib/progressAwareCContinuation.mjs';

function sandbox(t) {
  const root = mkdtempSync(join(tmpdir(), 'progress-aware-c-'));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  const campaignDir = join(root, 'future-campaign');
  mkdirSync(campaignDir);
  return { root, campaignDir, statePath: join(campaignDir, 'continuation.json'), logPath: join(campaignDir, 'continuation.log'),
    policyStatePath: join(root, 'policy', 'progress-state.json') };
}
const report = (terminal, blockedIds = [], { complete = false, providerComplete = false } = {}) => ({
  denominator: 100, pending: 100 - terminal, complete, provider_processing_complete: providerComplete,
  publication_accounting: { ready: blockedIds.length === 0, blocked_requests: blockedIds },
});
function runnerArgs(paths, extras = {}) {
  let pid = 1000;
  return { campaignId: 'future-campaign-test', ...paths, policy: { initial_delay_ms: 10, maximum_delay_ms: 80, maximum_runtime_ms: 60_000 },
    maxPolls: 4, now: () => 1_800_000_000_000, isAlive: async () => false,
    launch: async () => ({ pid: pid++, identity: { pid, role: 'worker' }, wait: async () => ({ code: 0, signal: null }) }),
    ...extras };
}

 test('zero progress backs off, then terminal/provider progress resets only the next interval', async t => {
  const paths = sandbox(t), waits = [];
  const sequence = [
    report(0, ['accepted-1']), report(0, ['accepted-1']),
    report(0, ['accepted-1']), report(1, ['accepted-1']),
    report(1, ['accepted-1']), report(1, ['accepted-2']),
    report(1, ['accepted-2']), report(1, ['accepted-2']), report(1, ['accepted-2']),
  ];
  let reads = 0;
  const result = await runProgressAwareCContinuation(runnerArgs(paths, {
    readReport: async () => sequence[Math.min(reads++, sequence.length - 1)],
    sleep: async ms => waits.push(ms),
  }));
  assert.deepEqual(waits, [10, 10, 10, 20]);
  assert.equal(result.status, 'poll_limit');
  assert.equal(result.progress_policy.progress_resets, 2);
  assert.equal(result.progress_policy.last_progress_reason, 'accepted_provider_request_completed');
  assert.equal(result.progress_policy.unchanged_intervals, 1);
});

test('unchanged polls keep exponential delay and persist the policy for a resumed future run', async t => {
  const paths = sandbox(t), firstWaits = [], secondWaits = [];
  let launches = 0;
  const common = { readReport: async () => report(0, ['still-waiting']), sleep: async ms => firstWaits.push(ms), maxPolls: 8,
    launch: async () => ({ pid: 1000 + ++launches, identity: { pid: 1000 + launches, role: 'worker' }, wait: async () => ({ code: 0 }) }),
    stopRequested: () => launches >= 2 };
  const first = await runProgressAwareCContinuation(runnerArgs(paths, common));
  assert.deepEqual(firstWaits, [10, 20]);
  assert.equal(first.status, 'stopped');
  const saved = JSON.parse(readFileSync(paths.policyStatePath, 'utf8'));
  assert.equal(saved.policy_version, PROGRESS_AWARE_C_POLICY_VERSION);
  assert.equal(saved.campaign_id, 'future-campaign-test');
  assert.equal(saved.unchanged_intervals, 2);
  assert.equal(saved.next_delay_ms, 20);

  await runProgressAwareCContinuation(runnerArgs(paths, { readReport: async () => report(0, ['still-waiting']),
    sleep: async ms => secondWaits.push(ms), launch: async () => ({ pid: 2000, identity: { pid: 2000, role: 'worker' }, wait: async () => ({ code: 0 }) }), maxPolls: 4 }));
  assert.deepEqual(secondWaits, [40, 80], 'resumption continues backoff instead of restarting at the shortest interval');
});

test('an observed live worker is waited on before exactly one replacement launch', async t => {
  const paths = sandbox(t), waits = [];
  writeFileSync(paths.statePath, JSON.stringify({ campaign_id: 'future-campaign-test', started_at: 1_800_000_000_000,
    polls: 0, worker_starts: 1, worker_pid: 2345, worker_identity: { pid: 2345, role: 'worker' }, events: [], status: 'worker_running' }));
  let aliveChecks = 0, launches = 0, reads = 0;
  const result = await runProgressAwareCContinuation(runnerArgs(paths, {
    readReport: async () => reads++ < 2 ? report(0, ['accepted-1']) : report(100, [], { complete: true, providerComplete: true }),
    isAlive: async () => ++aliveChecks === 1,
    launch: async () => { launches++; return { pid: 2346, identity: { pid: 2346, role: 'worker' }, wait: async () => ({ code: 0 }) }; },
    sleep: async ms => waits.push(ms), maxPolls: 4,
  }));
  assert.deepEqual(waits, [10, 10]);
  assert.equal(launches, 1);
  assert.equal(result.status, 'complete');
});

test('future-only guard rejects the active C campaign before reading or launching', async () => {
  let calls = 0;
  await assert.rejects(() => runProgressAwareCContinuation({ campaignId: 'cuet-readiness-cost-source-c-100-2026-10-08',
    campaignDir: 'artifacts/question-factory/cu et-readiness-cost-source-c-100-2026-10-08',
    readReport: async () => { calls++; return null; }, sleep: async () => {}, launch: async () => { calls++; } }), /future_campaigns_only/);
  assert.equal(calls, 0);
});
