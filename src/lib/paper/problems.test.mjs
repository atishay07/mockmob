// What the runner says when a paper cannot open or cannot be sent (src/lib/paper/problems.mjs): no raw code reaches a
// student, and every state has a way forward (B3, B5, B6, B8, B10).
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  canOpenPaper, creditsProblem, isSentence, lateNotice, practiceHref, practiceHrefFromTest, startProblem, submitProblem, waitingCopy,
} from './problems.mjs';

const err = (message, extra = {}) => Object.assign(new Error(message), extra);
const CODE = /\b[A-Z][A-Z0-9]*_[A-Z0-9_]+\b|Unauthorized|Request failed|Too many requests/;
const everyWord = (problem) => [problem.title, problem.message, ...(problem.keys || []).map((key) => key.label)].join(' ');

test('a /test link without a paper key goes to Practice with its subject, mode, count and chapter chosen (B3)', () => {
  const repair = new URLSearchParams({ subject: 'accountancy', mode: 'quick', count: '5', chapter: 'Partnership, Fundamentals', recoveryFrom: 'att-1' });
  assert.equal(canOpenPaper(repair), false);
  assert.equal(practiceHrefFromTest(repair), '/dashboard?subject=accountancy&mode=quick&count=5&chapter=Partnership%2C+Fundamentals');
  const saved = new URLSearchParams({ subject: 'economics', mode: 'quick', count: '10', chapters: 'Money,Banking' });
  assert.equal(practiceHrefFromTest(saved), '/dashboard?subject=economics&mode=quick&count=10&chapters=Money%2CBanking');
  assert.equal(practiceHrefFromTest(new URLSearchParams({ subject: 'english', mode: 'nta', interface: 'nta', tonightKey: 'night-1', tonightMinutes: '20' })), '/dashboard?subject=english&mode=nta&interface=nta&tonightKey=night-1&tonightMinutes=20');
  assert.equal(practiceHref({}), '/dashboard');
  assert.ok(canOpenPaper(new URLSearchParams({ generationKey: 'abcdefghijkl' })));
  assert.ok(canOpenPaper(new URLSearchParams({ sessionId: 's1' })));
  assert.equal(canOpenPaper(new URLSearchParams({ generationKey: 'short' })), false);
});

test('every refused start is a sentence and a way forward, never a code', () => {
  const ctx = { practiceHref: '/dashboard?subject=accountancy', loginHref: '/login?next=%2Ftest', modeLabel: 'NTA mode' };
  const cases = [
    err('SESSION_ALREADY_SUBMITTED', { status: 422 }), err('Unauthorized', { status: 401 }), err('PREMIUM_REQUIRED', { status: 402 }),
    err('INSUFFICIENT_VERIFIED_CONTENT'), err('INSUFFICIENT_PRACTICE_CONTENT'), err('SESSION_EXPIRED', { status: 422 }),
    err('INVALID_START_RECEIPT', { status: 422 }), err('SESSION_NOT_FOUND', { status: 404 }), err('SUBJECT_NOT_SUPPORTED'),
    err('INVALID_CHAPTER'), err('INVALID_MODE'), err('CHAPTERS_NOT_ALLOWED'), err('RECOVERY_MIGRATION_REQUIRED', { status: 503 }),
    err('SESSION_CREATE_FAILED', { status: 503 }), err('Too many requests', { status: 429 }), err('Request failed (500)', { status: 500 }),
    err('Network error — check your connection', { kind: 'network' }), err('SOMETHING_NEW'), err(''),
  ];
  for (const e of cases) {
    const problem = startProblem(e, ctx);
    assert.doesNotMatch(everyWord(problem), CODE, `${e.message} printed a code`);
    assert.ok(problem.keys.length >= 1 && problem.keys.length <= 3, `${e.message} has a way forward`);
    assert.equal(problem.keys.filter((key) => key.primary).length, 1, `${e.message}: one volt key`);
    assert.doesNotMatch(everyWord(problem), /!/);
  }
  assert.equal(startProblem(err('SESSION_ALREADY_SUBMITTED'), ctx).keys[0].href, '/review');
  assert.equal(startProblem(err('Unauthorized', { status: 401 }), ctx).keys[0].href, ctx.loginHref);
  // A paper that is not yours (B10) and a truly expired one: one key, to Practice.
  for (const code of ['INVALID_START_RECEIPT', 'SESSION_NOT_FOUND']) {
    const problem = startProblem(err(code), ctx);
    assert.equal(problem.title, 'This paper belongs to another account');
    assert.deepEqual(problem.keys.map((key) => key.label), ['Go to Practice']);
  }
  assert.deepEqual(startProblem(err('SESSION_EXPIRED'), ctx).keys.map((key) => key.label), ['Go to Practice']);
  // A sentence the server wrote for the student (a Mob start) is shown as it is.
  assert.equal(startProblem(err('This week’s Mob paper is closed. It reopens on Monday.'), { ...ctx, isMob: true }).message, 'This week’s Mob paper is closed. It reopens on Monday.');
  assert.equal(startProblem(err('This week’s Mob paper is closed.'), { ...ctx, isMob: true }).keys[1].href, '/mob');
  // The NTA bank sentence keeps its own words.
  assert.match(startProblem(err('INSUFFICIENT_PRACTICE_CONTENT'), { isNta: true }).message, /NTA mode paper needs 50 checked questions/);
});

test('credits that ran out between the price and the start: the price in Practice\'s words, the free set, Pro (B6)', () => {
  const ctx = { subject: 'accountancy', modeLabel: 'Quick practice', cost: 20, balance: 4, practiceHref: '/dashboard?subject=accountancy&mode=quick&count=20' };
  const quote = { launchable: false, reasonCode: 'insufficient_credits', reason: 'Quick practice costs 20 credits and you have 4.' };
  // Today's included set is still there: it is the way forward.
  const free = creditsProblem({ quote, daily: { allowance: { kind: 'daily_practice', state: 'available' }, creditCost: 0 }, ctx });
  assert.equal(free.title, 'Not enough credits for this set');
  assert.equal(free.message, 'Quick practice costs 20 credits and you have 4. Nothing was charged. Today’s included 10-question set is still free.');
  assert.deepEqual(free.keys.map((key) => [key.label, key.href, !!key.primary]), [
    ['Set up the free set', '/dashboard?subject=accountancy&mode=quick&count=10', true],
    ['Back to Practice', ctx.practiceHref, false],
    ['See Pro', '/pricing?reason=credits', false],
  ]);
  assert.equal(free.keys[2].proFeature, 'credits', 'the Pro sheet opens with the credits reason');
  // Used today: tomorrow's.
  const used = creditsProblem({ quote: { ...quote, reason: 'Quick practice costs 10 credits and you have 4. Today’s included set is used.' }, daily: { allowance: { kind: 'daily_practice', state: 'used' }, creditCost: 10 }, ctx });
  assert.match(used.message, /Today’s included set is used\. Nothing was charged\. Tomorrow’s included 10-question set is free\.$/);
  assert.deepEqual(used.keys.map((key) => [key.label, !!key.primary]), [['Back to Practice', true], ['See Pro', false]]);
  // No allowance (switched off) and no price read: the list price and the balance the page has, and no free-set promise.
  const blind = creditsProblem({ quote: null, daily: { allowance: null, creditCost: 10 }, ctx });
  assert.equal(blind.message, 'Quick practice costs 20 credits and you have 4. Nothing was charged.');
  assert.equal(creditsProblem({ ctx: {} }).message, 'This set costs more credits than you have now. Nothing was charged.');
  // The balance changed again and the set is affordable now: back to Practice, where the price shows first.
  assert.equal(creditsProblem({ quote: { launchable: true }, ctx }).keys[0].label, 'Back to Practice');
  for (const problem of [free, used, blind]) assert.doesNotMatch(everyWord(problem), CODE);
});

test('a failed submit is held, explained or retried, never a code; past the grace it is never "try again" (B6, B8)', () => {
  const place = 'on this phone';
  assert.equal(submitProblem(err('Network error', { kind: 'network' }), { place }).kind, 'offline');
  assert.equal(submitProblem(err('SESSION_EXPIRED', { status: 422 }), { place }).kind, 'late');
  assert.equal(submitProblem(err('SESSION_NOT_FOUND', { status: 404 }), { place }).kind, 'foreign');
  const out = submitProblem(err('Unauthorized', { status: 401 }), { place, loginHref: '/login?next=x' });
  assert.equal(out.kind, 'signedOut');
  assert.equal(out.message, 'You are signed out, so this paper was not sent. Your answers are kept on this phone. Sign in, then come back to send it.');
  assert.equal(out.link.href, '/login?next=x');
  for (const e of [err('Request failed (500)', { status: 500 }), err('PREVIEW_ONLY: submission captured, not scored', { status: 418 }), err('Too many requests', { status: 429 }), err('Payload too large', { status: 413 }), err('Failed to load attempts')]) {
    const said = submitProblem(e, { place });
    assert.equal(said.kind, 'retry');
    assert.doesNotMatch(said.message, CODE, e.message);
    assert.match(said.message, /Your answers are kept on this phone\.$/);
  }
  assert.equal(submitProblem(err('The paper could not be checked just now'), { place }).message, 'The paper could not be checked just now. Your answers are kept on this phone.');
});

test('waiting for a connection says what happens next: it keeps sending for 7 days after the timer (B8), then says the paper could not be saved', () => {
  const DAY = 24 * 60 * 60 * 1000;
  assert.match(waitingCopy({ msLeft: 5000, msToLateEnd: 7 * DAY + 5000, place: 'on this phone' }), /sends itself when you are back online/);
  // B8 (15 Nov 2026): past the timer the server takes the paper, late, for 7 days, so the runner keeps trying and says so.
  assert.equal(waitingCopy({ msLeft: 0, msToLateEnd: 7 * DAY - 60000, place: 'on this phone' }), 'Time is up and you are offline. Your paper is saved on this phone and sends itself when you are back online, up to 7 days after its timer ended.');
  assert.equal(waitingCopy({ msLeft: 0, msToLateEnd: 6 * DAY }), waitingCopy({ msLeft: 0, msToLateEnd: 1000 }), 'never a ticking clock in a live region');
  assert.equal(waitingCopy({ msLeft: 0, msToLateEnd: 0, place: 'on this phone' }), 'This paper could not be saved. It was not sent within 7 days of its timer ending, so it has no result. Start a new paper on Practice.');
  assert.match(waitingCopy({ ticket: false }), /saved to your account/);
  for (const words of [waitingCopy({ msLeft: 0, msToLateEnd: 1000 }), waitingCopy({ msLeft: 0, msToLateEnd: 0 })]) assert.doesNotMatch(words, /!|2 minutes/);
  const late = lateNotice({ answered: 7, place: 'on this phone', practiceHref: '/dashboard?subject=economics' });
  assert.equal(late.title, 'This paper could not be saved');
  assert.equal(late.message, 'A paper has to be sent within 7 days of its timer ending, and this one was not, so it has no result. Your 7 answers are still on this phone, but they cannot be scored.');
  assert.deepEqual(late.keys, [{ label: 'Start a new paper', href: '/dashboard?subject=economics', primary: true }]);
  assert.doesNotMatch(lateNotice({ answered: 0 }).message, /answers are still/);
});

test('isSentence tells a student sentence from a code or a transport message', () => {
  for (const said of ['This week’s Mob paper is closed.', 'Fullscreen could not open, try again']) assert.ok(isSentence(said), said);
  for (const code of ['', 'INSUFFICIENT_CREDITS', 'PREVIEW_ONLY: submission captured, not scored', 'Unauthorized', 'Request failed (502)', 'Network error — check your connection', 'Too many requests', 'boom']) assert.equal(isSentence(code), false, code);
});
