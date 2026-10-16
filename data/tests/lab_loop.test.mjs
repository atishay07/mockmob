// The Mistake Lab slice 3 on the result route (data/lab_loop.js, data/mock_swot.js resultHistory labLoop) and the
// committed contracts (data/tests/fixtures/mistake_lab/contract_{across,rules,rulecheck,repair_order}_v1.json).
// After a deliberate change, regenerate them with:  node scripts/mistake-lab/build-s3-fixtures.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { buildS3, S3 } from '../../scripts/mistake-lab/build-s3-fixtures.mjs';
import { FIXTURE_DIR } from '../../scripts/mistake-lab/build-fixtures.mjs';
import { resultHistory } from '../mock_swot.js';
import { buildMistakeLab } from '../mistake_lab.js';
import { buildLabLoop } from '../lab_loop.js';
import { repairRulesFrom } from '../../src/lib/server/ruleBook.js';
import { buildMissedBefore } from '../../src/components/recovery/repairRun.js';

const load = (name) => JSON.parse(readFileSync(join(FIXTURE_DIR, `${name}.json`), 'utf8'));
const CONTRACTS = ['contract_across_v1', 'contract_rules_v1', 'contract_rulecheck_v1', 'contract_repair_order_v1'];
const { USER, M1, M2, M3, M4, PRACTICE, M5_NOT, RESERVATIONS, PLAYBOOK } = S3;
const HISTORY = [M5_NOT, M4, PRACTICE, M3, M2, M1];
const SOURCES = { repairs: repairRulesFrom({ userId: USER, reservations: RESERVATIONS, attempts: HISTORY }), playbook: PLAYBOOK };

test('the slice 3 input and contracts on disk equal what the code builds today', () => {
  const { input, contracts } = buildS3();
  assert.deepEqual(load('across_mocks_input'), JSON.parse(JSON.stringify(input)));
  for (const name of CONTRACTS) assert.deepEqual(load(name), JSON.parse(JSON.stringify(contracts[name])), name);
  assert.deepEqual(Object.keys(load('contract_rulecheck_v1')), ['not_kept', 'kept', 'counted', 'not_checked']);
  for (const [state, c] of Object.entries(load('contract_rulecheck_v1'))) assert.equal(c.state, state);
});

test('the result route adds acrossMocks, repairOrder, rules and prove.ruleCheck to the Lab', async () => {
  const out = await resultHistory({
    attempt: M5_NOT, loadAttempts: async () => HISTORY, recapOf: () => null, missedBeforeOf: buildMissedBefore,
    labLoop: true, ruleSourcesOf: async ({ allAttempts }) => { assert.equal(allAttempts, HISTORY); return SOURCES; },
  });
  const base = buildMistakeLab({ attempt: M5_NOT, answerReviews: {} });
  const { acrossMocks, repairOrder, rules, repaired, prove, ...lab } = out.lab;
  assert.deepEqual(lab, base, 'the slice 1 and 2 contract is unchanged');
  assert.equal(acrossMocks.state, 'ready');
  assert.equal(acrossMocks.mocks, 5, 'as of this paper: the four before it and itself');
  assert.equal(repairOrder.state, 'paper', 'no cohort read was given');
  assert.deepEqual(rules, { count: 7, countLabel: 'Your rules (7)', active: { id: 'habit:never_opened', kind: 'habit', text: 'Open every question once before you go deep on any.', since: PLAYBOOK[0].created_at } });
  const mine = SOURCES.repairs.filter((r) => r.attemptId === M5_NOT.id).map((r) => r.questionId);
  assert.deepEqual(repaired, [...new Set(mine)], 'lab.repaired: the mistakes of this paper with a written repair (F17)');
  assert.equal(prove.ruleCheck.state, 'not_kept');
  assert.equal(prove.ruleCheck.result, 'Not kept: 4 of 50 questions never opened (last mock: 4 of 50).');
});

test('each slice 3 part fails on its own: no rule sources, a failed read, and the old shape without labLoop', async () => {
  const warned = [];
  const failed = await resultHistory({
    attempt: M5_NOT, loadAttempts: async () => HISTORY, recapOf: () => null, missedBeforeOf: buildMissedBefore,
    labLoop: true, ruleSourcesOf: async () => { throw new Error('db down'); }, warn: (n) => warned.push(n),
  });
  assert.deepEqual(warned, ['ruleSources']);
  assert.equal(failed.lab.rules, null);
  assert.equal(failed.lab.repaired, null, 'unknown, never an empty list that would offer paid repairs again');
  assert.deepEqual(failed.lab.prove, { ruleCheck: null });
  assert.equal(failed.lab.acrossMocks.state, 'ready', 'the pure parts still build');
  assert.ok(failed.swot, 'the rest of the result still loads');
  const old = await resultHistory({ attempt: M5_NOT, loadAttempts: async () => HISTORY, recapOf: () => null, missedBeforeOf: buildMissedBefore });
  assert.deepEqual(old.lab, buildMistakeLab({ attempt: M5_NOT, answerReviews: {} }), 'without labLoop the Lab is exactly slice 1 and 2');
  const pending = await resultHistory({ attempt: M5_NOT, answerReviewState: 'loading', loadAttempts: async () => HISTORY, recapOf: () => null, missedBeforeOf: buildMissedBefore, labLoop: true, ruleSourcesOf: async () => SOURCES });
  assert.equal(pending.lab, null, 'nothing until the answer checks are ready');
  // A part that throws is null, and named.
  const heard = [];
  const loop = buildLabLoop({ attempt: M5_NOT, allAttempts: HISTORY, lab: { byQuestion: null }, sources: { repairs: null, playbook: 'not rows' }, warn: (n) => heard.push(n) });
  assert.equal(loop.acrossMocks.state, 'ready');
  assert.ok(heard.every((n) => ['rules', 'ruleCheck', 'repairOrder'].includes(n)));
});

test('a practice set gets no rule check, and a mock before any rule gets none either', async () => {
  const practice = buildLabLoop({ attempt: PRACTICE, allAttempts: HISTORY, lab: buildMistakeLab({ attempt: PRACTICE }), sources: SOURCES });
  assert.equal(practice.prove.ruleCheck, null);
  const first = buildLabLoop({ attempt: M1, allAttempts: HISTORY, lab: buildMistakeLab({ attempt: M1 }), sources: SOURCES });
  assert.equal(first.prove.ruleCheck, null);
  assert.equal(first.acrossMocks.state, 'below_gate', 'as of the first mock, one timed mock');
});
