// Chapter state (data/chapter_state.js, KEYCARDS-BUILD-SPEC.md 2d): states and thresholds, counting each question once by its
// latest answer, aliases and retired chapters, Pro-only detail, and the words it must never use.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { CHAPTER_RULES, STATE_LABELS, chapterStates, reasonLine, stateFor, tallyChapters } from '../chapter_state.js';
import { newSchedule, schedule } from '../keycards.js';
import { syllabusFrom } from '../../src/lib/server/keycardsSyllabus.js';

const DAY = 86_400_000;
const NOW = Date.parse('2026-11-01T12:00:00+05:30');
const fallback = syllabusFrom(null);
const resolve = (subject, name) => {
  // An alias the way syllabus v2 resolves it: an old name maps to the live chapter.
  if (subject === 'business_studies' && name === 'Business Finance') return fallback.resolveChapter(subject, 'Financial Management');
  return fallback.resolveChapter(subject, name);
};
const row = (i, chapter, correct, over = {}) => ({
  question_id: `q${i}`, subject: 'business_studies', chapter, attempt_count: 1, last_correct: correct,
  last_attempted_at: new Date(NOW - DAY).toISOString(), ...over,
});
const answers = (chapter, right, wrong, start = 0, over = {}) => [
  ...Array.from({ length: right }, (_, i) => row(start + i, chapter, true, over)),
  ...Array.from({ length: wrong }, (_, i) => row(start + right + i, chapter, false, over)),
];

test('the labels are exactly the spec\'s', () => {
  assert.deepEqual(STATE_LABELS, { none: 'Not started', thin: 'Too few answers', weak: 'Needs work', mid: 'Getting there', strong: 'Holding' });
});

test('states and thresholds: none, thin below 6, weak by the Wilson upper bound, strong by the lower bound, mid otherwise', () => {
  assert.equal(stateFor({ n: 0, right: 0, now: NOW }).state, 'none');
  assert.equal(stateFor({ n: 0, right: 0, memory: { added: 3, holding: 0 }, now: NOW }).state, 'thin', 'cards added but nothing answered is not "Not started"');
  assert.equal(stateFor({ n: 5, right: 5, now: NOW }).state, 'thin');
  assert.equal(stateFor({ n: 6, right: 0, now: NOW }).state, 'weak');
  assert.equal(stateFor({ n: 20, right: 6, now: NOW }).state, 'weak'); // upper bound 0.52
  assert.equal(stateFor({ n: 20, right: 10, now: NOW }).state, 'mid');
  assert.equal(stateFor({ n: 6, right: 6, now: NOW }).state, 'mid', 'six right of six is not yet Holding (Wilson lower 0.61)');
  assert.equal(stateFor({ n: 12, right: 12, lastActivityAt: NOW, now: NOW }).state, 'strong');
  assert.equal(stateFor({ n: 30, right: 25, lastActivityAt: NOW, now: NOW }).state, 'strong');
  assert.equal(CHAPTER_RULES.minAnswers, 6);
});

test('fading: Holding with nothing answered or reviewed for 21 days, or under half the added Must-know cards holding', () => {
  const fresh = { n: 12, right: 12, now: NOW };
  assert.equal(stateFor({ ...fresh, lastActivityAt: NOW - 20 * DAY }).fading, false);
  assert.equal(stateFor({ ...fresh, lastActivityAt: NOW - 21 * DAY }).fading, true);
  assert.equal(stateFor({ ...fresh, lastActivityAt: null }).fading, true);
  assert.equal(stateFor({ ...fresh, lastActivityAt: NOW, memory: { added: 10, holding: 4 } }).fading, true);
  assert.equal(stateFor({ ...fresh, lastActivityAt: NOW, memory: { added: 10, holding: 5 } }).fading, false);
  assert.equal(stateFor({ n: 20, right: 10, lastActivityAt: null, now: NOW }).fading, false, 'only Holding can fade');
});

test('each question counts once by its latest answer; never-answered rows, retired and unknown chapters are skipped; aliases resolve', () => {
  const progress = [
    row(1, 'Planning', false, { last_attempted_at: new Date(NOW - 5 * DAY).toISOString() }),
    row(1, 'Planning', true, { last_attempted_at: new Date(NOW - DAY).toISOString() }), // the same question again: latest wins
    row(2, 'Planning', false, { attempt_count: 0 }), // seen, never answered
    row(3, 'Planning', null), // no right or wrong recorded
    row(4, 'Entrepreneurship Development', true), // retired (an old coverage unit)
    row(5, 'Not A Chapter', true),
    row(6, 'Business Finance', false), // alias of Financial Management
    row(7, 'Financial Management', true),
  ];
  const t = tallyChapters(progress, resolve);
  assert.deepEqual(t.get('business_studies.planning'), { n: 1, right: 1, lastAt: NOW - DAY });
  assert.equal(t.get('business_studies.financial-management').n, 2);
  assert.equal(t.get('business_studies.financial-management').right, 1);
  assert.equal(t.has('business_studies.entrepreneurship-development'), false);
  assert.equal([...t.keys()].length, 2);
});

test('repeats cannot inflate a chapter: answering one question ten times is still one answer', () => {
  const progress = Array.from({ length: 10 }, (_, i) => row(1, 'Staffing', true, { attempt_count: 10, last_attempted_at: new Date(NOW - i * 1000).toISOString() }));
  assert.equal(tallyChapters(progress, resolve).get('business_studies.staffing').n, 1);
  assert.equal(stateFor({ n: 1, right: 1, now: NOW }).state, 'thin');
});

test('chapterStates: the units and chapters in order; n, right, reason and memory for Pro only; marks lost and availability', () => {
  const units = fallback.unitsFor('business_studies');
  const progress = [...answers('Planning', 12, 0), ...answers('Staffing', 2, 10, 100)];
  const cards = [
    { id: 'kc.business_studies.planning.def-a', chapterKey: 'business_studies.planning', importance: 'must' },
    { id: 'kc.business_studies.planning.def-b', chapterKey: 'business_studies.planning', importance: 'must' },
  ];
  const reviewed = schedule(null, 4, NOW - DAY);
  const cardStates = [
    { card_id: cards[0].id, reps: 1, schedule: reviewed.schedule, last_review_at: new Date(NOW - DAY).toISOString() },
    { card_id: cards[1].id, reps: 0, schedule: newSchedule(NOW) },
  ];
  const args = {
    units, progress, resolveChapter: resolve, cardStates, cardsByChapter: new Map([['business_studies.planning', cards]]),
    marksLost: new Map([['business_studies.staffing', 60]]), available: new Map([['business_studies.planning', { questions: 140, cards: 2 }]]), now: NOW,
  };
  const free = chapterStates({ ...args, isPro: false });
  const pro = chapterStates({ ...args, isPro: true });
  assert.deepEqual(free.map((u) => u.unit), units.map((u) => u.unit));
  const find = (out, key) => out.flatMap((u) => u.chapters).find((c) => c.key === key);
  const planningFree = find(free, 'business_studies.planning');
  assert.equal(planningFree.state, 'strong');
  assert.equal(planningFree.label, 'Holding');
  assert.equal(planningFree.fading, false, 'one of two added Must-know cards holding is half, not under half');
  assert.deepEqual(Object.keys(planningFree).sort(), ['available', 'fading', 'key', 'label', 'marksLost', 'state', 'title']);
  assert.deepEqual(planningFree.available, { questions: 140, cards: 2 });
  const planningPro = find(pro, 'business_studies.planning');
  assert.equal(planningPro.n, 12);
  assert.equal(planningPro.right, 12);
  assert.equal(planningPro.reason, '12 of 12 right on the latest try at each question. Cards: 1 of 2 holding');
  assert.deepEqual(planningPro.memory, { holding: 1, added: 2, mustKnow: 2 });
  const staffing = find(pro, 'business_studies.staffing');
  assert.equal(staffing.state, 'weak');
  assert.equal(staffing.label, 'Needs work');
  assert.equal(staffing.marksLost, 60);
  assert.equal(find(free, 'business_studies.controlling').state, 'none');
  assert.equal(find(free, 'business_studies.controlling').marksLost, 0);
});

test('the reason line never shows a percent and the module never says mastered, mastery or marks to recover', () => {
  assert.equal(reasonLine({ n: 3, right: 2 }), '2 of 3 right on the latest try at each question');
  assert.equal(reasonLine({ n: 0, right: 0, memory: { added: 4, holding: 3 } }), 'Cards: 3 of 4 holding');
  assert.equal(reasonLine({ n: 0, right: 0 }), null);
  for (const n of [1, 5, 6, 12, 40]) for (let r = 0; r <= n; r += 1) assert.doesNotMatch(String(reasonLine({ n, right: r })), /%|percent/i);
  const files = ['data/chapter_state.js', 'data/keycards.js', 'src/lib/server/keycards.js'];
  for (const f of files) {
    const src = readFileSync(new URL(`../../${f}`, import.meta.url), 'utf8').split('\n').filter((l) => !/^\s*(\/\/|\*)/.test(l)).join('\n');
    assert.doesNotMatch(src, /mastered|mastery|marks (you could )?(to )?recover/i, f);
  }
});
