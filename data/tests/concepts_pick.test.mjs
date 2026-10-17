// Concepts and Practice's Concepts panel (LEARN-REVIEW-1017 5.9, 5.11, packet P-LR3): data/study/concepts_pick.mjs run over the
// real pilot lesson catalog and the design student's review record (data/tests/fixtures/review/student.json), so every number the
// page prints is one the fixture derives. Nothing in the expectations is typed from a mock; the sums are checked against the record.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { conceptsPick, loseMarks, allChapters, searchConcepts, recordLine, lessonRow, practicePanel, subjectId } from '../study/concepts_pick.mjs';
import { conceptsReview, SYLLABUS_NAMES } from '../study/preview_review.mjs';
import { parseFrom } from '../study/lesson_map.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const json = (p) => JSON.parse(readFileSync(resolve(here, p), 'utf8'));
const pilot = json('../study/pilot.json');
const fixtures = { student: json('fixtures/review/student.json'), empty: json('fixtures/review/empty.json'), down: json('fixtures/review/record_down.json') };
const review = (kind) => conceptsReview(fixtures, kind).body;

const cardCount = (id) => pilot.cards.filter((c) => c.unitId === id).length;
const unitsOf = (overrides = {}) => pilot.units.map((u) => ({ ...u, blocks: undefined, read: false, inProgress: null, status: 'new', cardCount: cardCount(u.id), memory: { due: 0 }, ...(overrides[u.id] || {}) }));
function catalogOf(overrides = {}, extra = {}) {
  const units = unitsOf(overrides);
  const next = units.find((u) => !u.read && u.subject === 'english') || units[0];
  return { state: 'ready', subjects: pilot.syllabus, units, active: null, nextUnit: { id: next.id, title: next.title, subject: next.subject, chapter: next.chapter, reason: next.summary }, progress: { lessonsRead: units.filter((u) => u.read).length, lessonsAvailable: units.length, cardsStarted: 8, recallReviews: 23 }, queue: { dueCount: 0 }, ...extra };
}

test('subject ids and names read the same: business_studies is Business Studies', () => {
  assert.equal(subjectId('Business Studies'), 'business_studies');
  assert.equal(subjectId('business_studies'), 'business_studies');
  assert.equal(subjectId('Accountancy'), 'accountancy');
  assert.equal(subjectId('Physics'), null);
});

test('on the design student the panel is the lesson for the costliest chapter, priced as Learn plus Lock it in', () => {
  const r = review('student');
  const pick = conceptsPick({ catalog: catalogOf(), review: r });
  assert.equal(pick.kind, 'mistakes');
  assert.equal(pick.unit.id, 'accountancy-revaluation');
  assert.equal(pick.chapter, 'Admission of Partner');
  const adm = r.chapters.find((c) => c.name === 'Admission of Partner');
  assert.equal(adm.openWrong, 5);
  assert.equal(pick.reason, '5 of your open mistakes are in its chapter, Admission of Partner.');
  assert.equal(pick.lead, 'Read this next.');
  assert.equal(pick.key, 'Start the lesson, 9 minutes', '7 minutes of Learn plus 2 of Lock it in');
  assert.equal(pick.cost, `Free. Its ${cardCount('accountancy-revaluation')} cards then join Revise, where 8 are due today.`);
  assert.deepEqual(pick.run, { mode: 'learn', unitId: 'accountancy-revaluation' });
  assert.deepEqual(parseFrom(new URL(pick.href, 'https://x.test').searchParams.get('from')), { kind: 'chapter', subject: 'accountancy', chapter: 'Admission of Partner' });
});

test('an unfinished lesson comes first, then mistakes, then the catalog next, then practise; due cards never take the panel', () => {
  const r = review('student');
  const finishing = conceptsPick({ catalog: catalogOf({}, { active: { id: 'run1', mode: 'learn', title: 'Planning', step: 3, total: 5, unitId: 'business-studies-plan-types' } }), review: r });
  assert.deepEqual([finishing.kind, finishing.key, finishing.href], ['finish', 'Finish the lesson, step 3 of 5', '/study/run1']);
  assert.equal(finishing.reason, 'You stopped at step 3 of 5. Everything before it is saved.');
  // Every lesson of every costly chapter read: the catalog's own next lesson.
  const readAll = Object.fromEntries(pilot.units.map((u) => [u.id, { read: true, status: 'learned' }]));
  const next = conceptsPick({ catalog: catalogOf({ ...readAll, 'english-vocabulary-02': { read: false, status: 'new' } }, { nextUnit: { id: 'english-vocabulary-02' } }), review: r });
  assert.equal(next.kind, 'next');
  assert.equal(next.lead, 'Read this next.');
  // No record: the catalog's lesson, and the cost line has no Revise count it cannot know.
  const none = conceptsPick({ catalog: catalogOf(), review: review('empty') });
  assert.equal(none.kind, 'next');
  assert.match(none.cost, /^Free\. Its \d+ cards then join Revise\.$/);
  assert.equal(none.lead, 'Start here.', 'a student who has read nothing is told where to start');
  // A read of the record that failed is not a record: the page still has its lesson.
  assert.equal(conceptsPick({ catalog: catalogOf(), review: review('down') }).kind, 'next');
  // Nothing left to read.
  const done = conceptsPick({ catalog: catalogOf(readAll, { nextUnit: null }), review: r });
  assert.deepEqual([done.kind, done.key, done.href], ['practise', 'Practise questions', '/dashboard']);
  const due = conceptsPick({ catalog: catalogOf({}, { queue: { dueCount: 12 } }), review: review('empty') });
  assert.notEqual(due.kind, 'recall');
});

test('a lesson in progress for the costly chapter is offered before an unread one', () => {
  const r = review('student');
  const pick = conceptsPick({ catalog: catalogOf({ 'accountancy-revaluation': { status: 'in_progress', inProgress: { step: 2, total: 5 } } }), review: r });
  assert.equal(pick.unit.id, 'accountancy-revaluation');
});

test('Where you lose marks adds up to the record, chapter by chapter, with a lesson or "No lesson yet"', () => {
  const r = review('student');
  const units = unitsOf();
  const rows = ['english', 'accountancy', 'business_studies', 'economics'].flatMap((subject) => loseMarks({ review: r, units, subject }));
  assert.equal(rows.reduce((sum, row) => sum + row.marks, 0), r.counts.marks, 'the rows add up to the head of the Mistakes page');
  const accountancy = loseMarks({ review: r, units, subject: 'accountancy' });
  assert.deepEqual(accountancy.map((row) => row.marks), [...accountancy.map((row) => row.marks)].sort((a, b) => b - a), 'costliest first');
  const adm = accountancy.find((row) => row.name === 'Admission of Partner');
  assert.equal(adm.marks, 35);
  assert.equal(adm.meta, '5 open mistakes, 1 blank. 1 lesson');
  assert.deepEqual(adm.lessons.map((u) => u.id), ['accountancy-revaluation']);
  const ret = accountancy.find((row) => row.name === 'Retirement & Death of Partner');
  assert.match(ret.meta, /^4 open mistakes, 1 blank\. No lesson yet\. Practise the chapter$/);
  assert.deepEqual(loseMarks({ review: review('empty'), units, subject: 'accountancy' }), []);
  assert.deepEqual(loseMarks({ review: review('down'), units, subject: 'accountancy' }), []);
});

test('All chapters lists every chapter of the syllabus in order, with the same marks as Where you lose marks', () => {
  const r = review('student');
  const units = unitsOf({ 'accountancy-revaluation': { read: true, status: 'learned' } });
  const syllabus = pilot.syllabus.find((s) => s.subject === 'accountancy');
  const all = allChapters({ subject: 'accountancy', syllabus, units, review: r });
  assert.deepEqual(all.chapters.map((c) => c.name), syllabus.chapters.map((c) => c.title), 'every chapter, syllabus order');
  const lose = loseMarks({ review: r, units, subject: 'accountancy' });
  for (const row of lose) assert.equal(all.chapters.find((c) => c.name === row.name)?.marks, row.marks, `${row.name} has one price on both lists`);
  assert.equal(all.chapters.find((c) => c.name === 'Admission of Partner').meta, '1 lesson, 1 read');
  assert.equal(all.chapters.find((c) => c.name === 'Debentures').meta, 'No lesson yet. Practice ready');
  assert.equal(all.lessonCount, pilot.units.filter((u) => u.subject === 'accountancy').length);
  assert.match(all.head, new RegExp(`^${all.lessonCount} lessons? in ${all.taughtChapters} of ${syllabus.chapters.length}$`));
});

test('every renamed fixture chapter lands on a real syllabus chapter, so no cost is lost between the two lists', () => {
  const names = new Set(pilot.syllabus.flatMap((s) => s.chapters.map((c) => c.title)));
  for (const [id, name] of Object.entries(SYLLABUS_NAMES)) assert.ok(names.has(name), `${id} -> ${name}`);
});

test('a lesson row says what is true: new, in progress, read with cards due, with minutes or Read', () => {
  const [u] = unitsOf();
  assert.deepEqual([lessonRow(u).trailing, lessonRow(u).line.startsWith('New. ')], [`${u.estimatedMinutes} min`, true]);
  assert.match(lessonRow({ ...u, inProgress: { step: 2, total: 5 }, status: 'in_progress' }).line, /^In progress, step 2 of 5\. /);
  const read = lessonRow({ ...u, read: true, memory: { due: 2 } });
  assert.deepEqual([read.trailing, read.line], ['Read', '2 cards due in Revise today']);
  assert.equal(lessonRow({ ...u, read: true, memory: { due: 1 } }).line, '1 card due in Revise today');
});

test('search finds lessons and chapters without a lesson, across subjects, and nothing for one letter', () => {
  const units = unitsOf();
  assert.equal(searchConcepts('a', { units, subjects: pilot.syllabus }), null);
  const hit = searchConcepts('ratio', { units, subjects: pilot.syllabus });
  assert.ok(hit.lessons.some((u) => u.id === 'accountancy-sacrificing-gaining'));
  assert.ok(hit.lessons.some((u) => u.id === 'accountancy-liquidity-ratios'));
  const chapter = searchConcepts('debentures', { units, subjects: pilot.syllabus });
  assert.deepEqual([chapter.lessons.length, chapter.chapters.map((c) => c.name)], [0, ['Debentures']]);
});

test('the study record is one line from the catalog, and Practice names the same lesson with its open-mistake count', () => {
  assert.deepEqual(recordLine(catalogOf()), { read: 0, of: 21, cards: 8, recalled: 23, text: '0 of 21 lessons read, 8 cards in Revise, 23 cards recalled' });
  const panel = practicePanel({ catalog: catalogOf(), review: review('student') });
  const pick = conceptsPick({ catalog: catalogOf(), review: review('student') });
  assert.equal(panel.lesson, pick.unit.id, 'Practice and Concepts name one lesson');
  assert.equal(panel.title, `${pick.title}, 7 min`);
  assert.equal(panel.line, '5 of your open mistakes are in its chapter, Admission of Partner.');
  const library = practicePanel({ catalog: catalogOf(Object.fromEntries(pilot.units.map((u) => [u.id, { read: true }])), { nextUnit: null }), review: review('empty') });
  assert.deepEqual([library.kind, library.href], ['library', '/learn']);
});
