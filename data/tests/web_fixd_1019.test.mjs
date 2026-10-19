// Release 11 fix pass D (19 Oct 2026): the final verifier's NO-GO items. The nav badge is in web_fixa_1019.test.mjs (M1); this file
// holds the money item (a Free ask is never charged), the one-number-per-chapter item, the saved-reply cost and the credit line's words.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { LAST_PAPER_ASK, costOf, creditLine, leadFigureLine, recordDoorAsks, recordLead } from '../../src/components/ai/askDoors.mjs';
import { paidState } from '../../src/components/ai/askSuggestions.mjs';
import { RECORD_NOT_READ, RECORD_NO_ANSWER, planStart } from '../../src/components/ai/startPlan.mjs';

const read = (path) => readFileSync(new URL(`../../${path}`, import.meta.url), 'utf8').replace(/\r\n/g, '\n');
const code = (src) => src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
const NB = ' ';

const chapter = (name, o = {}) => ({ key: `accountancy::${name}`, subject: 'accountancy', subjectName: 'Accountancy', chapter: name, right: 20, wrong: 10, skip: 5, n: 35, sessions: 4, open: 75, ...o });
const HEAVY = {
  state: 'ready', sessions: 25, questions: 400,
  ledger: { open: 900, openSkipped: 0 }, accuracy: {}, difficulty: [], attemptRate: 100,
  chapters: { ranked: [chapter('Partnership Fundamentals', { wrong: 5, skip: 0, open: 30 }), chapter('Share Capital', { wrong: 6, skip: 0, open: 29 })], thin: [] },
  pace: { usable: false }, changes: { count: 0, gains: 0, losses: 0 }, week: { thisWeek: { sessions: 3, questions: 30 } },
};
const FRESH = { state: 'empty', sessions: 0, questions: 0 };
const WALLET = { state: 'available', known: true, total: 38, includedMonthlyCredits: 50, includedRemaining: 38, bonusCredits: 0, balanceCredits: 0, heldCredits: 0, resetAt: '2026-10-31T18:30:00.000Z' };
const plan = (o) => planStart({ initial: { text: 'Where am I losing marks?', free: true }, status: 'ready', insights: HEAVY, wallet: WALLET, paid: paidState(WALLET), ...o });

// ---- 2. (MEDIUM, money) a Free record ask is never charged --------------------------------------------------------------------
test('money: when the panel\'s read of the record fails, a Free ask is never sent as a written reply', () => {
  for (const text of ['Where am I losing marks?', 'Which chapter should I practise?', 'How is my week going?']) {
    const out = plan({ initial: { text, free: true }, status: 'unavailable', insights: null });
    assert.equal(out.kind, 'record-failed', text);
    assert.equal(out.reply, 'Your record could not be read just now. Nothing was charged.');
    assert.equal(out.reply, RECORD_NOT_READ);
  }
  // Whatever the wallet, the connection or the record's state, a free ask has no path to a paid reply or a credits notice.
  for (const status of ['unavailable', 'ready', 'empty']) for (const insights of [null, HEAVY, FRESH]) for (const wallet of [null, WALLET, { ...WALLET, total: 0 }]) for (const offline of [false, true]) {
    for (const text of ['Where am I losing marks?', 'Why is the sky blue?']) {
      const out = planStart({ initial: { text, free: true }, status, insights, wallet, offline, paid: paidState(wallet) });
      assert.notEqual(out.kind, 'paid', `${status} ${text}`);
      assert.notEqual(out.kind, 'say', 'a free ask is never turned into a credits or offline notice');
    }
  }
  // A ready record that cannot answer the words sends nothing, and says nothing was charged.
  const none = plan({ initial: { text: 'Why is the sky blue?', free: true } });
  assert.equal(none.kind, 'record-failed');
  assert.equal(none.reply, RECORD_NO_ANSWER);
  assert.match(none.reply, /Nothing was charged\.$/);
  assert.equal(plan({ status: 'loading', insights: null }).kind, 'wait', 'still reading: it waits, it does not send');
});

test('money: the normal path stays free, answered from the record the page already read, and a written ask is still a written ask', () => {
  const out = plan({});
  assert.equal(out.kind, 'record');
  assert.match(out.answer.source, /^From your record/);
  assert.equal(plan({ initial: { text: 'Where am I losing marks?', free: true }, status: 'empty', insights: FRESH }).kind, 'record', 'a new account\'s empty record answers too');
  assert.equal(plan({ initial: { text: LAST_PAPER_ASK, free: true, answer: { reply: 'x', actions: [] } }, status: 'unavailable', insights: null }).kind, 'page', 'the last paper comes with its own answer');
  const starter = { text: 'Explain the sacrificing ratio in simple words' };
  assert.deepEqual(plan({ initial: starter }), { kind: 'paid', text: starter.text }, 'a starter was priced "1 credit" and goes out as the written reply it said');
  assert.equal(plan({ initial: starter, wallet: { ...WALLET, total: 0 }, paid: paidState({ ...WALLET, total: 0 }) }).kind, 'say', 'out of credits: said, nothing sent');
  assert.equal(plan({ initial: starter, offline: true }).kind, 'say');
  assert.equal(plan({ initial: starter, wallet: null, paid: paidState(null) }).kind, 'wait');
  assert.equal(plan({ initial: null }).kind, 'none');
});

test('money: the doors mark every Free ask, hand the panel the record they already read, and the panel offers Try again instead of sending', () => {
  const doors = read('src/components/ai/AskMobiDoors.jsx');
  assert.match(doors, /free: ask\.price === 'free'/, 'a record ask the door shows as Free is marked free');
  assert.match(doors, /record: ready \? \{ status, insights \} : null/, 'the record the page read is handed over, not read a second time');
  assert.match(doors, /initial=\{\{ text: thread\.text, answer: thread\.answer, free: thread\.free, record: thread\.record \}\}/);
  assert.match(doors, /start\(\{ text, free: price === 'free' \}\)/, 'a typed question the record answers is marked free too');
  assert.doesNotMatch(doors, /start\(\{ text: s, free/, 'a starter is a written reply, never marked free');
  const panel = code(read('src/components/ai/AskMobiPanel.jsx'));
  assert.match(panel, /const handed = initial\?\.record && /);
  assert.match(panel, /useInsights\(handed \? null : userId, recordTry\)/, 'no second read when the page handed the record over');
  assert.match(panel, /planStart\(\{ initial, status, insights, pro, wallet, offline, paid \}\)/);
  assert.match(panel, /plan\.kind === 'record-failed'/);
  assert.match(panel, /onClick=\{tryStartAgain\}>Try again</);
  const effect = panel.slice(panel.indexOf('startNow.current = () =>'), panel.indexOf('function tryStartAgain'));
  assert.equal((effect.match(/sendPaid\(/g) || []).length, 1, 'one path to a written reply, and it is the plan\'s "paid"');
  assert.match(effect, /else sendPaid\(plan\.text\)/);
});

// ---- 3. (LOW, truth) one chapter, one number ---------------------------------------------------------------------------------
test('truth: the door\'s chapter and figure are the record\'s own top-ranked chapter and its "marks to win back"', () => {
  assert.deepEqual(recordLead(HEAVY), { lost: 30, chapter: 'Partnership Fundamentals' });
  // The chapter with more wrongs is not the lead when the record ranks another first: no second arithmetic.
  const flipped = { ...HEAVY, chapters: { ranked: [chapter('Share Capital', { wrong: 5, skip: 0, open: 30 }), chapter('Goodwill', { wrong: 20, skip: 0, open: 29 })], thin: [] } };
  assert.deepEqual(recordLead(flipped), { lost: 30, chapter: 'Share Capital' });
  const asks = recordDoorAsks(HEAVY, { now: new Date(2026, 9, 19, 21) });
  assert.equal(asks[0].preview, '30 marks to win back in Partnership Fundamentals');
  assert.equal(leadFigureLine('Goodwill'), 'marks to win back in Goodwill, your biggest leak');
  assert.match(read('src/components/ai/RecordView.jsx'), /<b>\{c\.open\}<\/b><small>marks to win back<\/small>/, 'the record below prints the same figure in the same words');
  assert.doesNotMatch(read('src/components/ai/AskMobiDoors.jsx'), /marks lost in/);
  assert.doesNotMatch(code(read('src/components/ai/askDoors.mjs')), /LOST_WRONG|LOST_BLANK/);
});

// ---- 4. (LOW) a saved reply's true cost ---------------------------------------------------------------------------------------
test('cost: a saved written reply that cost nothing never says "1 credit"', () => {
  assert.equal(costOf({ origin: 'model', charged: 0 }), 'Written answer');
  assert.equal(costOf({ origin: 'model' }), 'Written answer');
  assert.equal(costOf({ origin: 'model', charged: 1 }), 'Written answer · 1 credit');
  assert.equal(costOf({ origin: 'model', charged: 2 }), 'Written answer · 2 credits');
  assert.equal(costOf({ origin: 'record' }), 'From your record · free');
  assert.equal(costOf({ origin: null }), null);
});

// ---- 5. (LOW, copy) "they refill on 1 Nov", docked and on the page ----------------------------------------------------------
test('copy: the credit line says "refill on 1 Nov", and the docked panel says it in the page\'s words', () => {
  const dot = `${NB}·${NB}`;
  assert.equal(creditLine(WALLET).first, `38 of your 50 free credits left${dot}they refill${NB}on${NB}1${NB}Nov`);
  assert.equal(creditLine({ ...WALLET, total: 138, bonusCredits: 100 }).first, `138 credits left${dot}free ones refill${NB}on${NB}1${NB}Nov`);
  const panel = code(read('src/components/ai/AskMobiPanel.jsx'));
  assert.match(panel, /const creditWords = creditLine\(wallet\)\.first;/);
  assert.match(panel, /\{creditWords\}/);
  assert.doesNotMatch(panel, /walletLine|free, back to/, 'the docked panel no longer has its own wording for the same balance');
  assert.doesNotMatch(code(read('src/components/ai/askDoors.mjs')), /refill \$\{d\}|refill \$\{d\}/, 'no "refill 1 Nov" without "on"');
});
