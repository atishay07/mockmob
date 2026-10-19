// Mobi v13 on the website, Ask now and tonight (C-dec 3 and 3b, D157). 1 credit settles a doubt: Mobi's answer, one free
// follow-up and 2 real CUET questions answered in place. The starters are doubts about the student's own missed chapters,
// sent with subject and chapter. "What should I revise tonight?" is free, read from the record. Failures say nothing was
// charged. The pure model first, then the wiring.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { getCanonicalChapters } from '../canonical_syllabus.js';
import {
  FRESH_DOUBTS, JOB_COPY, chapterChips, chatFailure, checkRows, checksTally, doubtFor, doubtStarters, followUpOpen, isShowableQuestion,
  isTonightAsk, planThreadAnswer, planThreadChecks, threadFromReply, tonightView, trapLine, withNothingCharged,
} from '../../src/components/ai/mobiJobs.mjs';
import { priceOfTyped, recordDoorAsks } from '../../src/components/ai/askDoors.mjs';
import { planStart } from '../../src/components/ai/startPlan.mjs';
import { paidState } from '../../src/components/ai/askSuggestions.mjs';

const read = (path) => readFileSync(new URL(`../../${path}`, import.meta.url), 'utf8').replace(/\r\n/g, '\n');
const code = (src) => src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
const BANNED = /[!→←↗»]|Included in Pro|fair use|no credits on Pro|1 credit a message/i;
const chapter = (name, o = {}) => ({ key: `accountancy::${name}`, subject: 'accountancy', subjectName: 'Accountancy', chapter: name, right: 20, wrong: 10, skip: 5, n: 35, sessions: 4, open: 75, ...o });
const HEAVY = {
  state: 'ready', sessions: 25, questions: 400, ledger: { open: 900, openSkipped: 0 }, accuracy: {}, difficulty: [], attemptRate: 100,
  chapters: { ranked: [chapter('Change in Profit Sharing Ratio', { wrong: 7, skip: 2 }), chapter('Share Capital', { wrong: 0, skip: 4 }), chapter('Money & Banking', { subject: 'economics', subjectName: 'Economics', wrong: 3, skip: 0 })], thin: [] },
  pace: { usable: false }, changes: { count: 0, gains: 0, losses: 0 }, week: { thisWeek: { sessions: 3, questions: 30 } },
};
const FRESH = { state: 'empty', sessions: 0, questions: 0 };
const WALLET = { state: 'available', known: true, total: 38, includedMonthlyCredits: 50, includedRemaining: 38, bonusCredits: 0, balanceCredits: 0, heldCredits: 0 };
const Q = (id, o = {}) => ({ checkQuestionId: id, subject: 'accountancy', chapter: 'Share Capital', topic: null, format: 'mcq', question: `Stem ${id}`, passage: null, options: [0, 1, 2, 3].map((i) => ({ index: i, text: `Option ${i}` })), ...o });

test('the starters are doubts about the student\'s own missed chapters, each sent with its subject and chapter', () => {
  const s = doubtStarters({ insights: HEAVY, subjects: ['accountancy', 'economics', 'english'] });
  assert.equal(s.length, 3);
  assert.deepEqual(s.map((x) => [x.subject, x.chapter, x.mine]), [['accountancy', 'Change in Profit Sharing Ratio', true], ['accountancy', 'Share Capital', true], ['economics', 'Money & Banking', true]]);
  assert.equal(s[0].text, 'I keep getting Change in Profit Sharing Ratio questions wrong. What am I missing?');
  assert.equal(s[0].preview, 'Accountancy: 7 wrong answers and 2 left blank in your practice');
  assert.equal(s[1].text, 'I am not sure how to start Share Capital questions. Where do I begin?', 'a chapter of blanks is asked as where to begin');
  assert.equal(s[1].preview, 'Accountancy: 4 left blank in your practice');
  // Six for "See more": the rest come from the student's subjects, still tied to a real chapter.
  const six = doubtStarters({ insights: HEAVY, subjects: ['accountancy', 'economics', 'english'], limit: 6 });
  assert.equal(six.length, 6);
  assert.equal(new Set(six.map((x) => `${x.subject}::${x.chapter}`)).size, 6, 'no chapter twice');
});

test('a fresh account still gets doubts tied to a real chapter, so the 2 questions come from it', () => {
  const s = doubtStarters({ insights: FRESH, subjects: [] });
  assert.deepEqual(s.map((x) => x.text), ['Explain the sacrificing ratio in simple words', 'What is price elasticity of demand?', 'How do I find the main idea of a passage?']);
  assert.ok(s.every((x) => !x.mine && x.chapter && x.preview === `Then 2 real CUET questions on ${x.chapter}`));
  for (const [subject, list] of Object.entries(FRESH_DOUBTS)) for (const d of list) {
    assert.ok(getCanonicalChapters(subject).includes(d.chapter), `${subject}: ${d.chapter} is a syllabus chapter`);
  }
  assert.deepEqual(doubtStarters({ insights: FRESH, subjects: ['business_studies'] }).map((x) => x.chapter), ['Principles of Management', 'Organising']);
});

test('a starter is a doubt: it never becomes a free record answer, it goes out as the 1 credit it showed, with its chapter', () => {
  const paid = paidState(WALLET);
  for (const s of doubtStarters({ insights: HEAVY, subjects: ['accountancy'] })) {
    const out = planStart({ initial: { text: s.text, doubt: { subject: s.subject, chapter: s.chapter } }, status: 'ready', insights: HEAVY, wallet: WALLET, paid });
    assert.deepEqual(out, { kind: 'paid', text: s.text, anchor: { subject: s.subject, chapter: s.chapter } }, s.text);
  }
  const doubt = { text: doubtFor('Time Based Data', 3), doubt: { subject: 'mathematics', chapter: 'Time Based Data' } };
  assert.equal(planStart({ initial: doubt, status: 'loading', insights: null, wallet: WALLET, paid }).kind, 'paid', 'a doubt does not wait for the record');
  assert.equal(planStart({ initial: doubt, status: 'ready', insights: HEAVY, wallet: null, paid: paidState(null) }).kind, 'wait');
  assert.equal(planStart({ initial: doubt, status: 'ready', insights: HEAVY, wallet: WALLET, offline: true, paid }).kind, 'say');
  const empty = { ...WALLET, total: 0, state: 'empty' };
  assert.equal(planStart({ initial: doubt, status: 'ready', insights: HEAVY, wallet: empty, paid: paidState(empty) }).kind, 'say', 'out of credits: said, nothing sent');
  // An ordinary starter or typed ask is unchanged: no anchor key at all.
  assert.deepEqual(planStart({ initial: { text: 'Why is the sky blue?' }, status: 'ready', insights: HEAVY, wallet: WALLET, paid }), { kind: 'paid', text: 'Why is the sky blue?' });
});

test('"What should I revise tonight?" is free: priced Free, planned as tonight, offline says nothing was charged', () => {
  for (const t of ['What should I revise tonight?', 'what should I revise today', 'So, what should i revise tonight']) assert.equal(isTonightAsk(t), true, t);
  for (const t of ['Revise tonight', 'What should I practise tonight?', '']) assert.equal(isTonightAsk(t), false, t);
  assert.equal(priceOfTyped('What should I revise tonight?', { insights: HEAVY, status: 'ready' }), 'free');
  assert.equal(priceOfTyped('What should I revise tonight?', { insights: null, status: 'loading' }), 'free', 'it never needs the page\'s record');
  const ask = recordDoorAsks(HEAVY, { now: new Date(2026, 9, 20, 21) }).find((a) => a.id === 'revise');
  assert.deepEqual([ask.price, ask.text, ask.preview], ['free', 'What should I revise tonight?', 'Your chapters, rules and traps for tonight']);
  assert.equal(recordDoorAsks(HEAVY, { now: new Date(2026, 9, 20, 9) }).find((a) => a.id === 'revise').preview, 'Your chapters, rules and traps for today');
  for (const status of ['ready', 'unavailable', 'loading', 'empty']) {
    assert.deepEqual(planStart({ initial: { text: ask.text, free: true }, status, insights: null, wallet: null, paid: paidState(null) }), { kind: 'tonight', text: ask.text }, status);
  }
  const off = planStart({ initial: { text: ask.text, free: true }, status: 'ready', insights: HEAVY, wallet: WALLET, offline: true, paid: paidState(WALLET) });
  assert.equal(off.kind, 'record-failed');
  assert.match(off.reply, /Nothing was charged\.$/);
});

test('tonight\'s set: only the parts the record filled, in the record\'s own counts', () => {
  const v = tonightView({
    when: 'tonight', reviseDue: 2, line: 'Start with Revise: 2 cards are due.',
    chapters: [{ subject: 'accountancy', subjectName: 'Accountancy', chapter: 'Share Capital', lost: 38 }],
    rules: ['After "will", use the verb.', { text: 'Read NOT twice.' }, '  '],
    traps: [{ trapType: 'missed_not', phrase: 'A missed NOT or EXCEPT', caught: 4, chances: 6 }, { phrase: 'An extreme word', caught: 1, of: 3 }, { phrase: 'Bad', caught: 2, chances: 0 }],
  });
  assert.deepEqual(v.chapters.map((c) => [c.chapter, c.lost, c.href]), [['Share Capital', '38 marks lost', '/test?subject=accountancy&mode=quick&count=10&chapter=Share+Capital']]);
  assert.deepEqual(v.rules, ['After "will", use the verb.', 'Read NOT twice.']);
  assert.deepEqual(v.traps, ['A missed NOT or EXCEPT has caught you 4 times in 6 chances.', 'An extreme word has caught you once in 3 chances.']);
  assert.equal(v.due, '2 Revise cards are due.');
  assert.equal(tonightView({ chapters: [], rules: [], traps: [], reviseDue: 0, line: null }), null);
  assert.equal(trapLine({ phrase: 'X', caught: 1 }), null, 'no count, no line');
});

test('the reply that opens a doubt: its thread and 2 questions, wherever the route put them; half a question is never shown', () => {
  const thread = { id: 't_1', followUpsLeft: 1, followUpsMax: 1, subject: 'accountancy', chapter: 'Share Capital' };
  const top = threadFromReply({ ok: true, reply: 'x', thread, checks: [Q('a'), Q('b'), Q('c')], checksNote: 'ignored when there are questions' });
  assert.deepEqual(top.thread, thread);
  assert.deepEqual(top.checks.map((q) => q.checkQuestionId), ['a', 'b'], 'two at most');
  assert.equal(top.checksNote, null);
  const inner = threadFromReply({ ok: true, response: { reply: 'x', thread, checks: [Q('a', { options: [{ text: 'only one' }] })], checksNote: 'Pick the chapter and Mobi adds 2 real CUET questions on it to test this.' } });
  assert.deepEqual(inner.checks, [], 'a question without four options is left out');
  assert.match(inner.checksNote, /^Pick the chapter/);
  assert.equal(threadFromReply({ ok: true, reply: 'x' }).thread, null);
  assert.equal(isShowableQuestion(Q('z')), true);
  assert.equal(followUpOpen(thread), true);
  assert.equal(followUpOpen({ ...thread, followUpsLeft: 0 }), false);
  assert.equal(followUpOpen(null), false);
});

test('every failure says nothing was charged; a full thread closes the follow-up and offers a new doubt for 1 credit', () => {
  const full = chatFailure(409, { ok: false, error: 'thread_full', message: 'This doubt has had its follow-up. Ask a new doubt to open a new one, for 1 credit.', charged: 0 });
  assert.equal(full.full, true);
  assert.equal(full.reply, 'This doubt has had its follow-up. Ask a new doubt to open a new one, for 1 credit. Nothing was charged.');
  const gone = chatFailure(404, { ok: false, error: 'thread_not_found', message: 'That doubt could not be found. Ask it again as a new doubt. Nothing was charged.' });
  assert.equal(gone.gone, true);
  assert.equal(gone.reply, 'That doubt could not be found. Ask it again as a new doubt. Nothing was charged.', 'a line that already says so is kept as it came');
  assert.deepEqual(chatFailure(402, { error: 'insufficient_ai_credits' }).actions, [{ label: 'See your credits', route: '/wallet' }]);
  assert.match(chatFailure(402, {}).reply, /Nothing was charged\.$/);
  assert.equal(chatFailure(429, {}).reply, JOB_COPY.tooMany);
  assert.equal(chatFailure(502, { message: 'Mobi could not answer that follow-up this time. Nothing was charged, and your follow-up is still there.' }).reply, 'Mobi could not answer that follow-up this time. Nothing was charged, and your follow-up is still there.');
  assert.equal(chatFailure(500, null).reply, JOB_COPY.failed);
  assert.equal(withNothingCharged('No credits were used'), 'No credits were used');
  assert.equal(withNothingCharged('It broke'), 'It broke. Nothing was charged.');
});

test('the 2 questions are marked by the server: the rows say pick and key in words, and the tally waits for both', () => {
  const q = Q('a');
  assert.deepEqual(checkRows(q).map((r) => [r.letter, r.state, r.tag]), [['A', null, null], ['B', null, null], ['C', null, null], ['D', null, null]]);
  const wrong = { right: false, pick: 1, key: { index: 2, text: 'Option 2' }, picked: { index: 1, text: 'Option 1' }, explanation: 'Because.', line: 'Not this time. The key and the book explanation are below.' };
  assert.deepEqual(checkRows(q, wrong).map((r) => r.tag), [null, 'Your pick', 'Key', null]);
  assert.deepEqual(checkRows(q, { ...wrong, right: true, pick: 2, picked: { index: 2 } }).map((r) => r.tag), [null, null, 'Your pick and the key', null]);
  const ok = (body, status = 200) => ({ kind: 'response', res: { ok: status < 300, status }, body });
  assert.deepEqual(planThreadAnswer(ok({ ok: true, replayed: false, result: wrong })), { state: 'answered', result: wrong, replayed: false });
  assert.equal(planThreadAnswer(ok({ ok: true, replayed: true, result: wrong })).replayed, true, 'the first answer counts');
  assert.deepEqual(planThreadAnswer({ kind: 'network' }), { state: 'error', message: JOB_COPY.markFailed, canRetry: true });
  assert.equal(planThreadAnswer(ok({ ok: false, error: 'invalid_pick', message: 'That is not one of the questions offered on this doubt.' }, 422)).canRetry, false);
  assert.equal(checksTally({ a: wrong }, 2), null);
  assert.equal(checksTally({ a: wrong, b: { ...wrong, right: true } }, 2), '1 of 2 right. The explanation under each one shows the step.');
  assert.equal(checksTally({ a: { right: true }, b: { right: true } }, 2), '2 of 2 right. The idea held on real CUET questions.');
});

test('no questions attached: chapter chips (the student\'s own first), then op checks; a failure says nothing extra was charged', () => {
  const chips = chapterChips({ subject: 'accountancy', insights: HEAVY, subjects: ['accountancy'] });
  assert.equal(chips.length, 6);
  assert.deepEqual(chips.slice(0, 2).map((c) => c.chapter), ['Change in Profit Sharing Ratio', 'Share Capital']);
  assert.ok(chips.every((c) => c.subject === 'accountancy'));
  const any = chapterChips({ insights: FRESH, subjects: ['economics'] });
  assert.ok(any.length > 0 && any.every((c) => getCanonicalChapters('economics').includes(c.chapter)));
  assert.ok(chapterChips({ subject: 'general_test', insights: FRESH }).length > 0, 'General Test reads the syllabus\'s "gat" chapters');
  const ok = (body, status = 200) => ({ kind: 'response', res: { ok: status < 300, status }, body });
  assert.deepEqual(planThreadChecks(ok({ ok: true, checks: [Q('a'), Q('b')], checksNote: null })).checks.length, 2);
  assert.deepEqual(planThreadChecks(ok({ ok: true, checks: [], checksNote: 'There are no unseen checked questions left on this chapter for you just now. Nothing extra was charged.' })),
    { state: 'none', message: 'There are no unseen checked questions left on this chapter for you just now. Nothing extra was charged.' });
  assert.match(planThreadChecks({ kind: 'timeout' }).message, /Nothing extra was charged\.$/);
  assert.match(planThreadChecks(ok({ ok: false, error: 'invalid_chapter', message: 'Pick the chapter' }, 422)).message, /Nothing was charged\.$/);
});

test('the words: what a credit buys, said plainly; no exclamation marks or arrows; never a Pro claim about Mobi', () => {
  assert.equal(JOB_COPY.creditBuys, '1 credit settles a doubt: Mobi’s answer, one follow-up, and 2 real CUET questions to test it.');
  assert.equal(JOB_COPY.newDoubt, 'Ask a new doubt (1 credit)');
  const lines = [
    ...Object.values(JOB_COPY).map((v) => (typeof v === 'function' ? v('Share Capital', 2) : v)),
    ...doubtStarters({ insights: HEAVY, subjects: ['accountancy'], limit: 6 }).flatMap((s) => [s.text, s.preview]),
    ...Object.values(FRESH_DOUBTS).flat().map((d) => d.text),
  ];
  for (const line of lines) assert.doesNotMatch(String(line), BANNED, String(line));
  for (const file of ['src/components/ai/mobiJobs.mjs', 'src/components/ai/MobiJobParts.jsx', 'src/components/ai/AskMobiDoors.jsx', 'src/components/ai/AskMobiPanel.jsx']) {
    assert.doesNotMatch(code(read(file)), /Included in Pro|fair use|no credits on Pro/i, file);
  }
});

test('wiring: the doors say what a credit buys and send each starter with its chapter; the panel runs the thread', () => {
  const doors = code(read('src/components/ai/AskMobiDoors.jsx'));
  assert.match(doors, /<p className="amd-buys">\{JOB_COPY\.creditBuys\}<\/p>/);
  assert.match(doors, /start\(\{ text: s\.text, doubt: \{ subject: s\.subject, chapter: s\.chapter \} \}\)/);
  assert.match(doors, /doubt=\{thread\.doubt\}/);
  const panel = code(read('src/components/ai/AskMobiPanel.jsx'));
  assert.match(panel, /const initial = useMemo\(\(\) => \(given && doubt \? \{ \.\.\.given, doubt \} : given\), \[given, doubt\]\);/);
  assert.match(panel, /\.\.\.\(sent\.threadId \? \{ threadId: sent\.threadId \} : \{\}\)/, 'the follow-up carries the thread');
  assert.match(panel, /\.\.\.\(sent\.anchor\?\.subject \? \{ subject: sent\.anchor\.subject, \.\.\.\(sent\.anchor\.chapter \? \{ chapter: sent\.anchor\.chapter \} : \{\}\) \} : \{\}\)/, 'a starter carries subject and chapter');
  assert.match(panel, /replyKind: replyKindOf\(sent\)/);
  assert.match(panel, /if \(sent\.kind === 'tonight'\) return 'tonight';/);
  assert.match(panel, /if \(sent\.kind === 'followup' \|\| sent\.questionRef\) return 'model';\s*return 'doubt';/, 'a typed Ask now doubt is never answered from the record\'s keywords');
  assert.match(panel, /if \(!questionTyping && followUpOpen\(doubtThread\)\) \{/, 'in an open doubt, typed words are its free follow-up');
  assert.match(panel, /<DoubtChecks/);
  assert.match(panel, /\{JOB_COPY\.newDoubt\}/);
  assert.match(panel, /const failure = chatFailure\(res\.status, data\);/);
  assert.match(panel, /else if \(plan\.kind === 'tonight'\) sendFree\(plan\.text, 'tonight'\);/);
  const parts = code(read('src/components/ai/MobiJobParts.jsx'));
  assert.match(parts, /postThread\(\{ op: 'answer', threadId, checkQuestionId: id, pick: a\.pick, requestId \}\)/);
  assert.match(parts, /postThread\(\{ op: 'checks', threadId, subject: chip\.subject, chapter: chip\.chapter \}\)/);
  assert.match(parts, /const requestId = a\.requestId \|\| newCheckRequestId\(\);/, 'one request id per answer, reused on a retry');
  assert.doesNotMatch(parts, /correct_index|isKey:/, 'the screen never marks an answer itself');
});
