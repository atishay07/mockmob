// The lesson map (data/study/lesson_map.mjs, LEARN-REVIEW-1017 packet P-LR0): the lesson for a mistake's concept or chapter,
// on catalog units shaped exactly as studyRecord() in src/lib/server/study.js returns them.
import test from 'node:test';
import assert from 'node:assert/strict';
import { LOCK_IN_MINUTES, lessonFor, lessonHref, lessonsForChapters, parseFrom } from '../study/lesson_map.mjs';

// The unit view of studyRecord(): { id, version, subject, chapter, conceptId, title, summary, estimatedMinutes, objectives, skill, order, read, inProgress, cardCount, memory, status }
const unit = (over) => ({
  id: 'u', version: 2, subject: 'accountancy', chapter: 'Admission of a partner', conceptId: null, title: 'Lesson', summary: 's', estimatedMinutes: 7, objectives: [], skill: 'Calculation', order: 10,
  read: false, inProgress: null, cardCount: 4, memory: { cards: 4, started: 0, reviewed: 0, due: 0, unseen: 4, nextDue: null }, status: 'new', ...over,
});
const catalog = [
  unit({ id: 'accountancy-goodwill', chapter: 'Admission of a partner', conceptId: 'goodwill', title: 'Goodwill and the new partner', order: 5 }),
  unit({ id: 'accountancy-sacrificing-gaining', chapter: 'Admission of a partner', conceptId: 'sacrificing_gaining', title: 'Sacrificing and gaining ratio', estimatedMinutes: 6, order: 10, read: true, status: 'due' }),
  unit({ id: 'accountancy-retirement', chapter: 'Retirement and death of a partner', title: 'Retirement of a partner', estimatedMinutes: 8, order: 20 }),
  unit({ id: 'business-fayol', subject: 'business_studies', chapter: 'Principles of management', title: 'Fayol and Taylor', estimatedMinutes: 8, order: 5 }),
];

test('a concept match wins over a chapter match; the chapter is the fallback; none is null ("No lesson yet")', () => {
  const byConcept = lessonFor({ subject: 'accountancy', chapter: 'Admission of a partner', conceptId: 'sacrificing_gaining' }, catalog);
  assert.equal(byConcept.id, 'accountancy-sacrificing-gaining');
  assert.equal(byConcept.basis, 'concept');
  const byChapter = lessonFor({ subject: 'accountancy', chapter: 'Retirement and death of a partner' }, catalog);
  assert.equal(byChapter.id, 'accountancy-retirement');
  assert.equal(byChapter.basis, 'chapter');
  assert.equal(lessonFor({ subject: 'accountancy', chapter: 'Cash flow statement' }, catalog), null);
  assert.equal(lessonFor({ subject: 'economics', chapter: 'Admission of a partner' }, catalog), null, 'another subject\'s lesson is never offered');
  assert.equal(lessonFor({}, catalog), null);
  assert.equal(lessonFor({ chapter: 'Admission of a partner' }, []), null);
  assert.equal(lessonFor({ chapter: 'Admission of a partner' }, null), null);
});

test('in a chapter with two lessons: finish a started one, then an unread one, then a read one, by the catalog order', () => {
  const ch = { subject: 'accountancy', chapter: 'Admission of a partner' };
  assert.equal(lessonFor(ch, catalog).id, 'accountancy-goodwill', 'the unread lesson comes before the read one');
  const started = catalog.map((u) => (u.id === 'accountancy-sacrificing-gaining' ? { ...u, inProgress: { runId: 'r', step: 2, total: 4 }, status: 'in_progress' } : u));
  assert.equal(lessonFor(ch, started).id, 'accountancy-sacrificing-gaining', 'a lesson in progress first');
  const allRead = catalog.map((u) => ({ ...u, read: true }));
  assert.equal(lessonFor(ch, allRead).id, 'accountancy-goodwill', 'then the first by order');
});

test('chapter names match without regard to case and spacing, never loosely', () => {
  assert.equal(lessonFor({ subject: 'Accountancy', chapter: '  admission  of a PARTNER ' }, catalog).id, 'accountancy-goodwill');
  assert.equal(lessonFor({ subject: 'accountancy', chapter: 'Admission' }, catalog), null);
});

test('the key reads Learn plus Lock it in: 7 + 2 = 9 minutes; a lesson already read starts at Lock it in', () => {
  const goodwill = lessonFor({ subject: 'accountancy', chapter: 'Admission of a partner', conceptId: 'goodwill' }, catalog);
  assert.equal(LOCK_IN_MINUTES, 2);
  assert.deepEqual([goodwill.minutes, goodwill.lockInMinutes, goodwill.startMinutes, goodwill.cards, goodwill.read], [7, 2, 9, 4, false]);
  const read = lessonFor({ subject: 'accountancy', conceptId: 'sacrificing_gaining', chapter: 'Admission of a partner' }, catalog);
  assert.deepEqual([read.minutes, read.startMinutes, read.read], [6, 2, true]);
  const none = lessonFor({ subject: 'accountancy', chapter: 'Retirement and death of a partner' }, [unit({ chapter: 'Retirement and death of a partner', estimatedMinutes: null })]);
  assert.equal(none.startMinutes, null, 'no minutes in the catalog, no minutes claimed');
});

test('a list of chapters maps each to its lesson or to null, in the order given', () => {
  const map = lessonsForChapters('accountancy', [{ name: 'Admission of a partner' }, 'Retirement and death of a partner', { name: 'Cash flow statement' }], catalog);
  assert.deepEqual([...map.keys()], ['Admission of a partner', 'Retirement and death of a partner', 'Cash flow statement']);
  assert.deepEqual([...map.values()].map((l) => l?.id ?? null), ['accountancy-goodwill', 'accountancy-retirement', null]);
});

test('the link carries the moment it was opened from, and the lesson page reads it back', () => {
  const lesson = lessonFor({ subject: 'accountancy', chapter: 'Admission of a partner', conceptId: 'goodwill' }, catalog);
  assert.equal(lessonHref(lesson), '/learn/accountancy-goodwill');
  const q = lessonHref(lesson, { kind: 'q', attemptId: 'att-7f3', number: 42 });
  assert.equal(q, '/learn/accountancy-goodwill?from=q%3Aatt-7f3%3A42');
  assert.deepEqual(parseFrom(new URL(q, 'https://x.test').searchParams.get('from')), { kind: 'q', attemptId: 'att-7f3', number: 42 });
  const chapter = lessonHref(lesson, { kind: 'chapter', subject: 'accountancy', chapter: 'Cash flow: indirect & direct' });
  assert.deepEqual(parseFrom(new URL(chapter, 'https://x.test').searchParams.get('from')), { kind: 'chapter', subject: 'accountancy', chapter: 'Cash flow: indirect & direct' });
  assert.deepEqual(parseFrom('today'), { kind: 'today' });
  assert.equal(lessonHref(lesson, { kind: 'today' }), '/learn/accountancy-goodwill?from=today');
  assert.equal(lessonHref(null, { kind: 'today' }), null);
  for (const bad of [null, '', 'q:att:', 'q::4', 'q:a:b', 'chapter:accountancy:', 'chapter:a', 'x:1:2', 'q:att:1234']) assert.equal(parseFrom(bad), null, String(bad));
});
