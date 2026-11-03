// Learn v2 composer (data/learn/compose.js), seconds (data/learn/seconds.js), LK15's rule (data/learn/allowance.js) and the
// return-day stamps (data/learn/stamps.js), over real deck chapters and the real preview questions
// (data/fixtures/learn-preview-questions.json) plus small hand fixtures. BUILD-1101 Part 1 (1.4, 1.5, 1.6, R11, R15, R16) and
// A5 section 4 items 5, 6 and 13 at the pure level.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import {
  LEARN_RULES, NOTE, budgetSeconds, composeRun, dryRun, effectiveLeaveOut, minutesFor, mistakesFor, orderProblems, pickQuestions,
  isLong, mistakeLabel, pileMinutes, rhythm, splitMinutes, shrinkText, overdueNewCap, lessonSeconds, feedCardPool,
} from '../learn/compose.js';
import { SECONDS, cardSeconds, cardWords, questionSeconds, itemSeconds, sumSeconds } from '../learn/seconds.js';
import { LEARN_FREE, FREE_CAPPED, FREE_CARDS_ONLY, FREE_SESSION_DONE, freeSession, isCounted } from '../learn/allowance.js';
import { returnDay, revisePileGroups, revisePileLine, shortDate, IN_RUN, retryReady, doneLine, movedLine, levelPick } from '../learn/stamps.js';
import { schedule, tasteIds } from '../keycards.js';

const ROOT = process.cwd();
const json = (f) => JSON.parse(readFileSync(path.join(ROOT, f), 'utf8'));
const NOW = Date.parse('2026-10-31T10:00:00+05:30'); // a Saturday
const DAY = 86_400_000;
const FIX = json('data/fixtures/learn-preview-questions.json').questions;
const DECKS = Object.fromEntries(['accountancy', 'economics', 'biology'].map((s) => [s, json(`data/keycards/decks/${s}.json`).cards]));
const words = (t) => String(t || '').split(/\s+/).filter(Boolean).length;

function chapter(subject, key, chapterName) {
  const cards = DECKS[subject].filter((c) => c.chapterKey === key);
  const questions = FIX.filter((q) => q.subject === subject && q.chapter === chapterName).map((q) => ({ id: q.id, difficulty: q.difficulty, cards: q.cards, seen: false, words: words(q.body) }));
  return { cards, questions };
}
const PF = chapter('accountancy', 'accountancy.partnership-fundamentals', 'Partnership Fundamentals');
const AOP = chapter('accountancy', 'accountancy.admission-of-partner', 'Admission of Partner');
const CPSR = chapter('accountancy', 'accountancy.change-in-profit-sharing-ratio', 'Change in Profit Sharing Ratio');
const PLA = chapter('accountancy', 'accountancy.profit-and-loss-appropriation-account', 'Profit & Loss Appropriation Account');
const ECO = chapter('economics', 'economics.introduction-and-theory-of-consumer-behaviour', 'Introduction & Theory of Consumer Behaviour');
const BIO = chapter('biology', 'biology.molecular-basis-of-inheritance', 'Molecular Basis of Inheritance');
const byOrder = (a, b) => (a.order || 0) - (b.order || 0);
const free = (ch) => { const taste = tasteIds(ch.cards); return ch.cards.filter((c) => taste.has(c.id)); };
/** A production-like pool: 60 questions of the chapter, a third of them linked to one of its cards. */
const pool60 = (ch) => Array.from({ length: 60 }, (_, i) => ({ id: `p60-${i}`, difficulty: ['easy', 'medium', 'hard'][i % 3], cards: i % 3 === 0 ? [ch.cards[i % ch.cards.length].id] : [], seen: false, words: 30 + (i % 5) * 10 }));

/** The returning student's chapter: 3 Must-know cards reviewed 6 days ago (due), 3 open mistakes. */
function returning(ch) {
  const must = ch.cards.filter((c) => c.importance === 'must').sort(byOrder);
  const states = new Map();
  must.slice(0, 3).forEach((c, i) => {
    const s = schedule(null, 3, NOW - 6 * DAY - i * 3_600_000);
    states.set(c.id, { card_id: c.id, reps: s.reps, due_at: s.due_at, schedule: s.schedule });
  });
  const mistakes = [...ch.questions].filter((q) => q.difficulty === 'medium').slice(0, 3).map((q) => ({ id: q.id, where: 'Mock 3', when: '16 Oct' }));
  return { states, mistakes };
}
const lesson = { id: 'accountancy-revaluation', title: 'Revaluation of assets and liabilities', minutes: 7, read: false };
const diffRank = { easy: 0, medium: 1, hard: 2 };
const sum = (items) => items.reduce((s, i) => s + i.seconds, 0);

// ---------------------------------------------------------------- seconds (BUILD-1101 1.5, R8)

test('seconds per item: cards new 18, due 12, look 10, recap 10, +8 when long; questions 50, 65, 90, +20 when long; a mistake 60', () => {
  assert.deepEqual([cardSeconds({ stage: 'new' }), cardSeconds({ stage: 'due' }), cardSeconds({ stage: 'new', look: true }), cardSeconds({ recap: true }), cardSeconds({ stage: 'again' })], [18, 12, 10, 10, 12]);
  assert.equal(cardSeconds({ stage: 'new', words: 61 }), 26);
  assert.equal(cardSeconds({ stage: 'new', words: 60 }), 18);
  assert.deepEqual(['easy', 'medium', 'hard', null].map((difficulty) => questionSeconds({ difficulty })), [50, 65, 90, 65]);
  assert.equal(questionSeconds({ difficulty: 'hard', words: 80 }), 110);
  assert.equal(questionSeconds({ origin: 'mistake', difficulty: 'hard' }), 60);
  assert.equal(questionSeconds({ level: true }), SECONDS.level);
  assert.equal(cardWords({ front: 'What is a ratio?', quote: 'A ratio is a number.' }), 9);
  assert.equal(itemSeconds({ type: 'card', seconds: 33 }), 33, 'an item\'s own seconds win');
  assert.equal(itemSeconds({ type: 'lesson', minutes: 7 }), 420);
});

test('every composed item carries seconds, and the run\'s seconds are their sum (mix, feed, cards, recap, level)', () => {
  const { states, mistakes } = returning(PF);
  for (const kind of ['mix', 'feed', 'cards', 'recap', 'level']) {
    const run = composeRun({ kind, minutes: 10, cards: PF.cards, states, now: NOW, questions: PF.questions, mistakes });
    assert.ok(run.items.length > 0, kind);
    assert.ok(run.items.every((i) => Number.isFinite(i.seconds) && i.seconds > 0), `${kind}: every item has seconds`);
    assert.equal(run.seconds, sumSeconds(run.items), kind);
    assert.ok(run.items.every((i) => !('words' in i) && !('held' in i)), 'composer-only fields stay inside');
  }
});

test('the budget is minutes x 60 / 1.1, and the one minutes function says it back with the 10 percent', () => {
  assert.equal(Math.round(budgetSeconds(5)), 273);
  assert.equal(Math.round(budgetSeconds(10)), 545);
  assert.equal(Math.round(budgetSeconds(20)), 1091);
  assert.equal(minutesFor(540), 10);
  assert.equal(minutesFor(0), 0);
  assert.equal(minutesFor(5), 1, 'at least 1');
  assert.deepEqual([5, 10, 20, 35].map(mistakesFor), [1, 2, 3, 3]);
  assert.equal(minutesFor(lessonSeconds(7)), 7, 'a lesson\'s minutes are exact');
});

// ---------------------------------------------------------------- LK15 (BUILD-1101 1.6)

test('LK15: one Learn session a day for mix and feed; 10 minutes at most; after the claim a mix is cards only and a feed is refused', () => {
  assert.deepEqual(LEARN_FREE, { sessionsPerDay: 1, maxMinutes: 10, counted: ['mix', 'feed'] });
  assert.deepEqual(['mix', 'feed', 'cards', 'recap', 'level'].map(isCounted), [true, true, false, false, false]);
  // R3-SPEC ruling F: the 402 line is the shared headline and line, word for word.
  assert.equal(FREE_SESSION_DONE, "That was today's free session. Questions come back tomorrow. Your Key cards stay open.");
  assert.equal(FREE_CAPPED, 'On Free, a session is up to 10 minutes. With Pro, pick any length.');
  assert.equal(FREE_CARDS_ONLY, "That was today's free session, so this one is Key cards only. Questions come back tomorrow.");
  assert.deepEqual(freeSession({ isPro: true, kind: 'feed', minutes: 20, claimedByOther: true }), { minutes: 20, capped: null, cardsOnly: false, refuse: false, line: null });
  assert.deepEqual(freeSession({ kind: 'mix', minutes: 10 }), { minutes: 10, capped: null, cardsOnly: false, refuse: false, line: null }, 'the line shows only past the limit');
  assert.deepEqual(freeSession({ kind: 'mix', minutes: 20 }), { minutes: 10, capped: { asked: 20, text: FREE_CAPPED }, cardsOnly: false, refuse: false, line: null });
  assert.deepEqual(freeSession({ kind: 'mix', minutes: 5, claimedByOther: true }), { minutes: 5, capped: null, cardsOnly: true, refuse: false, line: FREE_CARDS_ONLY });
  assert.deepEqual(freeSession({ kind: 'feed', minutes: 10, claimedByOther: true }), { minutes: 10, capped: null, cardsOnly: false, refuse: true, line: FREE_SESSION_DONE });
  for (const kind of ['cards', 'recap', 'level']) assert.deepEqual(freeSession({ kind, minutes: 20, claimedByOther: true }), { minutes: 20, capped: null, cardsOnly: false, refuse: false, line: null }, kind);
});

// ---------------------------------------------------------------- the composer

test('a returning Pro 10-minute mix: 45 percent cards, 2 open mistakes, due cards shown first, filled to the nearest item', () => {
  const { states, mistakes } = returning(PF);
  const run = composeRun({ kind: 'mix', minutes: 10, cards: PF.cards, states, now: NOW, questions: PF.questions, mistakes });
  const B = budgetSeconds(10);
  const biggest = Math.max(...run.items.map((i) => i.seconds));
  assert.ok(Math.abs(run.seconds - B) <= biggest / 2 + 1e-6, `${run.seconds} is within half an item of ${B}`);
  assert.equal(run.piles.mistakes.count, 2);
  assert.ok(Math.abs(run.piles.cards.seconds / B - 0.45) < 0.1, `cards share ${run.piles.cards.seconds / B}`);
  const cards = run.items.filter((i) => i.type === 'card');
  assert.equal(cards.filter((c) => c.stage === 'due').length, 3);
  assert.equal(run.shrunk, false);
  assert.equal(run.shrink, null);
  assert.equal(run.realMinutes, 10);
});

test('5, 10 and 20 minutes retry 1, 2 and 3 open mistakes', () => {
  const { states, mistakes } = returning(PF);
  for (const [m, n] of [[5, 1], [10, 2], [20, 3]]) {
    const run = composeRun({ kind: 'mix', minutes: m, cards: PF.cards, states, now: NOW, questions: PF.questions, mistakes });
    assert.equal(run.items.filter((i) => i.origin === 'mistake').length, n, `${m} min`);
    assert.ok(run.items.filter((i) => i.origin === 'mistake').every((i) => i.mistake.where === 'Mock 3' && i.mistake.when === '16 Oct' && i.seconds >= 60));
  }
});

// A5 section 4 item 5: honest length.
test('honest length (R4): with a 60-question pool no run shrinks, for every chapter, plan and length; Free PF at 10 reads "Start 10 minutes"', () => {
  for (const [name, ch] of [['PF', PF], ['AOP', AOP], ['CPSR', CPSR], ['PLA', PLA], ['ECO', ECO], ['BIO', BIO]]) {
    const questions = pool60(ch);
    for (const plan of ['pro', 'free']) {
      for (const minutes of [5, 10, 20]) {
        for (const kind of ['mix', 'feed']) {
          const run = composeRun({ kind, minutes, cards: plan === 'pro' ? ch.cards : free(ch), states: new Map(), now: NOW, questions, ratingsLeft: plan === 'pro' ? null : 10, newLeft: plan === 'pro' ? null : 5 });
          assert.equal(run.shrunk, false, `${name} ${plan} ${kind} ${minutes}`);
          assert.equal(dryRun({ run, isPro: plan === 'pro' }).startLabel, `Start ${minutes} minutes`, `${name} ${plan} ${kind} ${minutes}`);
        }
      }
    }
  }
  const pf = composeRun({ kind: 'mix', minutes: 10, cards: free(PF), states: new Map(), now: NOW, questions: pool60(PF), ratingsLeft: 10, newLeft: 5 });
  assert.equal(pf.piles.cards.count, 5);
  assert.equal(dryRun({ run: pf, isPro: false }).startLabel, 'Start 10 minutes');
});

test('shrink only when the chapter has no more, with its reason and text: pool, cap, mistakes', () => {
  // pool: Free on Profit and Loss Appropriation (5 open cards, 1 question).
  const pla = composeRun({ kind: 'mix', minutes: 10, cards: free(PLA), states: new Map(), now: NOW, questions: PLA.questions });
  assert.equal(pla.shrunk, true);
  assert.equal(pla.shrink.reason, 'pool');
  assert.equal(pla.shrink.text, `This chapter has about ${pla.realMinutes} ${pla.realMinutes === 1 ? 'minute' : 'minutes'} of new work for today.`);
  // cap: 40 new cards a run, the chapter has more.
  const cards = Array.from({ length: 200 }, (_, i) => ({ id: `c${i}`, order: i, importance: i % 4 ? 'good' : 'must' }));
  const cap = composeRun({ kind: 'cards', minutes: 60, cards, now: NOW });
  assert.equal(cap.items.length, 40);
  assert.equal(cap.shrink.reason, 'cap');
  assert.equal(cap.shrink.text, `A session adds at most 40 new cards, about ${cap.realMinutes} minutes.`);
  // mistakes: only Your mistakes is in.
  const { states, mistakes } = returning(PF);
  const fix = composeRun({ kind: 'mix', minutes: 10, leaveOut: ['questions', 'cards', 'lesson'], cards: PF.cards, states, now: NOW, questions: PF.questions, mistakes });
  assert.ok(fix.items.every((i) => i.origin === 'mistake'));
  assert.equal(fix.items.length, 3);
  assert.equal(fix.shrink.reason, 'mistakes');
  assert.equal(fix.shrink.text, `Your 3 open mistakes take about ${fix.realMinutes} minutes.`);
  assert.equal(shrinkText('mistakes', { minutes: 1, mistakes: 1 }), 'Your 1 open mistake takes about 1 minute.');
  assert.equal(shrinkText('pool', { minutes: 0 }), 'Nothing is ready in this chapter yet.');
  // E-ENGLISH rows 51 and 52: past the overdue pause the line says what to do first, with a count that names its cards.
  assert.equal(shrinkText('cap', { minutes: 5, cap: 4, due: 46 }), 'Revise your 46 due cards first. Until then, a session adds at most 4 new cards (about 5 minutes).');
  assert.equal(shrinkText('cap', { minutes: 5, cap: 4, due: 41 }).includes('Revise your 41 due cards first.'), true);
  // Not shrunk when the time is short only by the size of an item: the pools still hold more.
  const ok = composeRun({ kind: 'mix', minutes: 10, cards: free(PF), states: new Map(), now: NOW, questions: PF.questions });
  assert.equal(ok.exhausted, false);
  assert.equal(ok.shrunk, false);
});

test('R15: past 40 overdue Key cards a run takes at most 4 new cards per 10 minutes, and the cards pile says "Revise first"', () => {
  assert.deepEqual([5, 10, 20].map(overdueNewCap), [2, 4, 8]);
  const run = composeRun({ kind: 'mix', minutes: 10, cards: PF.cards, states: new Map(), now: NOW, questions: PF.questions, overdue: 46 });
  assert.equal(run.items.filter((i) => i.type === 'card' && i.stage === 'new').length, 4);
  assert.deepEqual(run.overdue, { count: 46, newCap: 4, text: 'Revise first: 46 due' });
  const dry = dryRun({ run, isPro: true });
  assert.equal(dry.piles.find((p) => p.id === 'cards').note, 'Revise first: 46 due');
  const calm = composeRun({ kind: 'mix', minutes: 10, cards: PF.cards, states: new Map(), now: NOW, questions: PF.questions, overdue: 40 });
  assert.equal(calm.overdue, null);
  assert.ok(calm.items.filter((i) => i.type === 'card').length > 4);
});

// A5 section 4 item 6: one rhythm.
test('rhythm (R3): over every fixture chapter, length, kind, plan and student: no back-to-back questions while cards can sit between, short card streaks, A3 kept', () => {
  for (const [name, ch] of [['PF', PF], ['AOP', AOP], ['CPSR', CPSR], ['ECO', ECO], ['BIO', BIO]]) {
    for (const who of ['new', 'returning']) {
      const { states, mistakes } = who === 'returning' ? returning(ch) : { states: new Map(), mistakes: [] };
      for (const plan of ['pro', 'free']) {
        for (const kind of ['mix', 'feed']) {
          for (const minutes of [5, 10, 20]) {
            const label = `${name} ${who} ${plan} ${kind} ${minutes}`;
            const run = composeRun({ kind, minutes, cards: plan === 'pro' ? ch.cards : free(ch), states: plan === 'pro' ? states : new Map(), mistakes: plan === 'pro' ? mistakes : [], now: NOW, questions: ch.questions, lesson: name === 'AOP' && kind === 'mix' ? lesson : null });
            const body = run.items.filter((i) => i.type !== 'lesson');
            const C = body.filter((i) => i.type === 'card').length;
            const Q = body.filter((i) => i.type === 'question').length;
            const late = body.filter((i) => i.late).length;
            const r = rhythm(run.items);
            if (C && Q && Q <= C + 1) assert.ok(r.backToBack <= late, `${label}: ${r.backToBack} back to back`);
            // Long mistakes play together just before the final question (E3), so they count as one slot here.
            const slots = Q - late;
            if (slots) assert.ok(r.longestCards <= Math.ceil(C / slots) + 2, `${label}: a streak of ${r.longestCards} cards (C ${C}, Q ${Q})`);
            assert.deepEqual(orderProblems(run.items).filter((p) => kind === 'mix' || p.rule !== 'linked'), [], `${label}: ${JSON.stringify(orderProblems(run.items))}`);
          }
        }
      }
    }
  }
});

test('A3 order on the mixes: card first, mistakes before their line, linked 3 to 6 after its card, the easiest question last', () => {
  for (const [name, ch] of [['PF', PF], ['AOP', AOP], ['ECO', ECO], ['BIO', BIO]]) {
    const { states, mistakes } = returning(ch);
    for (const minutes of [5, 10, 20]) {
      for (const input of [{ cards: ch.cards, states, mistakes }, { cards: free(ch), states: new Map(), mistakes: [], ratingsLeft: 10, newLeft: 5 }]) {
        const run = composeRun({ kind: 'mix', minutes, now: NOW, questions: ch.questions, lesson: name === 'AOP' ? lesson : null, ...input });
        const label = `${name} ${minutes}`;
        assert.deepEqual(orderProblems(run.items), [], label);
        const start = run.items[0]?.type === 'lesson' ? 1 : 0;
        assert.equal(run.items[start].type, 'card', `${label}: first item`);
        const plain = run.items.filter((i) => i.type === 'question' && i.origin !== 'mistake');
        if (plain.length) {
          const last = run.items[run.items.length - 1];
          assert.equal(last.type, 'question', `${label}: last item`);
          assert.equal(diffRank[last.difficulty], Math.min(...plain.map((q) => diffRank[q.difficulty])), `${label}: the last question is the easiest`);
        }
        run.items.forEach((it, i) => {
          if (it.origin !== 'mistake') return;
          const before = run.items.slice(0, i).filter((x) => x.type === 'card').map((x) => x.cardId);
          assert.ok(!it.links.some((id) => before.includes(id)), `${label}: mistake ${i} after its line`);
        });
      }
    }
  }
});

test('at most one linked question per card; the slot-first order cuts the long card streaks (A5 F3)', () => {
  const questions = pool60(PF).map((q, i) => ({ ...q, cards: [PF.cards.find((c) => c.importance === 'must').id] , id: `same-${i}` }));
  const run = composeRun({ kind: 'mix', minutes: 20, cards: PF.cards, states: new Map(), now: NOW, questions });
  assert.equal(run.items.filter((i) => i.origin === 'linked').length, 1, 'one linked question for the one card');
  const pro20 = composeRun({ kind: 'mix', minutes: 20, cards: PF.cards, states: new Map(), now: NOW, questions: pool60(PF) });
  assert.ok(rhythm(pro20.items).longestCards <= 5, `streak ${rhythm(pro20.items).longestCards}`);
  assert.equal(rhythm(pro20.items).backToBack, 0);
});

test('the lesson (R11): at 20 minutes when it fits in half, while unread; a chapter with only a lesson starts the lesson by name', () => {
  const { states, mistakes } = returning(AOP);
  const at = (m, l = lesson) => composeRun({ kind: 'mix', minutes: m, cards: AOP.cards, states, now: NOW, questions: AOP.questions, mistakes, lesson: l });
  assert.equal(at(10).items.some((i) => i.type === 'lesson'), false);
  const twenty = at(20);
  assert.equal(twenty.items[0].type, 'lesson');
  assert.equal(twenty.items[1].type, 'card');
  assert.equal(twenty.items[0].seconds, lessonSeconds(7));
  assert.equal(at(20, { ...lesson, read: true }).items.some((i) => i.type === 'lesson'), false);
  assert.equal(at(20, { ...lesson, minutes: 12 }).items.some((i) => i.type === 'lesson'), false, '12 minutes do not fit in half of 20');
  assert.equal(composeRun({ kind: 'mix', minutes: 20, cards: AOP.cards, states, now: NOW, questions: AOP.questions, mistakes, lesson, leaveOut: ['lesson'] }).items.some((i) => i.type === 'lesson'), false);
  // A5 section 4 item 13: English Factual Passage (no cards, no questions) at 10 minutes offers its 6-minute lesson.
  const passage = { id: 'english-factual-main-idea', title: 'Main idea and supporting detail', minutes: 6, read: false };
  const only = composeRun({ kind: 'mix', minutes: 10, cards: [], now: NOW, questions: [], lesson: passage });
  assert.deepEqual(only.items.map((i) => i.type), ['lesson']);
  const dry = dryRun({ run: only, isPro: true });
  assert.equal(dry.startLabel, 'Start the 6-minute lesson');
  assert.equal(dry.shrink, null);
  assert.deepEqual(dry.piles.map((p) => [p.id, p.minutesLabel]), [['lesson', '6 min']]);
  // The next unread lesson is the one handed in (the service picks the first unread, Vocabulary's lesson 2 after lesson 1).
  const second = composeRun({ kind: 'mix', minutes: 10, cards: [], now: NOW, questions: [], lesson: { id: 'v2', title: 'How people respond', minutes: 5, read: false } });
  assert.equal(second.items[0].lessonId, 'v2');
  assert.equal(composeRun({ kind: 'feed', minutes: 10, cards: [], now: NOW, questions: [], lesson: passage }).items.length, 0, 'a feed never plays a lesson');
});

test('leaveOut: piles are respected, the time re-balances, and the last pile cannot be left out', () => {
  const { states, mistakes } = returning(PF);
  const base = { kind: 'mix', minutes: 10, cards: PF.cards, states, now: NOW, questions: PF.questions, mistakes };
  const noQ = composeRun({ ...base, leaveOut: ['questions'] });
  assert.equal(noQ.items.filter((i) => i.origin === 'linked' || i.origin === 'chapter').length, 0);
  assert.equal(noQ.piles.mistakes.count, 3, 'with Questions left out, the mistakes take the question side');
  assert.equal(noQ.shrunk, false);
  const cardsOnly = composeRun({ ...base, leaveOut: ['questions', 'mistakes'] });
  assert.ok(cardsOnly.items.every((i) => i.type === 'card'));
  assert.ok(Math.abs(cardsOnly.seconds - budgetSeconds(10)) <= 13, `${cardsOnly.seconds}`);
  const noCards = composeRun({ ...base, leaveOut: ['cards'] });
  assert.ok(noCards.items.every((i) => i.type === 'question'));
  const all = composeRun({ ...base, leaveOut: ['cards', 'questions', 'mistakes', 'lesson'] });
  assert.deepEqual(all.leaveOut.sort(), ['lesson', 'mistakes', 'questions']);
  assert.equal(all.kept, 'cards');
  assert.ok(all.items.length > 0);
  assert.deepEqual(effectiveLeaveOut(['questions', 'nonsense'], { cards: true, questions: true }), { leaveOut: ['questions'], kept: null });
  assert.deepEqual(effectiveLeaveOut(['questions'], { cards: false, questions: true }), { leaveOut: [], kept: 'questions' });
});

test('Free: only the open cards, looks past the day\'s ratings (in the order shown), questions free; honest shrink with the next chapter', () => {
  const open = free(PF);
  const run = composeRun({ kind: 'mix', minutes: 10, leaveOut: ['questions'], cards: open, states: new Map(), now: NOW, questions: PF.questions, mistakes: [], ratingsLeft: 2, newLeft: 5 });
  const cards = run.items.filter((i) => i.type === 'card');
  assert.equal(cards.length, 5);
  assert.ok(cards.every((c) => open.some((o) => o.id === c.cardId)));
  assert.deepEqual(cards.map((c) => c.look), [false, false, true, true, true]);
  assert.deepEqual(cards.map((c) => c.seconds), cards.map((c) => (c.look ? 10 : 18) + (cardWords(open.find((o) => o.id === c.cardId)) > 60 ? 8 : 0)));
  assert.equal(run.shrunk, true);
  const dry = dryRun({ run, isPro: false, ratingsLeft: 2, chapter: { total: 46, open: 5 }, nextChapter: { key: 'accountancy.profit-and-loss-appropriation-account', title: 'Profit and Loss Appropriation Account' } });
  assert.equal(dry.startLabel, `Start ${run.realMinutes} ${run.realMinutes === 1 ? 'minute' : 'minutes'}`);
  assert.equal(dry.shrink.reason, 'pool');
  assert.equal(dry.shrink.addNext.key, 'accountancy.profit-and-loss-appropriation-account');
  assert.equal(dry.free.text, "Free opens 5 of this chapter's 46 cards.");
  const used = composeRun({ kind: 'mix', minutes: 10, cards: open, states: new Map(), now: NOW, questions: PF.questions, mistakes: [], ratingsLeft: 0, newLeft: 5 });
  assert.ok(used.items.filter((i) => i.type === 'card').every((c) => c.look));
  assert.match(dryRun({ run: used, isPro: false, ratingsLeft: 0, chapter: { total: 46, open: 5 } }).free.text, /used today's 10 free card ratings/);
  const withStubs = composeRun({ kind: 'mix', minutes: 10, cards: [...open, { id: 'x', locked: true }], states: new Map(), now: NOW, questions: [], mistakes: [] });
  assert.ok(!withStubs.items.some((i) => i.cardId === 'x'));
});

test('the dry run: piles in order with their labels; their minutes add up to the run\'s length (largest remainder)', () => {
  const { states, mistakes } = returning(AOP);
  const run = composeRun({ kind: 'mix', minutes: 20, cards: AOP.cards, states, now: NOW, questions: AOP.questions, mistakes, lesson });
  const recapRun = composeRun({ kind: 'recap', cards: AOP.cards, states, now: NOW });
  const dry = dryRun({ run, recapRun, isPro: true, chapter: { total: AOP.cards.length, open: AOP.cards.length } });
  assert.deepEqual(dry.piles.map((p) => p.id), ['cards', 'questions', 'mistakes', 'lesson']);
  assert.deepEqual(dry.piles.map((p) => p.label), ['Key cards', 'Questions', 'Your mistakes', 'Lesson']);
  assert.equal(dry.piles.reduce((s, p) => s + p.minutes, 0), 20, 'the piles add up to the length');
  assert.equal(dry.piles[3].minutesLabel, '7 min');
  assert.equal(dry.startLabel, 'Start 20 minutes');
  assert.equal(dry.note, NOTE);
  const must = AOP.cards.filter((c) => c.importance === 'must').length;
  assert.equal(dry.recap.label, `Or a quick recap: the ${must} Must-know lines, about ${recapRun.realMinutes} min`);
  assert.equal(dry.coach, 'Tap a pile to leave it out.');
  assert.equal(dry.shrink, null);
  for (const minutes of [5, 10, 20]) {
    const r = composeRun({ kind: 'mix', minutes, cards: PF.cards, states, now: NOW, questions: PF.questions, mistakes: returning(PF).mistakes });
    const d = dryRun({ run: r, isPro: true });
    assert.equal(d.piles.reduce((s, p) => s + p.minutes, 0), minutes, `${minutes}: piles add up`);
    assert.ok(d.piles.every((p) => p.count === 0 || p.minutes >= 1));
  }
  const left = dryRun({ run: composeRun({ kind: 'mix', minutes: 10, cards: AOP.cards, states, now: NOW, questions: AOP.questions, mistakes, leaveOut: ['questions'] }), isPro: true });
  const q = left.piles.find((p) => p.id === 'questions');
  assert.deepEqual([q.left, q.count, q.minutesLabel], [true, 0, 'Left out']);
  for (const p of [...dry.piles, ...left.piles]) assert.ok(!/·|!/.test(`${p.label} ${p.minutesLabel}`));
  assert.deepEqual(splitMinutes(10, [300, 200, 100]), [5, 3, 2]);
  assert.deepEqual(splitMinutes(9, [100, 100, 100]), [3, 3, 3]);
  assert.deepEqual(splitMinutes(3, [600, 10]), [2, 1], 'a pile with seconds gets a minute');
  assert.deepEqual(splitMinutes(0, [1, 2]), [0, 0]);
});

test('the mistakes pile says "2 of 3" when fewer than are open', () => {
  const { states, mistakes } = returning(PF);
  const run = composeRun({ kind: 'mix', minutes: 10, cards: PF.cards, states, now: NOW, questions: PF.questions, mistakes });
  const m = dryRun({ run, isPro: true }).piles.find((p) => p.id === 'mistakes');
  assert.deepEqual([m.count, m.of], [2, 3]);
  assert.equal(m.minutesLabel, `2 of 3, about ${m.minutes} min`);
});

test('quick recap: Must-know cards only, answers showing, 10 seconds each (18 for a long one), nothing else', () => {
  const run = composeRun({ kind: 'recap', minutes: 5, cards: PF.cards, states: new Map(), now: NOW, questions: PF.questions, mistakes: [{ id: PF.questions[0].id }] });
  const must = PF.cards.filter((c) => c.importance === 'must');
  assert.equal(run.items.length, must.length);
  assert.ok(run.items.every((i) => i.type === 'card' && i.recap && i.look && i.stage === 'recap'));
  assert.equal(run.seconds, must.reduce((s, c) => s + 10 + (cardWords(c) > 60 ? 8 : 0), 0));
  assert.equal(run.realMinutes, minutesFor(run.seconds));
});

test('caps: at most 40 new cards, 20 questions in a 20-minute block', () => {
  const cards = Array.from({ length: 200 }, (_, i) => ({ id: `c${i}`, order: i, importance: i % 4 ? 'good' : 'must' }));
  const questions = Array.from({ length: 80 }, (_, i) => ({ id: `q${i}`, difficulty: ['easy', 'medium', 'hard'][i % 3], cards: [], seen: false }));
  const cardsOnly = composeRun({ kind: 'cards', minutes: 60, cards, now: NOW });
  assert.equal(cardsOnly.items.length, 40);
  assert.equal(cardsOnly.shrunk, true);
  const qOnly = composeRun({ kind: 'mix', minutes: 20, cards: [], now: NOW, questions });
  const B = budgetSeconds(20);
  assert.ok(Math.abs(qOnly.seconds - B) <= 45, `${qOnly.seconds} near ${B}`);
  const long = composeRun({ kind: 'mix', minutes: 60, cards: [], now: NOW, questions });
  assert.ok(long.items.length <= 60);
  // New cards: Must-know first chosen, shown in book order.
  const five = composeRun({ kind: 'cards', minutes: 5, cards, now: NOW }).items.map((i) => i.cardId);
  assert.ok(five.every((id) => Number(id.slice(1)) % 4 === 0), 'the Must-know cards are chosen first');
  assert.deepEqual(five, [...five].sort((a, b) => Number(a.slice(1)) - Number(b.slice(1))), 'shown in book order');
});

test('question picks: unseen first, then easy 40, medium 40, hard 20; short stems first', () => {
  const pool = [
    ...Array.from({ length: 5 }, (_, i) => ({ id: `e${i}`, difficulty: 'easy', seen: false })),
    ...Array.from({ length: 5 }, (_, i) => ({ id: `m${i}`, difficulty: 'medium', seen: false })),
    ...Array.from({ length: 5 }, (_, i) => ({ id: `h${i}`, difficulty: 'hard', seen: false })),
    { id: 'seen-easy', difficulty: 'easy', seen: true },
  ];
  const five = pickQuestions(pool, 5);
  assert.deepEqual(five.map((q) => q.difficulty).sort(), ['easy', 'easy', 'hard', 'medium', 'medium']);
  assert.ok(!five.some((q) => q.seen));
  assert.equal(pickQuestions(pool, 16).length, 16);
  assert.deepEqual(pickQuestions([{ id: 'a', difficulty: 'medium', words: 120 }, { id: 'b', difficulty: 'medium', words: 20 }], 1).map((q) => q.id), ['b']);
});

test('level: up to 6 questions, 55 s each ("about 6 minutes"), the easiest last; an explicit card set ignores the length', () => {
  const run = composeRun({ kind: 'level', minutes: 6, questions: PF.questions, now: NOW });
  assert.equal(run.items.length, 6);
  assert.equal(run.items[run.items.length - 1].difficulty, 'easy');
  assert.equal(run.realMinutes, 6);
  const set = PF.cards.slice(0, 12).map((c) => c.id);
  assert.equal(composeRun({ kind: 'cards', minutes: 1, cardIds: set, cards: PF.cards, now: NOW }).items.length, 12);
  assert.equal(composeRun({ kind: 'recap', cardIds: set, cards: PF.cards, now: NOW }).items.length, 12);
});

test('E3: a long mistake (over 60 words) never plays early: short mistakes first, a long one second-last, its cards out', () => {
  const long = PF.questions.filter(isLong);
  const short = PF.questions.filter((q) => !isLong(q));
  assert.ok(long.length >= 2 && short.length >= 2, 'the fixture has both');
  for (const minutes of [5, 10, 20]) {
    const mistakes = long.slice(0, 3).map((q) => ({ id: q.id, where: 'Mock 3', when: '16 Oct' }));
    const run = composeRun({ kind: 'mix', minutes, cards: PF.cards, states: new Map(), now: NOW, questions: PF.questions, mistakes });
    const at = run.items.map((x, i) => (x.origin === 'mistake' ? i : -1)).filter((i) => i >= 0);
    assert.ok(at.length >= 1);
    for (const i of at) assert.ok(i >= Math.min(LEARN_RULES.lateFrom - 1, run.items.length - 2), `${minutes} min: a long mistake at item ${i + 1}`);
    assert.equal(run.items[run.items.length - 1].type, 'question');
    assert.notEqual(run.items[run.items.length - 1].origin, 'mistake');
    assert.deepEqual(orderProblems(run.items), [], `${minutes} min keeps every A3 rule`);
    const links = new Set(run.items.filter((x) => x.origin === 'mistake').flatMap((x) => x.links));
    assert.ok(run.items.filter((x) => x.type === 'card').every((x) => !links.has(x.cardId)), 'the cards that answer it stay out');
  }
  const mixed = [long[0], short[0]].map((q) => ({ id: q.id, where: 'Mock 3', when: '16 Oct' }));
  const run = composeRun({ kind: 'mix', minutes: 5, cards: PF.cards, states: new Map(), now: NOW, questions: PF.questions, mistakes: mixed });
  assert.deepEqual(run.items.filter((x) => x.origin === 'mistake').map((x) => x.questionId), [short[0].id]);
});

test('one mistake label everywhere; a mistake with no paper says its day', () => {
  assert.equal(mistakeLabel('Mock 3', '16 Oct'), 'You missed this in Mock 3 on 16 Oct');
  assert.equal(mistakeLabel('Learn', null), 'You missed this in Learn');
  assert.equal(mistakeLabel(null, '16 Oct'), 'You missed this on 16 Oct');
  assert.equal(mistakeLabel(null, null), 'You missed this before');
  assert.deepEqual([pileMinutes(0), pileMinutes(75), pileMinutes(300)], [0, 1, 5]);
});

// ---------------------------------------------------------------- stamps (R10.1, R16)

test('stamps: the real return day in the student\'s words; "Due now" for a card due at or before now', () => {
  assert.equal(returnDay(NOW + 3 * DAY, NOW).stamp, 'Back Tue');
  assert.equal(returnDay(NOW + 1 * DAY, NOW).stamp, 'Back tomorrow');
  assert.equal(returnDay(NOW + 2 * 3_600_000, NOW).stamp, 'Back later today');
  assert.equal(returnDay(NOW + 12 * DAY, NOW).stamp, 'Back in 12 days');
  assert.deepEqual(returnDay(NOW - DAY, NOW), { days: 0, stamp: 'Due now', group: 'due now' });
  assert.equal(returnDay(NOW, NOW).stamp, 'Due now');
  assert.equal(IN_RUN, 'Back later in this session');
  const groups = revisePileGroups([NOW + 3 * DAY, NOW + 3 * DAY, NOW + 6 * DAY, NOW + 3_600_000], NOW);
  assert.deepEqual(groups, [{ label: 'later today', count: 1 }, { label: 'back on Tue', count: 2 }, { label: 'back on Fri', count: 1 }]);
  assert.equal(revisePileLine(groups), '1 later today, 2 back on Tue, 1 back on Fri');
  assert.equal(shortDate(Date.parse('2026-10-16T11:20:00+05:30')), '16 Oct');
});

test('R10.1 and R16: a mistake rests until the next India day; "today" only for today\'s run; no "moved" from Not started; the level\'s chapter', () => {
  const late = Date.parse('2026-11-01T23:50:00+05:30');
  const early = Date.parse('2026-11-02T00:10:00+05:30');
  assert.equal(retryReady(late, early), true, '11:50 pm and 12:10 am IST are two days');
  assert.equal(retryReady(early - 60_000, early), false);
  assert.equal(retryReady(null, early), false);
  assert.equal(doneLine(6, 16, early - 5 * 60_000, early), '6 of 16 done today');
  assert.equal(doneLine(6, 16, late, early), '6 of 16 done');
  const none = { key: 'none', label: 'Not started' };
  const thin = { key: 'thin', label: 'Too few answers' };
  const mid = { key: 'getting_there', label: 'Getting there' };
  assert.equal(movedLine('Goodwill', none, thin), null);
  assert.equal(movedLine('Goodwill', thin, thin), null);
  assert.equal(movedLine('Goodwill', thin, mid), 'Goodwill moved from Too few answers to Getting there.');
  const books = [{ key: 'a', title: 'A' }, { key: 'b', title: 'B' }, { key: 'c', title: 'C' }];
  const pick = levelPick([{ chapterKey: 'a', correct: true }, { chapterKey: 'a', correct: false }, { chapterKey: 'b', correct: false }, { chapterKey: 'c', correct: false }], books);
  assert.deepEqual(pick, { key: 'b', title: 'B', right: 0, of: 1 }, 'the lowest share right, ties in book order');
  assert.equal(levelPick([], books), null);
});

test('F4 5: feedCardPool dueLooks adds the due cards in Revise as held looks only when there is no fresh card', () => {
  const day = 86_400_000;
  const now = Date.parse('2026-11-02T12:00:00Z');
  const cards = ['a', 'b', 'c'].map((id, i) => ({ id, order: i, importance: 'must' }));
  const state = (id, due) => [id, { card_id: id, reps: 1, suspended: false, due_at: new Date(now + due * day).toISOString() }];
  const allDue = new Map([state('a', -2), state('b', -1), state('c', 3)]);
  assert.deepEqual(feedCardPool(cards, allDue, null, now).held.map((x) => x.card.id), ['c'], 'Pro: never a due card');
  assert.deepEqual(feedCardPool(cards, allDue, null, now, { dueLooks: true }).held.map((x) => x.card.id).sort(), ['a', 'b', 'c'], 'Free with no fresh card');
  const oneFresh = new Map([state('a', -2), state('b', -1)]);
  assert.deepEqual(feedCardPool(cards, oneFresh, null, now, { dueLooks: true }).held, [], 'a fresh card left: nothing due joins');
  const suspended = new Map([['a', { card_id: 'a', reps: 1, suspended: true, due_at: new Date(now - day).toISOString() }], state('b', -1), state('c', -1)]);
  assert.deepEqual(feedCardPool(cards, suspended, null, now, { dueLooks: true }).held.map((x) => x.card.id).sort(), ['b', 'c'], 'a suspended card stays out');
});
