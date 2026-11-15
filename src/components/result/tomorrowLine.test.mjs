// O5 (15 Nov 2026): the result's tomorrow line, from facts only. Three cases: mistakes coming back in Revise (on the true
// day), a paper with no wrong answers and a free set tomorrow, and nothing at all when the facts are missing.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildLater, addDays, istDate } from '../../../data/revise.js';
import { tomorrowLine, dailySetTomorrow, needsDailyRead, readLater, TOMORROW_FREE_SET } from './tomorrowLine.mjs';

const NOW = Date.parse('2026-11-15T15:30:00Z'); // 9:00 PM in India
const question = (id) => ({ id, question: `Q ${id}`, options: ['a', 'b', 'c', 'd'], correctIndex: 0 });
const paper = (wrongIds, { at = NOW - 20 * 60_000 } = {}) => {
  const ids = ['q1', 'q2', 'q3', 'q4', 'q5', 'q6'];
  return {
    id: 'p1', completedAt: at, questionsSnapshot: ids.map(question),
    details: ids.map((qid) => (wrongIds.includes(qid) ? { qid, givenIndex: 1, isCorrect: false } : { qid, givenIndex: 0, isCorrect: true })),
  };
};

test('case 1: a set finished tonight with wrong answers names tomorrow, the count Revise will show and its minutes', () => {
  // The server's own block for a paper finished 20 minutes ago, with no cards read yet (its cards are due tomorrow).
  const later = buildLater({ attempt: paper(['q2', 'q5', 'q6']), cards: null, now: NOW });
  assert.equal(later.when, 'tomorrow');
  assert.equal(tomorrowLine({ later, wrong: 3 }), 'Tomorrow: these 3 mistakes come back in Revise. About 5 minutes.');
  const one = buildLater({ attempt: paper(['q4']), cards: null, now: NOW });
  assert.equal(tomorrowLine({ later: one, wrong: 1 }), 'Tomorrow: this mistake comes back in Revise. About 5 minutes.');
  // Revise's cap of 10 a day and its 40 seconds a card, rounded up to 5 minutes: 10 cards is about 10 minutes.
  assert.equal(tomorrowLine({ later: { state: 'scheduled', count: 10, total: 14, when: 'tomorrow', dayLabel: 'Mon 16 Nov' }, wrong: 14 }),
    'Tomorrow: these 10 mistakes come back in Revise. About 10 minutes.');
});

test('case 1, another day: the true day from the cards, or today when they are already due', () => {
  const today = istDate(NOW);
  const cards = new Map([['q2', { question_id: 'q2', box: 2, due_day: addDays(today, 3), state: 'active' }], ['q5', { question_id: 'q5', box: 2, due_day: addDays(today, 3), state: 'active' }]]);
  const later = buildLater({ attempt: paper(['q2', 'q5'], { at: NOW - 5 * 86_400_000 }), cards, now: NOW });
  assert.equal(later.when, 'day');
  assert.equal(tomorrowLine({ later, wrong: 2 }), `${later.dayLabel}: these 2 mistakes come back in Revise. About 5 minutes.`);
  assert.match(later.dayLabel, /^(Sun|Mon|Tue|Wed|Thu|Fri|Sat) \d{1,2} [A-Z][a-z]{2}$/);
  const dueNow = new Map([['q2', { question_id: 'q2', box: 1, due_day: today, state: 'active' }]]);
  const now = buildLater({ attempt: paper(['q2'], { at: NOW - 2 * 86_400_000 }), cards: dueNow, now: NOW });
  assert.equal(tomorrowLine({ later: now, wrong: 1 }), 'Today: this mistake is due in Revise. About 5 minutes.');
});

test('case 2: no wrong answers on Free with the included set on: one free set tomorrow; never for Pro, never when unknown or off', () => {
  assert.equal(tomorrowLine({ later: null, wrong: 0, isPremium: false, dailyTomorrow: true }), TOMORROW_FREE_SET);
  assert.equal(TOMORROW_FREE_SET, 'Tomorrow: one free 10-question set is waiting.');
  assert.equal(tomorrowLine({ later: null, wrong: 0, isPremium: true, dailyTomorrow: true }), null);
  assert.equal(tomorrowLine({ later: null, wrong: 0, isPremium: false, dailyTomorrow: false }), null);
  assert.equal(tomorrowLine({ later: null, wrong: 0, isPremium: false, dailyTomorrow: null }), null);
  // The allowance as the quote says it: used today or still available both mean a new one tomorrow; off (null) does not.
  assert.equal(dailySetTomorrow({ allowance: { kind: 'daily_practice', state: 'available' }, creditCost: 0 }), true);
  assert.equal(dailySetTomorrow({ allowance: { kind: 'daily_practice', state: 'used' }, creditCost: 10 }), true);
  assert.equal(dailySetTomorrow({ allowance: { kind: 'daily_practice', state: 'unknown' }, creditCost: 10 }), null);
  assert.equal(dailySetTomorrow({ allowance: null, creditCost: 10 }), false);
  assert.equal(dailySetTomorrow({ state: 'unavailable' }), null);
  assert.equal(dailySetTomorrow(null), null);
});

test('case 3: nothing when the facts are missing: no later block, a failed card read on an old paper, held keys, or a bad shape', () => {
  assert.equal(tomorrowLine({ later: null, wrong: 3 }), null, 'wrong answers but no later block (the Lab is not ready): say nothing');
  // An old paper with no cards read: the server says nothing, so the page says nothing.
  assert.equal(buildLater({ attempt: paper(['q2'], { at: NOW - 6 * 86_400_000 }), cards: null, now: NOW }), null);
  for (const bad of [{ state: 'scheduled', count: 0, when: 'tomorrow' }, { state: 'scheduled', count: 2, when: 'later' }, { state: 'scheduled', count: 2, when: 'day' }, { state: 'none' }, 'x']) {
    assert.equal(readLater(bad), null);
    assert.equal(tomorrowLine({ later: bad, wrong: 2, dailyTomorrow: true }), null);
  }
});

test('the quote is read only when it can matter: Free, no wrong answers, no Revise line', () => {
  assert.equal(needsDailyRead({ later: null, wrong: 0, isPremium: false }), true);
  assert.equal(needsDailyRead({ later: null, wrong: 0, isPremium: true }), false);
  assert.equal(needsDailyRead({ later: null, wrong: 2, isPremium: false }), false);
  assert.equal(needsDailyRead({ later: { state: 'scheduled', count: 1, when: 'tomorrow' }, wrong: 0 }), false);
});

test('the words follow the copy rules: sentence case, no exclamation, no arrows, real numbers with units', () => {
  const lines = [
    tomorrowLine({ later: { state: 'scheduled', count: 4, when: 'tomorrow' }, wrong: 4 }),
    tomorrowLine({ later: { state: 'scheduled', count: 1, when: 'day', dayLabel: 'Thu 19 Nov' }, wrong: 1 }),
    TOMORROW_FREE_SET,
  ];
  for (const line of lines) {
    assert.doesNotMatch(line, /!|→|->|—/);
    assert.match(line, /^[A-Z]/);
    assert.match(line, /\.$/);
  }
  assert.equal(lines[1], 'Thu 19 Nov: this mistake comes back in Revise. About 5 minutes.');
});
