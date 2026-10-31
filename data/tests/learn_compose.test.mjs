// Learn v2 composer (data/learn/compose.js) and return-day stamps (data/learn/stamps.js), over real deck chapters and the
// real preview questions (data/fixtures/learn-preview-questions.json) plus small hand fixtures.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import {
  LEARN_RULES, NOTE, budgetSeconds, composeRun, dryRun, effectiveLeaveOut, minutesFor, mistakesFor, orderProblems, pickQuestions,
  isLong, mistakeLabel, pileMinutes,
} from '../learn/compose.js';
import { returnDay, revisePileGroups, revisePileLine, shortDate, IN_RUN } from '../learn/stamps.js';
import { schedule, tasteIds } from '../keycards.js';

const ROOT = process.cwd();
const json = (f) => JSON.parse(readFileSync(path.join(ROOT, f), 'utf8'));
const NOW = Date.parse('2026-10-31T10:00:00+05:30'); // a Saturday
const DAY = 86_400_000;
const FIX = json('data/fixtures/learn-preview-questions.json').questions;
const DECKS = Object.fromEntries(['accountancy', 'economics', 'biology'].map((s) => [s, json(`data/keycards/decks/${s}.json`).cards]));

function chapter(subject, key, chapterName) {
  const cards = DECKS[subject].filter((c) => c.chapterKey === key);
  const questions = FIX.filter((q) => q.subject === subject && q.chapter === chapterName).map((q) => ({ id: q.id, difficulty: q.difficulty, cards: q.cards, seen: false }));
  return { cards, questions };
}
const PF = chapter('accountancy', 'accountancy.partnership-fundamentals', 'Partnership Fundamentals');
const AOP = chapter('accountancy', 'accountancy.admission-of-partner', 'Admission of Partner');
const ECO = chapter('economics', 'economics.introduction-and-theory-of-consumer-behaviour', 'Introduction & Theory of Consumer Behaviour');
const BIO = chapter('biology', 'biology.molecular-basis-of-inheritance', 'Molecular Basis of Inheritance');
const byOrder = (a, b) => (a.order || 0) - (b.order || 0);

/** The returning student's PF: 3 Must-know cards reviewed 6 days ago (due), 3 open mistakes. */
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

test('the budget is minutes x 60 / 1.1, and minutes said back include the 10 percent', () => {
  assert.equal(Math.round(budgetSeconds(5)), 273);
  assert.equal(Math.round(budgetSeconds(10)), 545);
  assert.equal(Math.round(budgetSeconds(20)), 1091);
  assert.equal(minutesFor(540), 10);
  assert.equal(minutesFor(0), 0);
  assert.deepEqual([5, 10, 20, 35].map(mistakesFor), [1, 2, 3, 3]);
});

test('a returning Pro 10-minute mix: 45/55 split, 2 open mistakes, due cards first, nothing past the budget', () => {
  const { states, mistakes } = returning(PF);
  const run = composeRun({ kind: 'mix', minutes: 10, cards: PF.cards, states, now: NOW, questions: PF.questions, mistakes });
  const B = budgetSeconds(10);
  assert.ok(run.seconds <= B + 1e-6, `${run.seconds} > ${B}`);
  assert.ok(run.seconds >= B - LEARN_RULES.cardSeconds, 'the time is filled');
  assert.equal(run.piles.mistakes.count, 2);
  assert.equal(run.piles.cards.count, 16);
  assert.equal(run.piles.questions.count, 3);
  const cardSecs = run.piles.cards.seconds;
  assert.ok(Math.abs(cardSecs / B - 0.45) < 0.03, `cards share ${cardSecs / B}`);
  const cards = run.items.filter((i) => i.type === 'card');
  assert.deepEqual(cards.slice(0, 3).map((c) => c.stage).sort(), ['due', 'due', 'due'].sort());
  assert.ok(cards.filter((c) => c.stage === 'due').length === 3);
  assert.equal(run.shrunk, false);
});

test('5, 10 and 20 minutes retry 1, 2 and 3 open mistakes', () => {
  const { states, mistakes } = returning(PF);
  for (const [m, n] of [[5, 1], [10, 2], [20, 3]]) {
    const run = composeRun({ kind: 'mix', minutes: m, cards: PF.cards, states, now: NOW, questions: PF.questions, mistakes });
    assert.equal(run.items.filter((i) => i.origin === 'mistake').length, n, `${m} min`);
    assert.ok(run.items.filter((i) => i.origin === 'mistake').every((i) => i.mistake.where === 'Mock 3' && i.mistake.when === '16 Oct'));
  }
});

test('A3 order holds on every demo chapter, length and plan: card first, mistakes before their line, linked 3 to 6 after, easiest last', () => {
  const cases = [];
  for (const [name, ch] of [['PF', PF], ['AOP', AOP], ['ECO', ECO], ['BIO', BIO]]) {
    const { states, mistakes } = returning(ch);
    for (const minutes of [5, 10, 20]) {
      cases.push([`${name} pro ${minutes}`, { cards: ch.cards, states, mistakes, questions: ch.questions, minutes, lesson: name === 'AOP' ? lesson : null }]);
      const taste = tasteIds(ch.cards);
      cases.push([`${name} free ${minutes}`, { cards: ch.cards.filter((c) => taste.has(c.id)), states: new Map(), mistakes: [], questions: ch.questions, minutes, ratingsLeft: 10, newLeft: 5 }]);
    }
  }
  for (const [label, input] of cases) {
    const run = composeRun({ kind: 'mix', now: NOW, ...input });
    const problems = orderProblems(run.items);
    assert.deepEqual(problems, [], `${label}: ${JSON.stringify(problems)}`);
    const start = run.items[0]?.type === 'lesson' ? 1 : 0;
    assert.equal(run.items[start].type, 'card', `${label}: first item`);
    const plain = run.items.filter((i) => i.type === 'question' && i.origin !== 'mistake');
    if (plain.length) {
      const last = run.items[run.items.length - 1];
      assert.equal(last.type, 'question', `${label}: last item`);
      assert.equal(diffRank[last.difficulty], Math.min(...plain.map((q) => diffRank[q.difficulty])), `${label}: the last question is the easiest`);
    }
    // An open mistake comes before every card of this run it links to.
    run.items.forEach((it, i) => {
      if (it.origin !== 'mistake') return;
      const before = run.items.slice(0, i).filter((x) => x.type === 'card').map((x) => x.cardId);
      assert.ok(!it.links.some((id) => before.includes(id)), `${label}: mistake ${i} after its line`);
    });
  }
});

test('Pro returning runs keep linked questions 3 to 6 items after their card', () => {
  const { states, mistakes } = returning(PF);
  for (const minutes of [5, 10, 20]) {
    const run = composeRun({ kind: 'mix', minutes, cards: PF.cards, states, now: NOW, questions: PF.questions, mistakes });
    const cardAt = new Map();
    run.items.forEach((x, i) => { if (x.type === 'card' && !cardAt.has(x.cardId)) cardAt.set(x.cardId, i); });
    for (const [i, q] of run.items.entries()) {
      if (q.origin !== 'linked') continue;
      const before = q.links.map((id) => cardAt.get(id)).filter((j) => j !== undefined && j < i);
      const gap = i - Math.max(...before);
      assert.ok(gap >= 3 && gap <= 6, `${minutes} min: linked question at ${i} is ${gap} after its card`);
    }
  }
});

test('the lesson plays first only at 20 minutes and up, and only while unread', () => {
  const { states, mistakes } = returning(AOP);
  const at = (m, l = lesson) => composeRun({ kind: 'mix', minutes: m, cards: AOP.cards, states, now: NOW, questions: AOP.questions, mistakes, lesson: l });
  assert.equal(at(10).items.some((i) => i.type === 'lesson'), false);
  const twenty = at(20);
  assert.equal(twenty.items[0].type, 'lesson');
  assert.equal(twenty.items[1].type, 'card');
  assert.equal(twenty.piles.lesson.seconds, 420);
  assert.equal(at(20, { ...lesson, read: true }).items.some((i) => i.type === 'lesson'), false);
  assert.equal(composeRun({ kind: 'mix', minutes: 20, cards: AOP.cards, states, now: NOW, questions: AOP.questions, mistakes, lesson, leaveOut: ['lesson'] }).items.some((i) => i.type === 'lesson'), false);
});

test('leaveOut: piles are respected, the time re-balances, and the last pile cannot be left out', () => {
  const { states, mistakes } = returning(PF);
  const base = { kind: 'mix', minutes: 10, cards: PF.cards, states, now: NOW, questions: PF.questions, mistakes };
  const noQ = composeRun({ ...base, leaveOut: ['questions'] });
  assert.equal(noQ.items.filter((i) => i.origin === 'linked' || i.origin === 'chapter').length, 0);
  assert.equal(noQ.piles.mistakes.count, 3, 'with Questions left out, the mistakes take the question side');
  assert.ok(noQ.seconds >= budgetSeconds(10) - 15);
  const cardsOnly = composeRun({ ...base, leaveOut: ['questions', 'mistakes'] });
  assert.ok(cardsOnly.items.every((i) => i.type === 'card'));
  assert.equal(cardsOnly.piles.cards.count, Math.floor(budgetSeconds(10) / 15));
  const noCards = composeRun({ ...base, leaveOut: ['cards'] });
  assert.ok(noCards.items.every((i) => i.type === 'question'));
  const all = composeRun({ ...base, leaveOut: ['cards', 'questions', 'mistakes', 'lesson'] });
  assert.deepEqual(all.leaveOut.sort(), ['lesson', 'mistakes', 'questions']);
  assert.equal(all.kept, 'cards');
  assert.ok(all.items.length > 0);
  assert.deepEqual(effectiveLeaveOut(['questions', 'nonsense'], { cards: true, questions: true }), { leaveOut: ['questions'], kept: null });
  assert.deepEqual(effectiveLeaveOut(['questions'], { cards: false, questions: true }), { leaveOut: [], kept: 'questions' });
});

test('Free: only the open cards, looks past the day\'s ratings, questions free; honest shrink with the next chapter', () => {
  const taste = tasteIds(PF.cards);
  const open = PF.cards.filter((c) => taste.has(c.id));
  const run = composeRun({ kind: 'mix', minutes: 20, cards: open, states: new Map(), now: NOW, questions: PF.questions, mistakes: [], ratingsLeft: 2, newLeft: 5 });
  const cards = run.items.filter((i) => i.type === 'card');
  assert.equal(cards.length, 5);
  assert.ok(cards.every((c) => taste.has(c.cardId)));
  assert.deepEqual(cards.map((c) => c.look), [false, false, true, true, true]);
  assert.equal(run.shrunk, true);
  assert.equal(run.realMinutes, minutesFor(5 * 15 + 10 * 60));
  const dry = dryRun({ run, isPro: false, ratingsLeft: 2, chapter: { total: 46, open: 5 }, nextChapter: { key: 'accountancy.profit-and-loss-appropriation-account', title: 'Profit and Loss Appropriation Account' } });
  assert.equal(dry.startLabel, `Start ${run.realMinutes} minutes`);
  assert.equal(dry.shrink.text, `This chapter has enough for about ${run.realMinutes} minutes today.`);
  assert.equal(dry.shrink.addNext.key, 'accountancy.profit-and-loss-appropriation-account');
  assert.equal(dry.free.text, "Free opens 5 of this chapter's 46 cards.");
  const used = composeRun({ kind: 'mix', minutes: 10, cards: open, states: new Map(), now: NOW, questions: PF.questions, mistakes: [], ratingsLeft: 0, newLeft: 5 });
  assert.ok(used.items.filter((i) => i.type === 'card').every((c) => c.look));
  assert.match(dryRun({ run: used, isPro: false, ratingsLeft: 0, chapter: { total: 46, open: 5 } }).free.text, /10 free card ratings are used/);
  // Locked stubs never enter a run.
  const withStubs = composeRun({ kind: 'mix', minutes: 10, cards: [...open, { id: 'x', locked: true }], states: new Map(), now: NOW, questions: [], mistakes: [] });
  assert.ok(!withStubs.items.some((i) => i.cardId === 'x'));
});

test('the dry run: piles in order with their labels and minutes, the note and the recap line exactly as A1', () => {
  const { states, mistakes } = returning(AOP);
  const run = composeRun({ kind: 'mix', minutes: 20, cards: AOP.cards, states, now: NOW, questions: AOP.questions, mistakes, lesson });
  const recapRun = composeRun({ kind: 'recap', cards: AOP.cards, states, now: NOW });
  const dry = dryRun({ run, recapRun, isPro: true, chapter: { total: AOP.cards.length, open: AOP.cards.length } });
  assert.deepEqual(dry.piles.map((p) => p.id), ['cards', 'questions', 'mistakes', 'lesson']);
  assert.deepEqual(dry.piles.map((p) => p.label), ['Key cards', 'Questions', 'Your mistakes', 'Lesson']);
  for (const p of dry.piles) assert.equal(p.minutesLabel, p.id === 'lesson' ? '7 min' : `about ${p.minutes} min`);
  assert.equal(dry.piles[3].count, 1);
  assert.equal(dry.startLabel, 'Start 20 minutes');
  assert.equal(dry.note, NOTE);
  assert.equal(dry.note, 'Ratings join Revise. Questions are free.');
  const must = AOP.cards.filter((c) => c.importance === 'must').length;
  assert.equal(dry.recap.count, must);
  assert.equal(dry.recap.label, `Or a quick recap: the ${must} Must-know lines, about ${dry.recap.minutes} min`);
  assert.equal(dry.coach, 'Tap a pile to leave it out.');
  assert.equal(dry.shrink, null);
  const left = dryRun({ run: composeRun({ kind: 'mix', minutes: 10, cards: AOP.cards, states, now: NOW, questions: AOP.questions, mistakes, leaveOut: ['questions'] }), isPro: true });
  const q = left.piles.find((p) => p.id === 'questions');
  assert.deepEqual([q.left, q.count, q.minutesLabel], [true, 0, 'Left out']);
  for (const p of [...dry.piles, ...left.piles]) assert.ok(!/·|!/.test(`${p.label} ${p.minutesLabel}`));
});

test('quick recap: Must-know cards only, answers showing, 10 seconds each, nothing else', () => {
  const run = composeRun({ kind: 'recap', minutes: 5, cards: PF.cards, states: new Map(), now: NOW, questions: PF.questions, mistakes: [{ id: PF.questions[0].id }] });
  const must = PF.cards.filter((c) => c.importance === 'must');
  assert.equal(run.items.length, must.length);
  assert.ok(run.items.every((i) => i.type === 'card' && i.recap && i.look));
  assert.equal(run.seconds, must.length * 10);
  assert.equal(run.realMinutes, Math.round((must.length * 10 * 1.1) / 60));
});

test('caps: at most 40 new cards, 20 questions in a 20-minute block', () => {
  const cards = Array.from({ length: 200 }, (_, i) => ({ id: `c${i}`, order: i, importance: i % 4 ? 'good' : 'must' }));
  const questions = Array.from({ length: 80 }, (_, i) => ({ id: `q${i}`, difficulty: ['easy', 'medium', 'hard'][i % 3], cards: [], seen: false }));
  const cardsOnly = composeRun({ kind: 'cards', minutes: 60, cards, now: NOW });
  assert.equal(cardsOnly.items.length, 40);
  assert.equal(cardsOnly.shrunk, true);
  const qOnly = composeRun({ kind: 'mix', minutes: 20, cards: [], now: NOW, questions });
  assert.equal(qOnly.items.length, 18, '20 minutes hold 18 questions (1,091 s / 60)');
  const long = composeRun({ kind: 'mix', minutes: 40, cards: [], now: NOW, questions });
  assert.ok(long.items.length <= 40);
  // New cards: Must-know first, then book order.
  const first = composeRun({ kind: 'cards', minutes: 5, cards, now: NOW }).items.map((i) => i.cardId);
  assert.deepEqual(first.slice(0, 3), ['c0', 'c4', 'c8']);
});

test('question picks: unseen first, then easy 40, medium 40, hard 20', () => {
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
});

test('level: up to 6 questions, a minute each, the easiest last; an explicit card set ignores the length', () => {
  const run = composeRun({ kind: 'level', minutes: 6, questions: PF.questions, now: NOW });
  assert.equal(run.items.length, 6);
  assert.equal(run.items[run.items.length - 1].difficulty, 'easy');
  const set = PF.cards.slice(0, 12).map((c) => c.id);
  const study = composeRun({ kind: 'cards', minutes: 1, cardIds: set, cards: PF.cards, now: NOW });
  assert.equal(study.items.length, 12);
  const recap = composeRun({ kind: 'recap', cardIds: set, cards: PF.cards, now: NOW });
  assert.equal(recap.items.length, 12);
});

test('stamps: the real return day in the student\'s words', () => {
  assert.equal(returnDay(NOW + 3 * DAY, NOW).stamp, 'Back Tue');
  assert.equal(returnDay(NOW + 1 * DAY, NOW).stamp, 'Back tomorrow');
  assert.equal(returnDay(NOW + 2 * 3_600_000, NOW).stamp, 'Back later today');
  assert.equal(returnDay(NOW + 12 * DAY, NOW).stamp, 'Back in 12 days');
  assert.equal(IN_RUN, 'Back later in this run');
  const groups = revisePileGroups([NOW + 3 * DAY, NOW + 3 * DAY, NOW + 6 * DAY, NOW + 3_600_000], NOW);
  assert.deepEqual(groups, [{ label: 'later today', count: 1 }, { label: 'back on Tue', count: 2 }, { label: 'back on Fri', count: 1 }]);
  assert.equal(revisePileLine(groups), '1 later today, 2 back on Tue, 1 back on Fri');
  assert.equal(shortDate(Date.parse('2026-10-16T11:20:00+05:30')), '16 Oct');
});

// ---------------------------------------------------------------- CRITIQUE-1 (E3, E5, R2, R7)

const words = (t) => String(t || '').split(/\s+/).filter(Boolean).length;
function withWords(subject, key, chapterName) {
  const ch = chapter(subject, key, chapterName);
  const body = new Map(FIX.map((q) => [q.id, q.body]));
  return { ...ch, questions: ch.questions.map((q) => ({ ...q, words: words(body.get(q.id)) })) };
}

test('E3: a long mistake (over 60 words) never plays early: short mistakes first, a long one second-last, its cards out', () => {
  const pf = withWords('accountancy', 'accountancy.partnership-fundamentals', 'Partnership Fundamentals');
  const long = pf.questions.filter(isLong);
  const short = pf.questions.filter((q) => !isLong(q));
  assert.ok(long.length >= 2 && short.length >= 2, 'the fixture has both');
  for (const minutes of [5, 10, 20]) {
    // Only long mistakes open: each retried one plays just before the final question, never before item 5.
    const mistakes = long.slice(0, 3).map((q) => ({ id: q.id, where: 'Mock 3', when: '16 Oct' }));
    const run = composeRun({ kind: 'mix', minutes, cards: pf.cards, states: new Map(), now: NOW, questions: pf.questions, mistakes });
    const at = run.items.map((x, i) => (x.origin === 'mistake' ? i : -1)).filter((i) => i >= 0);
    assert.ok(at.length >= 1);
    for (const i of at) assert.ok(i >= Math.min(LEARN_RULES.lateFrom - 1, run.items.length - 2), `${minutes} min: a long mistake at item ${i + 1}`);
    assert.equal(run.items[run.items.length - 1].type, 'question');
    assert.notEqual(run.items[run.items.length - 1].origin, 'mistake');
    assert.deepEqual(orderProblems(run.items), [], `${minutes} min keeps every A3 rule`);
    const links = new Set(run.items.filter((x) => x.origin === 'mistake').flatMap((x) => x.links));
    assert.ok(run.items.filter((x) => x.type === 'card').every((x) => !links.has(x.cardId)), 'the cards that answer it stay out');
  }
  // A long and a short one open, the long one older: the one retry at 5 minutes is the short one.
  const mixed = [long[0], short[0]].map((q) => ({ id: q.id, where: 'Mock 3', when: '16 Oct' }));
  const run = composeRun({ kind: 'mix', minutes: 5, cards: pf.cards, states: new Map(), now: NOW, questions: pf.questions, mistakes: mixed });
  const retried = run.items.filter((x) => x.origin === 'mistake').map((x) => x.questionId);
  assert.deepEqual(retried, [short[0].id]);
});

test('E3: among plain questions of one difficulty the short ones are picked first', () => {
  const pool = [{ id: 'a', difficulty: 'medium', words: 120 }, { id: 'b', difficulty: 'medium', words: 20 }];
  assert.deepEqual(pickQuestions(pool, 1).map((q) => q.id), ['b']);
});

test('E5: pile minutes are a minute a question; the mistakes pile says "2 of 3" when fewer than are open', () => {
  assert.deepEqual([pileMinutes(0), pileMinutes(75), pileMinutes(300), pileMinutes(240)], [0, 1, 5, 4]);
  const { states, mistakes } = returning(PF);
  const run = composeRun({ kind: 'mix', minutes: 10, cards: PF.cards, states, now: NOW, questions: PF.questions, mistakes });
  const dry = dryRun({ run, isPro: true });
  const m = dry.piles.find((p) => p.id === 'mistakes');
  assert.equal(mistakes.length, 3);
  assert.deepEqual([m.count, m.of, m.minutesLabel], [2, 3, '2 of 3, about 2 min']);
  const q = dry.piles.find((p) => p.id === 'questions');
  assert.equal(q.minutes, q.count, 'a minute a question');
});

test('R2 and R7: one mistake label everywhere; a recap card has no due stage', () => {
  assert.equal(mistakeLabel('Mock 3', '16 Oct'), 'You missed this in Mock 3 on 16 Oct');
  assert.equal(mistakeLabel('Learn', null), 'You missed this in Learn');
  const { states, mistakes } = returning(PF);
  const run = composeRun({ kind: 'mix', minutes: 10, cards: PF.cards, states, now: NOW, questions: PF.questions, mistakes });
  for (const x of run.items.filter((i) => i.origin === 'mistake')) assert.equal(x.mistake.label, 'You missed this in Mock 3 on 16 Oct');
  const recap = composeRun({ kind: 'recap', cards: PF.cards, states, now: NOW });
  assert.ok(recap.items.every((i) => i.stage === 'recap'));
});
