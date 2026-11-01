// node --test src/components/learn2/chapter/chapterModel.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { FIRST_VISIT_LINE, ONLY_CARDS_LINE, chapterQuietLine, chapterVerdict, firstUpCards, headLines, isChapterMissing, pileView, recapLabel, shelfView, titleSize, withFlag } from './chapterModel.mjs';

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
  // R2 ruling 9: the first-visit line is gone; the run's own first card says how it works.
  assert.equal(chapterQuietLine({ firstVisit: true, shelf: { cards: { count: 3 }, questions: { total: 2 } } }), null);
  assert.notEqual(chapterQuietLine({ firstVisit: true }), FIRST_VISIT_LINE);
  assert.equal(chapterQuietLine({ note: 'Ratings join Revise. Questions are free.', shelf: { cards: { count: 3 }, questions: { total: 2 } } }), null);
  // Free's taste is not a limit line here: it lives on the shelf.
  assert.equal(chapterQuietLine({ free: { text: "Free opens 5 of this chapter's 46 cards." }, shelf: { cards: { count: 46 }, questions: { total: 2 } } }), null);
});

test('"Everything in this chapter": rows that lead somewhere, the rest in one quiet line (A4 3.2.6)', () => {
  const pro = shelfView({ shelf: { cards: { count: 46, open: 46, inRevise: 12 }, questions: { total: 10 }, mistakes: { open: 3 }, lesson: null, print: { mustKnow: 12, locked: false } } }, { mistakeMinutes: (n) => n });
  assert.deepEqual(pro.rows.map((r) => [r.title, r.line]), [
    ['Key cards', 'All 46, 12 in Revise'], ['Questions only', '10 questions in this chapter'], ['Your mistakes', '3 open. Fix them in about 3 min'], ['Print sheet', '12 Must-know lines, with your name'],
  ]);
  assert.equal(pro.missing, null, 'R2 ruling 9: what is missing is never announced');
  const free = shelfView({ freeSession: { used: true }, shelf: { cards: { count: 46, open: 5 }, questions: { total: 0 }, mistakes: { open: 0 }, lesson: { id: 'l', title: 'Goodwill', minutes: 7, read: false }, print: { mustKnow: 12, locked: true } } });
  assert.deepEqual(free.rows.map((r) => [r.title, r.line, Boolean(r.link)]), [
    ['Key cards', '46 cards. 5 open on Free.', true], ['Goodwill', '7-minute lesson, not read yet', true], ['Print sheet', 'Part of Pro', true],
  ]);
  assert.equal(free.missing, null);
});

test('a missing chapter and the run flags', () => {
  assert.equal(isChapterMissing({ kind: 'chapter_not_found' }), true);
  assert.equal(isChapterMissing({ status: 404, code: 'LEARN_OFF' }), false);
  assert.equal(isChapterMissing({ status: 503 }), false);
  assert.equal(withFlag('/learn/run?chapter=a&min=10', 'fresh', '1'), '/learn/run?chapter=a&min=10&fresh=1');
  assert.equal(withFlag('/learn/run', 'next', null), '/learn/run');
});

test('R2 ruling 9: the only verdict is "Needs work"; never Not started, Too few answers, Getting there or Holding', () => {
  assert.equal(chapterVerdict({ key: 'needs_work', label: 'Needs work' }), 'Needs work');
  for (const [key, label] of [['none', 'Not started'], ['thin', 'Too few answers'], ['getting_there', 'Getting there'], ['holding', 'Holding'], ['unknown', 'Fading']]) {
    assert.equal(chapterVerdict({ key, label }), null, label);
  }
  assert.equal(chapterVerdict(null), null);
});

test('R2 ruling 9: the recap is a quiet key "Quick recap, 1 min"; First up is up to 3 real fronts, none drawn when empty', () => {
  assert.equal(recapLabel({ count: 5, minutes: 1 }), 'Quick recap, 1 min');
  assert.equal(recapLabel({ count: 12, minutes: 2 }), 'Quick recap, 2 min');
  assert.equal(recapLabel({ count: 0, minutes: 1 }), null, 'no Must-know line: no recap key');
  assert.equal(recapLabel(null), null);
  const four = [1, 2, 3, 4].map((i) => ({ id: `c${i}`, front: ` Front ${i} `, mustKnow: i === 1 }));
  assert.deepEqual(firstUpCards({ firstUp: four }), [{ id: 'c1', front: 'Front 1', mustKnow: true }, { id: 'c2', front: 'Front 2', mustKnow: false }, { id: 'c3', front: 'Front 3', mustKnow: false }]);
  assert.deepEqual(firstUpCards({ firstUp: [{ id: 'x', front: '  ' }] }), []);
  assert.deepEqual(firstUpCards({}), []);
});

test('R2 ruling 9: a long title steps down so it keeps to 2 lines on a phone', () => {
  assert.equal(titleSize('Goodwill'), 'm');
  assert.equal(titleSize('Admission of a Partner'), 'm');
  assert.equal(titleSize('Profit and Loss Appropriation Account'), 'l');
  assert.equal(titleSize('Accounting for Partnership: Basic Concepts'), 'xl');
});

test('R2 ruling 9: the page draws no first-visit line, no missing line, one main key, "Other" for its own length', async () => {
  const { readFileSync } = await import('node:fs');
  const page = readFileSync(new URL('./ChapterPage.jsx', import.meta.url), 'utf8');
  assert.doesNotMatch(page, /lc-shelf__none/, 'no "No lesson yet. No open mistakes."');
  assert.doesNotMatch(page, /'Your own'/);
  assert.match(page, /: 'Other' \}\]/);
  assert.match(page, /<FirstUp key=/);
  assert.match(page, /const picker = !resume \|\| fresh;/, 'with a run to pick up, the picker waits under "Start fresh instead"');
  assert.equal((page.match(/kc-btn--volt/g) || []).length, 3, 'the volt is the resume key, or the Start key (its link and its waiting button) only when there is no resume');
});
