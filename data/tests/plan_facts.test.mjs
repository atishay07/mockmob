import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  PLAN_FACTS, PLAN_FACTS_CHECKED, confirmLine, contributionRewardLine, costLine, creditLines, creditPopoverLines, freePlanLines, proPlanLines,
  repairCostLine, sessionCost,
} from '../plan_facts.mjs';
import { TEST_MODES } from '../test_modes.js';
import { REPAIR_CREDIT_COST } from '../mistake_repair.js';
import { CUET_PUBLIC_ALLOWED_SUBJECTS } from '../cuet_controls.js';
import { retiredTermIn } from '../glossary.mjs';

const read = (p) => readFileSync(new URL(`../../${p}`, import.meta.url), 'utf8');

test('every fact records its source, and the check date is set', () => {
  assert.match(PLAN_FACTS_CHECKED, /^\d{4}-\d{2}-\d{2}$/);
  const walk = (v, path) => {
    if (v && typeof v === 'object' && 'value' in v && 'source' in v) { assert.ok(String(v.source).length > 8, path); return; }
    for (const [k, child] of Object.entries(v)) walk(child, `${path}.${k}`);
  };
  walk(PLAN_FACTS, 'PLAN_FACTS');
});

test('facts match the code constants they mirror', () => {
  assert.equal(PLAN_FACTS.practiceCredits.quickCost.value, TEST_MODES.quick.creditCost);
  assert.equal(PLAN_FACTS.practiceCredits.fullMockCost.value, TEST_MODES.full.creditCost);
  assert.deepEqual(PLAN_FACTS.sessions.quickCounts.value, TEST_MODES.quick.countOptions);
  assert.equal(PLAN_FACTS.sessions.fullMinutes.value * 60, TEST_MODES.full.fixedDurationSec);
  assert.equal(PLAN_FACTS.aiCredits.repairCost.value, REPAIR_CREDIT_COST);
  assert.equal(PLAN_FACTS.subjects.count.value, CUET_PUBLIC_ALLOWED_SUBJECTS.length);
  // aiCreditWallet.js is server-only, so its constants are read from the source.
  const wallet = read('src/services/credits/aiCreditWallet.js');
  assert.match(wallet, new RegExp(`AI_FREE_MONTHLY_CREDITS = ${PLAN_FACTS.aiCredits.freeMonthly.value};`));
  assert.match(wallet, new RegExp(`AI_PRO_INCLUDED_MONTHLY_CREDITS = ${PLAN_FACTS.aiCredits.proMonthly.value};`));
  assert.match(read('src/app/api/ai/mentor/chat/route.js'), new RegExp(`creditCost: ${PLAN_FACTS.aiCredits.askMobiReplyCost.value},`));
  assert.match(read('data/recovery.js'), /correct \* 5 - wrong/);
  // The starting balance is the migration default production carries.
  assert.match(read('supabase/migrations/0027_enforce_credit_integrity.sql'), new RegExp(`DEFAULT ${PLAN_FACTS.practiceCredits.startingBalance.value}`));
});

test('no recurring grant is promised: production grants nothing for logins, votes or uploads', () => {
  for (const grant of Object.values(PLAN_FACTS.practiceCredits.grants)) assert.equal(grant.value, 0);
  assert.equal(contributionRewardLine(), 'No credit reward is promised for a submission.');
});

test('cost and confirm lines say the number, never "credit-gated"', () => {
  assert.equal(sessionCost('quick'), 10);
  assert.equal(sessionCost('full'), 50);
  assert.equal(sessionCost('nta'), null);
  assert.equal(sessionCost('nta', { pro: true }), 0);
  assert.equal(costLine('quick', { balance: 40 }), 'Uses 10 of your 40 practice credits.');
  assert.equal(costLine('full', { balance: 40 }), 'Uses 50 practice credits. You have 40.');
  assert.equal(costLine('quick', { pro: true }), 'Included with Pro.');
  assert.equal(costLine('smart'), 'Comes with Pro.');
  assert.equal(costLine('quick', { balance: 1 }), 'Uses 10 practice credits. You have 1.');
  assert.equal(confirmLine({ mode: 'quick', count: 10, balance: 40 }), '10 questions, about 10 minutes. +5 right, -1 wrong. Uses 10 of your 40 practice credits.');
  assert.equal(confirmLine({ mode: 'full', balance: 120 }), '50 questions, 60 minutes. +5 right, -1 wrong. Uses 50 of your 120 practice credits.');
  assert.equal(repairCostLine({ aiBalance: 10 }), '1 AI credit each. You have 10.');
  assert.equal(repairCostLine(), '1 AI credit each.');
});

test('credit lines are labelled; Pro shows no practice count', () => {
  assert.deepEqual(creditLines({ practiceBalance: 40, aiRemaining: 9 }).map((l) => l.label), ['40 practice credits', '9 AI credits']);
  assert.deepEqual(creditLines({ practiceBalance: 0, aiRemaining: 50, pro: true }).map((l) => l.label), ['50 AI credits']);
  assert.deepEqual(creditLines({ practiceBalance: null, aiRemaining: null }), []);
  const lines = creditPopoverLines({ practiceBalance: 40, aiRemaining: 8, resetAt: '2026-10-31T18:30:00.000Z' }).map((l) => l.text);
  assert.deepEqual(lines, ['Practice credits 40: pay for mocks and practice.', 'AI credits 8 of 10 this month: pay for Mistake Repair and Ask Mobi. Renews 1 Nov.']);
});

test('plan lines are plain, in numbers, and use approved names', () => {
  const lines = [...freePlanLines(), ...proPlanLines()];
  assert.equal(freePlanLines()[0], 'Start with 100 practice credits. A 10-question practice uses 10, a full mock uses 50.');
  assert.equal(freePlanLines()[1], '10 AI credits every month. One Mistake Repair uses 1.');
  for (const line of lines) {
    assert.doesNotMatch(line, /[!—]|credit-gated|generate/i, line);
    assert.equal(retiredTermIn(line), null, line);
  }
  assert.ok(proPlanLines().includes('50 AI credits a month'));
  // The price is never stored here: it comes from publicOffer().
  const values = [];
  const walk = (v) => { if (v && typeof v === 'object' && 'value' in v) values.push(v.value); else if (v && typeof v === 'object') Object.values(v).forEach(walk); };
  walk(PLAN_FACTS);
  assert.doesNotMatch(JSON.stringify(values), /₹|rupees|\b99\b/);
});
