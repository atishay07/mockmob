// node --test src/components/learn2/chapter/chapterModel.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { FIRST_VISIT_LINE, ONLY_CARDS_LINE, chapterQuietLine, headLines, isChapterMissing, pileView, shelfView, withFlag } from './chapterModel.mjs';

test('the head: the unit only when it does not repeat the title; the ref "Part 1, Ch 2"', () => {
  assert.deepEqual(headLines({ title: 'Admission of a Partner', unitTitle: 'Reconstitution of a Partnership firm', partTitle: 'Part 1, Partnership Accounts', ref: 'Ch 2' }), { eyebrow: 'Reconstitution of a Partnership firm', ref: 'Part 1, Ch 2' });
  assert.deepEqual(headLines({ title: 'Goodwill: Nature and Valuation', unitTitle: 'Goodwill', partTitle: 'Part 1, Partnership Accounts', ref: 'Ch 3' }), { eyebrow: null, ref: 'Part 1, Ch 3' });
  assert.deepEqual(headLines({ title: 'Reading', unitTitle: null, partTitle: 'CUET English', ref: null }), { eyebrow: null, ref: 'CUET English' });
});

test('a pile: in, left out, held by Free, and "2 of 3" mistakes (A4 3.2.4)', () => {
  assert.equal(pileView({ id: 'cards', label: 'Key cards', count: 16, minutes: 4 }).line, 'about 4 min');
  assert.equal(pileView({ id: 'lesson', label: 'Lesson', count: 1, minutes: 7 }).line, '7 min');
  assert.equal(pileView({ id: 'questions', label: 'Questions', left: true }).line, 'Tap to put back');
  const held = pileView({ id: 'questions', label: 'Questions', left: true, held: true });
  assert.deepEqual([held.state, held.line], ['held', 'Back tomorrow']);
  const m = pileView({ id: 'mistakes', label: 'Your mistakes', count: 2, of: 3, minutes: 2 });
  assert.equal(m.of, 3);
  assert.match(m.aria, /Your mistakes: 2 of 3, about 2 min/);
});

test('the quiet line under Start, by priority; never the old Ratings note (A4 3.2.5)', () => {
  assert.equal(chapterQuietLine({ freeSession: { used: true }, free: { text: 'Your free Learn session today is used, so this one is Key cards only. Questions come back tomorrow.' }, capped: { text: 'Free sessions are up to 10 minutes. Pro has any length.' } }), 'Your free Learn session today is used, so this one is Key cards only. Questions come back tomorrow.');
  assert.equal(chapterQuietLine({ capped: { text: 'Free sessions are up to 10 minutes. Pro has any length.' }, shrink: { text: 'x' } }), 'Free sessions are up to 10 minutes. Pro has any length.');
  assert.equal(chapterQuietLine({ shrink: { text: 'This chapter has about 7 minutes of new things today.' } }), 'This chapter has about 7 minutes of new things today.');
  assert.equal(chapterQuietLine({ shelf: { cards: { count: 30 }, questions: { total: 0 } } }), ONLY_CARDS_LINE);
  assert.equal(chapterQuietLine({ firstVisit: true, shelf: { cards: { count: 3 }, questions: { total: 2 } } }), FIRST_VISIT_LINE);
  assert.equal(chapterQuietLine({ note: 'Ratings join Revise. Questions are free.', shelf: { cards: { count: 3 }, questions: { total: 2 } } }), null);
  // Free's taste is not a limit line here: it lives on the shelf.
  assert.equal(chapterQuietLine({ free: { text: "Free opens 5 of this chapter's 46 cards." }, shelf: { cards: { count: 46 }, questions: { total: 2 } } }), null);
});

test('"Everything in this chapter": rows that lead somewhere, the rest in one quiet line (A4 3.2.6)', () => {
  const pro = shelfView({ shelf: { cards: { count: 46, open: 46, inRevise: 12 }, questions: { total: 10 }, mistakes: { open: 3 }, lesson: null, print: { mustKnow: 12, locked: false } } }, { mistakeMinutes: (n) => n });
  assert.deepEqual(pro.rows.map((r) => [r.title, r.line]), [
    ['Key cards', 'All 46, 12 in Revise'], ['Questions only', '10 questions in this chapter'], ['Your mistakes', '3 open. Fix them in about 3 min'], ['Print sheet', '12 Must-know lines, with your name'],
  ]);
  assert.equal(pro.missing, 'No lesson yet.');
  const free = shelfView({ freeSession: { used: true }, shelf: { cards: { count: 46, open: 5 }, questions: { total: 0 }, mistakes: { open: 0 }, lesson: { id: 'l', title: 'Goodwill', minutes: 7, read: false }, print: { mustKnow: 12, locked: true } } });
  assert.deepEqual(free.rows.map((r) => [r.title, r.line, Boolean(r.link)]), [
    ['Key cards', '46 cards, Free opens 5', true], ['Goodwill', '7-minute lesson, not read yet', true], ['Print sheet', 'Part of Pro', true],
  ]);
  assert.equal(free.missing, 'Questions are still being checked. No open mistakes.');
});

test('a missing chapter and the run flags', () => {
  assert.equal(isChapterMissing({ kind: 'chapter_not_found' }), true);
  assert.equal(isChapterMissing({ status: 404, code: 'LEARN_OFF' }), false);
  assert.equal(isChapterMissing({ status: 503 }), false);
  assert.equal(withFlag('/learn/run?chapter=a&min=10', 'fresh', '1'), '/learn/run?chapter=a&min=10&fresh=1');
  assert.equal(withFlag('/learn/run', 'next', null), '/learn/run');
});
