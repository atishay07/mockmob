// Ask Mobi as one panel (ASK-MOBI-1018): the open API, the suggested asks and their prices, the wallet line, and the
// panel's source contract (no tabs before the first answer, the R4 safety rules kept).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { ASK_MOBI_EVENT, contextFromLegacy, isAskMobiNavHref, normalizeContext, openAskMobi } from '../../src/components/ai/askMobi.mjs';
import {
  answerFree, findChapter, modeFor, openingFor, paidState, priceForText, productAskFor, recordSummary, sessionsLabel,
  suggestionsFor, walletLine,
} from '../../src/components/ai/askSuggestions.mjs';
import { answerFromInsights } from '../prepos_insights.js';

const read = (path) => readFileSync(new URL(`../../${path}`, import.meta.url), 'utf8');

const chapter = (name, o = {}) => ({ key: `accountancy::${name}`, subject: 'accountancy', subjectName: 'Accountancy', chapter: name, right: 23, wrong: 11, skip: 0, n: 34, sessions: 4, accuracy: { pct: 68, low: 51, high: 81 }, open: 55, last: 1, ...o });
const INSIGHTS = {
  state: 'ready', sessions: 9, questions: 250,
  ledger: { gained: 710, penalty: 40, net: 670, openWrong: 200, openSkipped: 50, open: 250 },
  accuracy: { pct: 74, low: 70, high: 78 }, attemptRate: 96,
  chapters: { ranked: [chapter('Partnership'), chapter('Goodwill', { wrong: 5, n: 20, open: 25, sessions: 3 })], thin: [] },
  difficulty: [],
  pace: { usable: true, questionsTimed: 120, sessionsTimed: 5, medianSec: 48, p90Sec: 90, medianRightSec: 40, medianWrongSec: 60, shareOnWrong: 30, slowest: [{ chapter: 'Partnership', subject: 'accountancy', position: 7, seconds: 190, outcome: 'wrong', attemptId: 'a1' }] },
  changes: { sessionsWithTelemetry: 0, count: 0, gains: 0, losses: 0, marksGained: 0, marksLost: 0, net: 0 },
  week: { thisWeek: { sessions: 2, questions: 60, right: 40, wrong: 15, skip: 5, net: 185, accuracy: { pct: 73, low: 60, high: 83 } }, lastWeek: { sessions: 3, questions: 90, right: 60, wrong: 20, skip: 10, net: 280, accuracy: { pct: 75, low: 65, high: 83 } }, activeDaysLast14: 5 },
};
const EMPTY = { state: 'empty', sessions: 0, questions: 0 };
const BANNED = /[!→←↗»]|\b[A-Z]{4,}\b(?<!\bNTA\b)/;

test('openAskMobi carries a cleaned context; the R4 names still open the scoped panel', () => {
  const heard = [];
  const host = new EventTarget();
  host.addEventListener(ASK_MOBI_EVENT, (event) => { heard.push(event.detail); event.preventDefault(); });
  assert.equal(openAskMobi({ context: { kind: 'question', ref: 'att_1:q-9', number: 7, chapter: 'Partnership', pickLabel: '9:6:5', keyLabel: '19:11:10' } }, host), true);
  assert.deepEqual(heard[0].context, { kind: 'question', ref: 'att_1:q-9', label: null, number: 7, chapter: 'Partnership', lines: [], pickLabel: '9:6:5', keyLabel: '19:11:10' });
  assert.equal(heard[0].questionRef, 'att_1:q-9', 'older readers of the detail still see the reference');
  openAskMobi({ context: { kind: 'today', reason: 'Partnership leaks most.', lines: ['11 wrong of 34 answered', 42, '<b>x</b>', '', null, 'a', 'b', 'c'] } }, host);
  assert.deepEqual(heard[1].context.lines, ['11 wrong of 34 answered', '42', ' b x /b ', 'a'].map((l) => l.replace(/\s+/g, ' ').trim()), 'at most four lines, no markup');
  assert.equal(heard[1].context.reason, 'Partnership leaks most.');
  openAskMobi({ context: { kind: 'question', ref: 'a:b:c' } }, host);
  assert.equal(heard[2].context.kind, 'page', 'a malformed reference never reaches the context route');
  openAskMobi({ context: { kind: 'bogus' } }, host);
  assert.equal(heard[3].context.kind, 'page');
  openAskMobi({ tab: 'ask', questionRef: 'a1:q2' }, host);
  assert.equal(heard[4].context.kind, 'question');
  assert.deepEqual(contextFromLegacy({ tab: 'record' }), normalizeContext({ kind: 'page', record: true }));
  assert.equal(normalizeContext({ kind: 'mock', ref: 'att 1' }).ref, null);
  assert.equal(normalizeContext({ label: 'x'.repeat(200) }).label.length, 48);
  assert.equal(openAskMobi({ context: { kind: 'page' } }, new EventTarget()), false, 'no host: the caller keeps its link');
});

test('the nav row is recognised by its plain /mentor link only', () => {
  assert.equal(isAskMobiNavHref('/mentor'), true);
  for (const href of ['/mentor?tab=record', '/mentor/x', 'https://evil.example/mentor', '/mentors', null, '']) assert.equal(isAskMobiNavHref(href), false, String(href));
});

test('the reply mode follows the context', () => {
  assert.equal(modeFor('question'), 'revision');
  assert.equal(modeFor('mock'), 'autopsy');
  assert.equal(modeFor('today'), 'mentor');
  assert.equal(modeFor('page'), 'mentor');
});

test('every kind gets 2-3 asks, each with a price; a question leads with written replies and keeps one free record ask', () => {
  for (const kind of ['question', 'mock', 'today', 'practice', 'page']) {
    const asks = suggestionsFor({ context: normalizeContext({ kind, ref: kind === 'question' ? 'a1:q2' : undefined, chapter: 'Partnership' }), insights: INSIGHTS, status: 'ready', pro: true });
    assert.ok(asks.length >= 2 && asks.length <= 3, kind);
    for (const ask of asks) {
      assert.ok(['free', 'paid'].includes(ask.price), `${kind} ${ask.id}`);
      assert.doesNotMatch(ask.label, BANNED, ask.label);
      assert.match(ask.label, /^[A-Z]/, 'sentence case');
      if (ask.line) assert.doesNotMatch(ask.line, BANNED, ask.line);
    }
  }
  const q = suggestionsFor({ context: normalizeContext({ kind: 'question', ref: 'a1:q2', number: 7, chapter: 'Partnership', pickLabel: '9:6:5', keyLabel: '19:11:10' }), insights: INSIGHTS, status: 'ready', pro: true });
  assert.deepEqual(q.map((a) => [a.id, a.price]), [['explain_key', 'paid'], ['misread', 'paid'], ['chapter_history', 'free']]);
  assert.equal(q[0].label, 'Why is 19:11:10 right and 9:6:5 wrong?');
  assert.equal(q[2].line, '11 wrong of 34 answered, in 4 sessions', 'a real preview with its denominator');
});

test('no preview is invented: without a record line the preview is omitted, and record asks wait for the record', () => {
  const thin = { ...INSIGHTS, chapters: { ranked: [], thin: [] }, pace: { ...INSIGHTS.pace, usable: false }, week: { ...INSIGHTS.week, thisWeek: { ...INSIGHTS.week.thisWeek, sessions: 0 } } };
  for (const ask of suggestionsFor({ context: normalizeContext({ kind: 'page' }), insights: thin, status: 'ready', pro: true })) assert.equal(ask.line, null, ask.id);
  const q = suggestionsFor({ context: normalizeContext({ kind: 'question', ref: 'a1:q2', chapter: 'Ratios' }), insights: INSIGHTS, status: 'ready', pro: true });
  assert.equal(q.find((a) => a.id === 'chapter_history').line, null, 'a chapter the record does not hold has no preview');
  const down = suggestionsFor({ context: normalizeContext({ kind: 'question', ref: 'a1:q2', chapter: 'Partnership' }), insights: null, status: 'unavailable' });
  assert.ok(down.every((a) => a.price === 'paid'), 'record not loaded: only written replies are offered for a question');
  const pace = suggestionsFor({ context: normalizeContext({ kind: 'practice' }), insights: INSIGHTS, status: 'ready', pro: false }).find((a) => a.id === 'pace');
  assert.equal(pace.line, null, 'no Pro pace figure in a free preview');
});

test('a new student gets the free product asks, answered from the help answers', () => {
  const asks = suggestionsFor({ context: normalizeContext({ kind: 'page' }), insights: EMPTY, status: 'empty' });
  assert.deepEqual(asks.map((a) => [a.label, a.price]), [['How do AI credits work?', 'free'], ['What is NTA mode?', 'free']]);
  assert.match(answerFree('credits_help', {}).reply, /AI credits pay for Ask Mobi replies/);
  assert.match(answerFree('nta_help', {}).reply, /real CUET screen/);
  assert.equal(sessionsLabel(EMPTY, 'empty'), 'no sessions yet');
  assert.equal(sessionsLabel(INSIGHTS, 'ready'), '9 sessions');
  assert.equal(sessionsLabel(null, 'unavailable'), null);
});

test('prices match answerFromInsights: record questions are free, anything else is 1 AI credit, a question attached is always paid', () => {
  for (const text of ['Where am I losing marks?', 'Which chapter is weak?', 'Where am I losing time?', 'How did this week go?']) {
    assert.ok(answerFromInsights(text, INSIGHTS), text);
    assert.equal(priceForText(text, { insights: INSIGHTS, status: 'ready', pro: true }), 'free', text);
    assert.equal(priceForText(text, { insights: INSIGHTS, status: 'ready', pro: true, hasQuestion: true }), 'paid', text);
  }
  for (const text of ['Explain goodwill to me', 'Why is 3:2 wrong here?']) {
    assert.equal(answerFromInsights(text, INSIGHTS), null, text);
    assert.equal(priceForText(text, { insights: INSIGHTS, status: 'ready', pro: true }), 'paid', text);
  }
  assert.equal(priceForText('Where am I losing marks?', { insights: null, status: 'unavailable' }), 'paid', 'unknown is shown as the price, never as free');
  assert.equal(priceForText('How do AI credits work?', {}), 'free');
  assert.equal(productAskFor('what is nta mode'), 'nta_help');
  assert.equal(priceForText('   ', {}), null);
});

test('free answers carry real figures and one next move; the opening is there for a mock, Today and Practice', () => {
  const h = answerFree('chapter_history', { context: { chapter: 'Partnership' }, insights: INSIGHTS, pro: true });
  assert.match(h.reply, /23 right, 11 wrong and 0 left blank, out of 34 questions over 4 sessions/);
  assert.equal(h.actions.length, 1);
  assert.equal(h.actions[0].label, 'Practise 10 Partnership questions');
  assert.equal(h.source, 'From your record, 9 sessions and 250 questions');
  assert.equal(findChapter(INSIGHTS, 'partnership').chapter, 'Partnership');
  assert.equal(openingFor({ context: normalizeContext({ kind: 'question', ref: 'a1:q2' }), insights: INSIGHTS, status: 'ready' }), null);
  assert.equal(openingFor({ context: normalizeContext({ kind: 'page' }), insights: INSIGHTS, status: 'ready' }), null);
  const today = openingFor({ context: normalizeContext({ kind: 'today', reason: 'Partnership leaks most.', lines: ['11 wrong of 34 answered.'] }), insights: INSIGHTS, status: 'ready' });
  assert.equal(today.reply, 'Partnership leaks most. 11 wrong of 34 answered.');
  const mock = openingFor({ context: normalizeContext({ kind: 'mock', ref: 'att1', label: 'Mock 3', lines: ['Partnership: 36 of 78 marks lost.'] }), insights: INSIGHTS, status: 'ready' });
  assert.equal(mock.source, 'From Mock 3');
  const practice = openingFor({ context: normalizeContext({ kind: 'practice' }), insights: INSIGHTS, status: 'ready', pro: true });
  assert.match(practice.reply, /Partnership is where the most marks are open/);
  assert.equal(openingFor({ context: normalizeContext({ kind: 'practice' }), insights: null, status: 'loading' }), null, 'nothing is shown before the record is read');
});

test('the record chip summary: marks ledger, biggest leak, pace', () => {
  const rows = recordSummary(INSIGHTS, { pro: true });
  assert.deepEqual(rows.map((r) => r.id), ['ledger', 'leak', 'pace']);
  assert.equal(rows[0].text, '670 net marks from 250 questions in 9 sessions');
  assert.equal(rows[1].text, 'Partnership, 55 of 250 open marks');
  assert.equal(rows[2].text, 'A typical question takes 48s, across 120 timed questions');
  assert.equal(recordSummary(INSIGHTS, { pro: false })[2].text, 'Pace detail is part of Pro');
  assert.deepEqual(recordSummary(EMPTY), []);
});

test('the wallet line and the paid state say the truth, and unknown is never 0', () => {
  const w = { known: true, state: 'available', total: 8, includedRemaining: 8, includedMonthlyCredits: 10, bonusCredits: 0, resetAt: '2026-10-31T18:30:00.000Z' };
  assert.deepEqual(walletLine(w), { count: 8, rest: 'of 10 AI credits left', reset: 'resets 1 Nov' });
  assert.deepEqual(walletLine({ ...w, total: 38, bonusCredits: 30 }), { count: 38, rest: 'AI credits left', reset: 'resets 1 Nov' }, 'purchased credits make "of 10" untrue');
  assert.equal(walletLine(null).count, null);
  assert.equal(walletLine({ known: false, state: 'error' }).count, null);
  assert.equal(paidState(w).open, true);
  assert.match(paidState({ ...w, total: 0, includedRemaining: 0, state: 'empty' }).why, /^0 of 10 AI credits left\. They reset on 1 Nov\. Questions about your record stay free\. Nothing is charged from here\.$/);
  assert.match(paidState({ known: true, state: 'paused', total: 5 }).why, /paused/);
  assert.equal(paidState(null).open, false);
});

test('the panel: no tabs, switch or dropdown before the first answer; the R4 safety rules are kept', () => {
  const panel = read('src/components/ai/AskMobiPanel.jsx');
  assert.doesNotMatch(panel, /SECTIONS|Listbox|pp-ask__switch|role="tablist"|<select/, 'nothing that reads like a form');
  assert.doesNotMatch(panel, /arena-dark-island|#090a08|PrepOSOrb/, 'arena tokens in both themes, no orb');
  assert.match(panel, /fetch\(`\/api\/recovery\/ask-context\?q=\$\{encodeURIComponent\(questionRef\)\}`/, 'the question hand-off is kept');
  assert.match(panel, /\.\.\.\(pendingRef\.current\.questionRef \? \{ questionRef: pendingRef\.current\.questionRef \} : \{\}\)/, 'the request carries the reference, never the question text');
  assert.match(panel, /if \(!isRetry\) pendingRef\.current = \{ message: finalText, id: crypto\.randomUUID\(\)/, 'one request id per student action');
  assert.match(panel, /onClick=\{\(\) => sendPaid\(retry\.message, true\)\}>Retry this question</, 'a retry reuses the same request');
  assert.match(panel, /if \(!isRetry && !paid\.open\) return;/, 'no paid call when written replies cannot be bought');
  assert.match(panel, /announceWallet\(userId, next\)/, 'the top bar takes the same balance');
  assert.match(panel, /readWallet\(\);\r?\n    \}/, 'the balance is read again after every written reply');
  assert.match(panel, /const fromRecord = !questionTyping && /, 'no record answer to a question while written replies are open');
  assert.match(panel, /ask\.price === 'free' \? 'Free' : creditCount\(1\)/, 'every ask shows its price before it is sent');
  const css = read('src/components/ai/ask-mobi.css');
  assert.doesNotMatch(css, /box-shadow:[^;]*0 0 \d+px[^;]*(210, ?240|d2f000)|text-shadow|backdrop-filter|linear-gradient|#d2f000/i, 'no glow, glass or volt fill in the panel');
  assert.match(css, /prefers-reduced-motion/);
  assert.match(css, /width: 400px/);
  const drawer = read('src/components/ai/AssistantDrawer.jsx');
  assert.match(drawer, /if \(width >= 1280\) return 'dock';/);
  assert.match(drawer, /role=\{modal \? 'dialog' : 'complementary'\}/, 'docked it is a region, not a modal');
  assert.match(drawer, /const FLICK = 110;/);
  assert.match(drawer, /const CLOSE_SHARE = 0\.35;/);
  const host = read('src/components/ai/AskMobiHost.jsx');
  assert.match(host, /isPlainClick\(event\)/, 'a modifier-click on the nav row still opens /mentor');
});
