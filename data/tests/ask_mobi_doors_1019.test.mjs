// Ask Mobi's own page on the website (ASK-MOBI-1019, option B; the owner's D114): the two doors, one to one with the app's
// ask_doors.dart. The pure model first (fresh and heavy states, starters and their prices, the lead figure, the record asks
// with Free / 1 credit / Pro, the empty record, a sealed paper, the credit line, recent questions), then the wiring.
import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { answerFromInsights } from '../prepos_insights.js';
import {
  ASK_NOW_BANK, DOOR_COPY, LAST_PAPER_ASK, askNowStarters, canonicalSubject, clockStamp, costOf, creditLine, greetName, greeting, lastPaper, moreIdeasLabel,
  moreStarters, paperDay, paperIsOpen, priceOfTyped, recordDoorAsks, recordLead, recordLine, resultHref, seeAll, tonightOrToday,
} from '../../src/components/ai/askDoors.mjs';
import { exchangesFrom } from '../../src/components/ai/mentorHistory.mjs';
import { productAskFor } from '../../src/components/ai/askSuggestions.mjs';

const read = (path) => readFileSync(new URL(`../../${path}`, import.meta.url), 'utf8');
const BANNED = /[!→←↗»]|\b[A-Z]{4,}\b(?<!\bNTA\b)/u;
const strip = (t) => String(t).split('CUET').join('').split('NTA').join('');
const chapter = (name, o = {}) => ({ key: `accountancy::${name}`, subject: 'accountancy', subjectName: 'Accountancy', chapter: name, right: 20, wrong: 10, skip: 5, n: 35, sessions: 4, open: 75, ...o });
const HEAVY = {
  state: 'ready', sessions: 25, questions: 400,
  ledger: { open: 900, openSkipped: 0 }, accuracy: {}, difficulty: [], attemptRate: 100, chapters: { ranked: [chapter('Goodwill', { wrong: 5, skip: 0 }), chapter('Share Capital', { wrong: 50, skip: 11 }), chapter('Ratios', { wrong: 9, skip: 2 })], thin: [] },
  pace: { usable: true, medianSec: 50, medianWrongSec: 130, medianRightSec: 40, questionsTimed: 30, shareOnWrong: 50, slowest: [{ chapter: 'Goodwill', subject: 'accountancy', position: 3, seconds: 190, outcome: 'wrong', attemptId: 'a' }] }, changes: { count: 6, gains: 4, losses: 2 },
  week: { thisWeek: { sessions: 3, questions: 30 } },
};
const FRESH = { state: 'empty', sessions: 0, questions: 0 };
const NOW = new Date(2026, 9, 19, 21, 0).getTime();

test('the greeting is the app word for word, and has no name when no real first name is set', () => {
  assert.equal(greeting('Riya', 0), 'Hi Riya. Stuck on a CUET doubt? Ask me.');
  assert.equal(greeting(null, 0), 'Hi. Stuck on a CUET doubt? Ask me.');
  assert.equal(greeting('Riya', 25), 'Hi Riya. Ask me any doubt, or ask what your 25 papers say.');
  assert.equal(greeting('Riya', 1), 'Hi Riya. Ask me any doubt, or ask what your first paper says.');
  assert.equal(greeting(null, 3), 'Hi. Ask me any doubt, or ask what your 3 papers say.');
  assert.equal(recordLine(25), 'Mobi reads your 25 papers and answers from them.');
  assert.equal(recordLine(1), 'Mobi reads your first paper and answers from it.');
  // The app's shownFirstName rule: a handle or the email's prefix is never a name.
  assert.equal(greetName({ name: 'walk-r11-web-1019a', email: 'x@y.test' }), null);
  assert.equal(greetName({ name: 'asha07', email: 'q@y.test' }), null);
  assert.equal(greetName({ name: 'preview', email: 'preview@example.test' }), null);
  assert.equal(greetName({ name: 'Riya Sharma', email: 'riya.s@y.test' }), 'Riya');
  assert.equal(greetName(null), null);
});

test('Ask now starters: fresh gets generic CUET ones, heavy leads with the weakest chapter and then the student\'s subjects', () => {
  assert.deepEqual(askNowStarters({ insights: FRESH, subjects: [] }), [
    'Explain the sacrificing ratio in simple words', 'What is price elasticity of demand?', 'How do I find the main idea of a passage?',
  ]);
  const heavy = askNowStarters({ insights: HEAVY, subjects: ['accountancy', 'economics', 'english'] });
  assert.equal(heavy.length, 3);
  assert.equal(heavy[0], 'Explain Goodwill in simple words', 'the first ranked chapter leads');
  assert.equal(heavy[1], 'Explain the sacrificing ratio in simple words');
  // A single small subject is filled from the parts every student sits, so there are always three.
  const physics = askNowStarters({ insights: FRESH, subjects: ['physics'] });
  assert.equal(physics.length, 3);
  assert.equal(physics[0], 'Explain Gauss’s law in simple words');
  assert.equal(canonicalSubject('gat'), 'general_test');
  assert.equal(canonicalSubject('Business Studies'), 'business_studies');
});

test('every starter is a written reply: none is answered from the record, so the "1 credit" mark is never untrue', () => {
  for (const [id, list] of Object.entries(ASK_NOW_BANK)) for (const text of list) {
    assert.equal(productAskFor(text), null, `${id}: ${text}`);
    assert.equal(answerFromInsights(text, HEAVY, { pro: true }), null, `${id}: ${text}`);
    assert.equal(priceOfTyped(text, { insights: HEAVY, status: 'ready', pro: true }), 'credit', `${id}: ${text}`);
  }
  // The weakest-chapter starter too, whatever the chapter is called.
  assert.equal(priceOfTyped('Explain Share Capital in simple words', { insights: HEAVY, status: 'ready' }), 'credit');
});

test('the price of what is typed is said before it is sent: empty none, a record question free, anything else 1 credit', () => {
  const o = { insights: HEAVY, status: 'ready', pro: false };
  assert.equal(priceOfTyped('   ', o), null);
  assert.equal(priceOfTyped('Where am I losing marks?', o), 'free');
  assert.equal(priceOfTyped('How do credits work?', o), 'free');
  assert.equal(priceOfTyped('Why is the sky blue?', o), 'credit');
  assert.equal(priceOfTyped('Where am I losing marks?', { insights: null, status: 'loading' }), 'credit', 'unknown is the price, never free');
});

test('more ideas come from the student\'s own subjects, three at most, and a subject with none has none', () => {
  const subjects = ['accountancy', 'economics', 'english'];
  const shown = askNowStarters({ insights: FRESH, subjects });
  const more = moreStarters({ insights: FRESH, subjects });
  assert.ok(more.length > 0 && more.length <= 3);
  for (const m of more) assert.equal(shown.includes(m), false);
  assert.equal(moreIdeasLabel(subjects), 'See more ideas for Accountancy, Economics and English');
  assert.equal(moreIdeasLabel(['accountancy']), 'See more ideas for Accountancy');
  assert.equal(moreIdeasLabel([]), 'See more ideas');
  assert.deepEqual(moreStarters({ insights: FRESH, subjects: ['chemistry'] }), []);
});

test('the lead figure is the chapter with the most marks lost, in Your papers\' arithmetic (6 a wrong, 5 a blank), and never made up', () => {
  assert.deepEqual(recordLead(HEAVY), { lost: 50 * 6 + 11 * 5, chapter: 'Share Capital' });
  assert.equal(recordLead(FRESH), null);
  assert.equal(recordLead({ state: 'ready', chapters: { ranked: [], thin: [] } }), null);
  assert.equal(recordLead({ state: 'ready', chapters: { ranked: [chapter('Ratios', { wrong: 0, skip: 0 })], thin: [] } }), null);
});

const PAPER = { id: 'att_9', subject: 'accountancy', mode: 'full', correct: 30, wrong: 10, unattempted: 10, total: 50, marks: 140, maxMarks: 250, completedAt: NOW };

test('the record asks: seven in the app\'s order, each priced, the Pro ones visible and locked on Free and free on Pro', () => {
  const last = lastPaper(PAPER, { now: NOW });
  const free = recordDoorAsks(HEAVY, { pro: false, last, now: new Date(NOW) });
  assert.equal(free.length, 7, 'the "See all 7" number');
  assert.deepEqual(free.map((a) => a.text), [
    'Where am I losing marks?', 'Which chapter should I practise?', LAST_PAPER_ASK, 'What should I revise tonight?',
    'Am I too slow on wrong answers?', 'How is my week going?', 'Do I change answers too much?',
  ]);
  assert.deepEqual(free.map((a) => a.price), ['free', 'free', 'free', 'credit', 'pro', 'free', 'pro']);
  assert.deepEqual(free.filter((a) => a.locked).map((a) => a.id), ['pace', 'changes'], 'visible, locked, never hidden (D101, R3)');
  assert.equal(free[4].preview, 'Timing from your timed papers');
  assert.equal(free[6].preview, 'From the answers you changed');
  assert.equal(free[0].preview, '355 marks lost in Share Capital');
  assert.equal(free[1].preview, '3 chapters ranked from your answers');
  assert.equal(free[3].preview, 'A written plan built from your record');
  assert.equal(free[5].preview, '3 papers, 30 questions in 7 days');
  const pro = recordDoorAsks(HEAVY, { pro: true, last, now: new Date(NOW) });
  assert.deepEqual(pro.map((a) => a.price), ['free', 'free', 'free', 'credit', 'free', 'free', 'free']);
  assert.equal(pro[4].preview, 'Wrong answers take 2:10, right ones 40s');
  assert.equal(pro[6].preview, '6 changes: 4 helped, 2 hurt');
  // Free record answers stay free: the three price words are only these.
  for (const a of free) assert.ok(['free', 'credit', 'pro'].includes(a.price));
  assert.equal(seeAll(free.length), 'See all 7 questions about your record');
});

test('with nothing to read, a line is left out rather than made up', () => {
  const asks = recordDoorAsks(HEAVY, { pro: false, last: null, now: new Date(NOW) });
  assert.equal(asks.length, 6, 'no last paper, no last-paper ask');
  const thin = recordDoorAsks({ state: 'ready', sessions: 2, chapters: { ranked: [], thin: [] }, week: { thisWeek: { sessions: 0, questions: 0 } }, changes: { count: 0 }, pace: { usable: false } }, { pro: true, now: new Date(NOW) });
  assert.equal(thin[0].preview, 'Reads your wrong and blank answers');
  assert.equal(thin[1].preview, 'Ranks the chapters costing you the most marks');
  assert.equal(thin.find((a) => a.id === 'week').preview, 'No papers in the last 7 days');
  assert.equal(thin.find((a) => a.id === 'pace').preview, 'Needs timed answers');
  assert.equal(thin.find((a) => a.id === 'changes').preview, 'Needs timed answers');
  assert.equal(recordDoorAsks(FRESH, { now: new Date(NOW) })[0].preview, 'Reads your wrong and blank answers');
});

test('the revise ask says tonight in the evening and today before it (the app\'s 4:00 PM to 4:59 AM rule)', () => {
  assert.equal(tonightOrToday(new Date(2026, 9, 19, 16, 0)), 'tonight');
  assert.equal(tonightOrToday(new Date(2026, 9, 19, 4, 59)), 'tonight');
  assert.equal(tonightOrToday(new Date(2026, 9, 19, 5, 0)), 'today');
  assert.equal(tonightOrToday(new Date(2026, 9, 19, 15, 59)), 'today');
  assert.equal(recordDoorAsks(HEAVY, { now: new Date(2026, 9, 19, 10, 0) }).find((a) => a.id === 'revise').text, 'What should I revise today?');
});

test('the empty record says plainly that it needs a paper, with one key, in the app\'s words', () => {
  assert.equal(DOOR_COPY.emptySay, 'Your record is empty for now.');
  assert.equal(DOOR_COPY.emptyBody, 'Finish one practice paper and Mobi can show you where every mark went.');
  assert.equal(DOOR_COPY.emptyKey, 'Practise 10 questions first');
  assert.equal(DOOR_COPY.emptyAfter, 'After that, you can ask where you lose marks, which chapter to practise and what to revise tonight.');
});

test('the last paper: its figures come from the paper, every type opens the one result page, and a sealed paper shows no score', () => {
  const full = lastPaper(PAPER, { now: NOW });
  assert.equal(full.preview, 'Accountancy full mock, 140 of 250, today');
  assert.equal(full.href, '/result/att_9');
  assert.deepEqual(full.actions, [{ label: 'See this paper', route: '/result/att_9' }]);
  assert.equal(full.reply, 'Your last paper was the Accountancy full mock you sat today. It scored 140 of 250 marks. It lost 110 marks, from 10 wrong answers and 10 left blank.');
  const withChapters = lastPaper(PAPER, { now: NOW, analysis: { marks: { gap: 110 }, chapters: [{ chapter: 'Goodwill', gap: 60, wrong: 8, blank: 2 }, { chapter: 'Ratios', gap: 1, wrong: 0, blank: 1 }, { chapter: 'Empty', gap: 0 }] } });
  assert.equal(withChapters.reply, 'Your last paper was the Accountancy full mock you sat today. It scored 140 of 250 marks. It lost 110 marks, and these chapters cost the most:\nGoodwill: 60 marks, from 8 wrong and 2 blank.\nRatios: 1 mark, from 1 blank.');
  // Each type opens /result/<id>; the name says the type; the same link every time.
  for (const mode of ['full', 'nta', 'smart', 'quick', null]) {
    const p = lastPaper({ ...PAPER, mode, total: 10, marks: 30, maxMarks: 50, completedAt: NOW - 3 * 86_400_000 }, { now: NOW });
    assert.equal(p.href, '/result/att_9', String(mode));
    assert.match(p.preview, /^Accountancy (full mock|NTA mock|Smart practice|Quick 10), 30 of 50, /, String(mode));
    assert.doesNotMatch(p.preview, /today|yesterday/);
  }
  assert.equal(lastPaper({ ...PAPER, mode: 'nta' }, { now: NOW }).reply.includes('the Accountancy mock in NTA mode'), true);
  // Sealed or unscored: never a score, and the ask is left out (nothing to print).
  assert.equal(lastPaper({ ...PAPER, sealed: true }, { now: NOW }), null);
  assert.equal(lastPaper({ ...PAPER, resultOpened: false }, { now: NOW }), null);
  assert.equal(lastPaper({ ...PAPER, marks: null }, { now: NOW }), null);
  assert.equal(lastPaper({ ...PAPER, total: 0 }, { now: NOW }), null);
  assert.equal(paperIsOpen(PAPER), true);
  assert.equal(paperIsOpen(null), false);
  assert.equal(resultHref('a/../b'), null, 'an id that is not a plain id never becomes a link');
  assert.equal(lastPaper({ ...PAPER, id: 'a b' }, { now: NOW }), null);
  assert.match(lastPaper({ ...PAPER, marks: 250, correct: 50, wrong: 0, unattempted: 0 }, { now: NOW }).reply, /It lost no marks at all\.$/);
  assert.match(lastPaper({ ...PAPER, marks: -3 }, { now: NOW }).reply, /scored −3 of 250 marks/);
  assert.equal(paperDay(NOW - 86_400_000, NOW), 'yesterday');
  assert.equal(paperDay(NOW - 20 * 86_400_000, NOW), '29 Sep');
});

test('the credit line is the true one-balance wallet in the app\'s final words', () => {
  const free = { state: 'available', known: true, total: 38, includedMonthlyCredits: 50, includedRemaining: 38, bonusCredits: 0, balanceCredits: 0, heldCredits: 0, resetAt: '2026-10-31T18:30:00.000Z' };
  assert.equal(creditLine(free).first, '38 of your 50 free credits left · they refill 1 Nov');
  assert.equal(creditLine(free).second, 'Answers from your marks are free. A written answer uses 1 credit.');
  const bought = { ...free, total: 68, bonusCredits: 30 };
  assert.equal(creditLine(bought).first, '68 credits left · free ones refill 1 Nov', 'bought credits make "of your 50" untrue');
  assert.equal(creditLine({ ...free, total: 1, includedRemaining: 1 }).first, '1 of your 50 free credits left · they refill 1 Nov');
  assert.equal(creditLine({ ...bought, total: 1 }).first, '1 credit left · free ones refill 1 Nov');
  assert.equal(creditLine({ ...free, total: 0 }).first, 'You have no credits left. Your free credits refill on 1 Nov.');
  assert.equal(creditLine({ ...free, total: 0 }).second, 'Answers from your marks stay free.');
  assert.equal(creditLine({ state: 'paused', known: false }).first, 'Written answers are paused just now.');
  assert.equal(creditLine({ state: 'paused', known: false }).second, 'Answers from your marks still work.');
  assert.equal(creditLine({ state: 'error', known: false }).first, 'See your credits', 'unknown is never written as 0');
  assert.equal(creditLine(null).first, 'Reading your credits');
});

test('recent questions: what each cost and a 12-hour time, and nothing claimed for a reply with no recorded source', () => {
  const at = '2026-10-15T16:10:00.000Z'; // 9:40 pm in India
  assert.equal(clockStamp(at, { timeZone: 'Asia/Kolkata' }), 'Thursday 15 Oct, 9:40 pm');
  assert.equal(clockStamp('2026-10-14T02:42:00.000Z', { timeZone: 'Asia/Kolkata' }), 'Wednesday 14 Oct, 8:12 am');
  assert.equal(clockStamp('2026-10-14T18:30:00.000Z', { timeZone: 'Asia/Kolkata' }), 'Thursday 15 Oct, 12:00 am');
  assert.equal(clockStamp(null), '');
  const rows = exchangesFrom([
    { id: 'u1', role: 'user', text: 'Where am I losing marks?', createdAt: '2026-10-14T14:42:00.000Z' },
    { id: 'a1', role: 'assistant', response: { reply: 'Share Capital.', runtimeState: 'record' } },
    { id: 'u2', role: 'user', text: 'Why is 19:11:10 right and 9:6:5 wrong?', createdAt: at },
    { id: 'a2', role: 'assistant', response: { reply: 'Because.', origin: 'model', charge: { kind: 'prepos_credit', amount: 1 } } },
    { id: 'u3', role: 'user', text: 'An old one', createdAt: '2026-10-10T10:00:00.000Z' },
    { id: 'a3', role: 'assistant', response: { reply: 'Hm.' } },
    { id: 'u4', role: 'user', text: 'No reply saved', createdAt: '2026-10-09T10:00:00.000Z' },
  ]);
  const byId = Object.fromEntries(rows.map((r) => [r.id, r]));
  assert.equal(costOf(byId.u2), 'Written answer · 1 credit');
  assert.equal(costOf(byId.u1), 'From your record · free');
  assert.equal(costOf(byId.u3), null, 'no recorded source, so no cost is claimed');
  assert.equal(costOf(byId.u4), null);
  assert.equal(byId.u2.at, at);
  assert.equal(rows[0].id, 'u4', 'newest first, as the history reads');
});

test('every line the doors say is read aloud: no exclamation marks, arrows or shouting, and the app\'s words where the app says the same', () => {
  const lines = [
    ...Object.values(DOOR_COPY), greeting('Riya', 0), greeting('Riya', 25), recordLine(25), seeAll(7),
    ...Object.values(ASK_NOW_BANK).flat(),
    ...recordDoorAsks(HEAVY, { pro: false, last: lastPaper(PAPER, { now: NOW }), now: new Date(NOW) }).flatMap((a) => [a.text, a.preview]),
  ];
  for (const line of lines) assert.doesNotMatch(strip(line), BANNED, String(line));
  const dartUrl = new URL('../../../wt-v15-3/flutter_app/lib/features/insights/data/ask_doors.dart', import.meta.url);
  if (!existsSync(dartUrl)) return;
  const dart = readFileSync(dartUrl, 'utf8');
  // Shared lines, held word for word against the app's source when it is beside this worktree (the main session's checkout has it).
  for (const shared of [DOOR_COPY.nowLine, DOOR_COPY.nowHint, DOOR_COPY.nowTip, DOOR_COPY.recordTip, DOOR_COPY.emptySay, DOOR_COPY.emptyBody, DOOR_COPY.emptyKey, DOOR_COPY.emptyAfter, DOOR_COPY.howItCosts, DOOR_COPY.writingNote, DOOR_COPY.startOver, DOOR_COPY.followUp, DOOR_COPY.offline, DOOR_COPY.readFailed, DOOR_COPY.readOffline]) {
    assert.ok(dart.includes(shared), `the app says: ${shared}`);
  }
});

// ---- Wiring ---------------------------------------------------------------------------------------------------------

test('/mentor is Ask Mobi\'s front door: the doors first, then the credit line and recent questions, then the record in full', () => {
  const page = read('src/components/ai/MentorRecordPage.jsx');
  assert.match(page, /<AskMobiDoors/);
  assert.match(page, /id="record"/, 'the record view is still on the page (R3), under the doors');
  assert.match(page, /<RecordView/);
  assert.match(page, /if \(tab === 'plan'\) \{ router\.replace\('\/today'\)/);
  assert.match(page, /if \(tab === 'tools'\) \{ router\.replace\('\/wallet'\)/);
  assert.doesNotMatch(page, /Earlier questions/, 'the past questions are "Your recent questions" now');
  const doors = read('src/components/ai/AskMobiDoors.jsx');
  assert.match(doors, /DOOR_COPY\.recentTitle/);
  assert.match(doors, /openUpgrade\(\{ trigger: 'review'/, 'a Pro ask opens the Upgrade sheet (D80), never a dead tap');
  assert.match(doors, /fetch\('\/api\/ai\/mentor\/history'/);
  assert.doesNotMatch(doors, /typewriter|setInterval|charAt\(/i, 'no fake streaming: an honest wait');
});

test('the navigation opens /mentor as a page; the docked panel stays for asks about one question or one mock', () => {
  const host = read('src/components/ai/AskMobiHost.jsx');
  assert.doesNotMatch(host, /isAskMobiNavHref|NAV_ROW/, 'the nav door no longer opens the panel in place: it goes to the page');
  assert.match(host, /window\.addEventListener\(ASK_MOBI_EVENT, onAsk\)/, 'the panel still answers openAskMobi from a question, a mock, Today and Practice');
  const shell = read('src/app/(app)/AppLayoutClient.jsx');
  assert.match(shell, /className="arena-mobi-door"/);
  assert.match(shell, /className="arena-sheet__lead arena-sheet__lead--ask"/);
  assert.equal((shell.match(/href=\{previewLinks\?\.mentor \|\| '\/mentor'\}/g) || []).length, 2, 'the sidebar door and the You sheet row both open /mentor');
});
