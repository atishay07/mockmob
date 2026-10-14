import test from 'node:test';
import assert from 'node:assert/strict';
import {
  FIRST_CHECK, accessSummary, arrivedWithSetup, confirmCost, confirmLine, costValue, isFirstCheck, planSetup, planStepIsSetup, practiceLead, sessionTally, stripReason,
} from '../practice_landing.mjs';
import { TEST_MODES } from '../test_modes.js';

const attempt = { id: 'a1', correct: 6, total: 10, score: 60 };
const resume = { href: '/test?subject=accountancy&count=10&mode=quick&generationKey=k', label: 'accountancy test', minutesLeft: 23 };
const repairPlan = { primary: { kind: 'repair', title: 'Continue your reasoning repair', href: '/recovery?episode=e1', reason: 'Pick up the activity you started.' } };
const practicePlan = { primary: { kind: 'ordinary_practice', title: 'Start 20 practice questions', href: '/dashboard?mode=quick&count=20', reason: '20 questions, about 20 minutes.' } };
const params = (query) => new URLSearchParams(query);

test('a saved unfinished test leads, over every other state', () => {
  for (const attempts of [[], [attempt]]) {
    const lead = practiceLead({ attempts, resume, plan: repairPlan, planState: 'ready', arrivedWithSetup: true, touched: true });
    assert.deepEqual(lead, { kind: 'resume', strip: 'hidden', setupDominant: false });
  }
});

test('a member with no submitted session is offered the 10-question check, with no plan strip', () => {
  assert.deepEqual(practiceLead({ attempts: [], resume: null, plan: repairPlan, planState: 'ready' }), { kind: 'first', strip: 'hidden', setupDominant: true });
  assert.deepEqual(FIRST_CHECK, { mode: 'quick', count: 10 });
  assert.equal(isFirstCheck({ lead: { kind: 'first' }, modeId: 'quick', count: 10 }), true);
  assert.equal(isFirstCheck({ lead: { kind: 'first' }, modeId: 'quick', count: 15 }), false, 'a changed size is ordinary practice');
  assert.equal(isFirstCheck({ lead: { kind: 'first' }, modeId: 'full', count: 50 }), false);
  assert.equal(isFirstCheck({ lead: { kind: 'setup' }, modeId: 'quick', count: 10 }), false);
});

test('unknown attempts are not treated as a first visit', () => {
  assert.notEqual(practiceLead({ attempts: null, resume: null, planState: 'loading' }).kind, 'first');
  assert.notEqual(practiceLead({ attempts: undefined, resume: null, planState: 'loading' }).kind, 'first');
});

test('a plan step elsewhere leads until the student starts choosing their own setup', () => {
  assert.deepEqual(practiceLead({ attempts: [attempt], plan: repairPlan, planState: 'ready' }), { kind: 'step', strip: 'step', setupDominant: false });
  assert.deepEqual(practiceLead({ attempts: [attempt], plan: repairPlan, planState: 'ready', touched: true }), { kind: 'step', strip: 'step', setupDominant: true });
});

test('a plan step that points back at Practice is applied in place, the Start button stays dominant', () => {
  assert.deepEqual(practiceLead({ attempts: [attempt], plan: practicePlan, planState: 'ready' }), { kind: 'setup', strip: 'setup', setupDominant: true });
});

test('loading and failed plans never block the setup', () => {
  assert.deepEqual(practiceLead({ attempts: [attempt], planState: 'loading' }), { kind: 'setup', strip: 'loading', setupDominant: true });
  assert.deepEqual(practiceLead({ attempts: [attempt], planState: 'error' }), { kind: 'setup', strip: 'error', setupDominant: true });
  assert.equal(practiceLead({ attempts: [attempt], plan: { primary: { title: 'x' } }, planState: 'ready' }).strip, 'error', 'a step without a link is not shown');
});

test('arriving with a chosen setup hides the strip that would repeat it', () => {
  assert.equal(arrivedWithSetup(params('mode=quick&count=20')), true);
  assert.equal(arrivedWithSetup(params('subject=accountancy&chapter=Partnership')), true);
  assert.equal(arrivedWithSetup(params('tonightKey=k&tonightMinutes=20')), true);
  assert.equal(arrivedWithSetup(params('')), false);
  assert.equal(arrivedWithSetup(params('home=1&count=')), false, 'empty values and unrelated keys do not count');
  assert.equal(arrivedWithSetup(null), false);
  assert.deepEqual(practiceLead({ attempts: [attempt], plan: repairPlan, planState: 'ready', arrivedWithSetup: true }), { kind: 'setup', strip: 'hidden', setupDominant: true });
});

test('setup steps are read from the plan link, and only for real modes and sizes', () => {
  assert.equal(planStepIsSetup({ href: '/dashboard' }), true);
  assert.equal(planStepIsSetup({ href: '/dashboard?mode=quick' }), true);
  assert.equal(planStepIsSetup({ href: '/dashboard-old' }), false);
  assert.equal(planStepIsSetup({ href: '/recovery?episode=1' }), false);
  assert.equal(planStepIsSetup(null), false);
  assert.deepEqual(planSetup(practicePlan.primary, TEST_MODES), { mode: 'quick', count: 20 });
  assert.deepEqual(planSetup({ href: '/dashboard?mode=quick&count=7' }, TEST_MODES), { mode: 'quick', count: null }, 'an unsupported size is not applied');
  assert.equal(planSetup({ href: '/dashboard?mode=warp&count=10' }, TEST_MODES), null);
  assert.equal(planSetup({ href: '/dashboard' }, TEST_MODES), null);
  assert.equal(planSetup(repairPlan.primary, TEST_MODES), null);
});

test('the confirm line names size, time and cost the way the app writes it', () => {
  const quote = { launchable: true, creditCost: 10 };
  assert.equal(confirmLine({ count: 10, minutes: 10, quoteState: 'ready', quote }), '10 questions, 10 minutes. 10 credits.');
  assert.equal(confirmLine({ count: 15, minutes: 17.6, approximate: true, quoteState: 'ready', quote: { launchable: true, creditCost: 0 }, isPremium: true }), '15 questions, about 18 minutes. Included with Pro.');
  assert.equal(confirmLine({ count: 50, minutes: 60, quoteState: 'ready', quote: { launchable: true, creditCost: 50 } }), '50 questions, 60 minutes. 50 credits.');
  assert.equal(confirmLine({ count: 1, minutes: 0.4, quoteState: 'ready', quote: { launchable: true, creditCost: 1 } }), '1 question, 1 minute. 1 credit.');
});

test('cost is never guessed: loading, failed and unavailable quotes say so', () => {
  assert.equal(confirmCost({ quoteState: 'loading', quote: null }), 'Checking the cost.');
  assert.equal(confirmCost({ quoteState: 'idle', quote: null }), 'Checking the cost.');
  assert.equal(confirmCost({ quoteState: 'error', quote: null }), 'Cost not checked yet.');
  assert.equal(confirmCost({ quoteState: 'ready', quote: { launchable: false, creditCost: 10 } }), 'Not available right now.');
  assert.equal(confirmCost({ quoteState: 'ready', quote: { launchable: true, creditCost: 0 } }), 'Free today. No credits needed.');
  assert.equal(confirmCost({ quoteState: 'ready', quote: { launchable: true } }), 'Checking the cost.', 'a missing cost is not zero');
  assert.equal(costValue({ quoteState: 'ready', quote: { launchable: true, creditCost: 50 } }), '50 credits');
  assert.equal(costValue({ quoteState: 'ready', quote: { launchable: true, creditCost: 0 }, isPremium: true }), 'Included');
  assert.equal(costValue({ quoteState: 'ready', quote: { launchable: true, creditCost: 0 } }), 'Free today');
  assert.equal(costValue({ quoteState: 'loading', quote: null }), 'Checking');
  assert.equal(costValue({ quoteState: 'error', quote: null }), 'Not checked');
  assert.equal(costValue({ quoteState: 'ready', quote: { launchable: false } }), 'Not available');
});

test('copy follows the site rules: no exclamation marks, no em dashes, no middle dots', () => {
  const strings = [
    confirmLine({ count: 10, minutes: 10, quoteState: 'ready', quote: { launchable: true, creditCost: 10 } }),
    ...['loading', 'error'].map((quoteState) => confirmCost({ quoteState })),
    ...Object.values(accessSummary({ isPremium: false, creditBalance: 0 })).flatMap((v) => (v && typeof v === 'object' ? Object.values(v) : [v])),
    ...Object.values(accessSummary({ isPremium: true, premiumUntil: '2027-01-12T18:29:59.000Z', now: Date.parse('2026-10-14') })),
  ].filter((value) => typeof value === 'string');
  for (const text of strings) assert.doesNotMatch(text, /[!—–−·]/, text);
});

test('free access: balance and what Pro adds, said once; zero offers the free way to earn', () => {
  const some = accessSummary({ isPremium: false, creditBalance: 120 });
  assert.equal(some.title, 'Free plan');
  assert.equal(some.status, '120 practice credits left.');
  assert.match(some.detail, /^Pro adds Smart Practice and NTA Mode/);
  assert.deepEqual(some.action, { label: 'See Pro', href: '/pricing' });
  assert.equal(some.earn, null);
  assert.equal(accessSummary({ isPremium: false, creditBalance: 1 }).status, '1 practice credit left.');
  const none = accessSummary({ isPremium: false, creditBalance: 0 });
  assert.equal(none.status, 'No practice credits left.');
  assert.equal(none.earn.href, '/upload');
  const unknown = accessSummary({ isPremium: false, creditBalance: undefined });
  assert.equal(unknown.balance, null, 'unknown is not zero');
  assert.equal(unknown.status, 'Your credit balance could not be read.');
  assert.equal(unknown.earn, null);
});

test('Pro access: the end date, and a nearer warning in the last week', () => {
  const now = Date.parse('2026-10-14T06:00:00.000Z');
  const far = accessSummary({ isPremium: true, premiumUntil: '2027-01-12T18:29:59.000Z', now });
  assert.equal(far.title, 'Your access');
  assert.equal(far.status, 'Pro until 12 Jan 2027.', 'the end date is the IST day the access ends');
  assert.equal(far.action, null, 'no upgrade link for Pro');
  assert.equal(accessSummary({ isPremium: true, premiumUntil: '2026-10-17T18:29:59.000Z', now }).status, 'Pro ends in 4 days, on 17 Oct 2026.');
  assert.equal(accessSummary({ isPremium: true, premiumUntil: '2026-10-14T18:29:59.000Z', now }).status, 'Pro ends on 14 Oct 2026.');
  assert.equal(accessSummary({ isPremium: true, premiumUntil: null, now }).status, 'Pro is active.');
  assert.equal(accessSummary({ isPremium: true, premiumUntil: 'not a date', now }).status, 'Pro is active.');
});

test('recent sessions show denominators, and leave unknown counts out', () => {
  assert.equal(sessionTally(attempt), '6 of 10 correct');
  assert.equal(sessionTally({ correct: 0, total: 5 }), '0 of 5 correct');
  assert.equal(sessionTally({ correct: 3 }), '');
  assert.equal(sessionTally({ correct: 0, total: 0 }), '');
  assert.equal(sessionTally(null), '');
});

test('the strip never shows build talk from the plan', () => {
  const ordinary = { kind: 'ordinary_practice', title: 'Start 20 practice questions', href: '/dashboard?mode=quick&count=20',
    reason: '20 questions, about 20 minutes. Recovery content is awaiting source and calibration checks, so this is ordinary practice.' };
  assert.equal(stripReason(ordinary), 'Practise the next set of questions.');
  const other = { kind: 'ordinary_practice', href: '/dashboard', reason: 'No supported concept has been missed twice yet, so this is ordinary practice.' };
  assert.equal(stripReason(other), 'Practise the next set of questions.');
  assert.equal(stripReason({ href: '/recovery', reason: 'Recovery content is awaiting source and calibration checks.' }), '', 'build talk on a step elsewhere is dropped');
  assert.equal(stripReason(repairPlan.primary), 'Pick up the activity you started.');
  assert.equal(stripReason(null), '');
  for (const text of [stripReason(ordinary), stripReason(other)]) assert.doesNotMatch(text, /awaiting|calibration|source|pathway/i);
});

test('an expired Pro end date reads as active, not as a past date', () => {
  const status = accessSummary({ isPremium: true, premiumUntil: '2026-01-01T00:00:00.000Z', now: Date.parse('2026-10-14') }).status;
  assert.equal(status, 'Pro is active.');
});

// Notes: the Pro date assertions rely on Node's ICU data for en-IN (full-icu, the default since Node 13).
