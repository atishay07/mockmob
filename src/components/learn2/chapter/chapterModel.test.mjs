// node --test src/components/learn2/chapter/chapterModel.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { FIRST_VISIT_LINE, ONLY_CARDS_LINE, chapterQuietLine, chapterVerdict, coachKeyFor, continueLabel, firstUpCards, hasSeenCards, headLines, isChapterMissing, pileView, recapLabel, runSummary, shelfView, startKeyLabel, titleSize, withFlag } from './chapterModel.mjs';

test('the head: the unit only when it does not repeat the title; the ref is the roadmap place, "Chapter 5 of 14" (R4 ruling N)', () => {
  assert.deepEqual(headLines({ title: 'Admission of a Partner', unitTitle: 'Reconstitution of a Partnership firm', partTitle: 'Part 1, Partnership Accounts', ref: 'Ch 2', place: { n: 5, of: 14 } }), { eyebrow: 'Reconstitution of a Partnership firm', ref: 'Chapter 5 of 14' });
  assert.deepEqual(headLines({ title: 'Goodwill: Nature and Valuation', unitTitle: 'Goodwill', partTitle: 'Part 1, Partnership Accounts', ref: 'Ch 2', place: { n: 4, of: 14 } }), { eyebrow: null, ref: 'Chapter 4 of 14' });
  // no place from the server: no ref line at all, never the NCERT number ("Part 1, Ch 2" is three different chapters)
  assert.deepEqual(headLines({ title: 'Admission of a Partner', unitTitle: null, partTitle: 'Part 1, Partnership Accounts', ref: 'Ch 2' }), { eyebrow: null, ref: null });
  assert.deepEqual(headLines({ title: 'Reading', unitTitle: null, partTitle: 'CUET English', ref: null }), { eyebrow: null, ref: null });
  assert.deepEqual(headLines(null), { eyebrow: null, ref: null });
});

test('a pile: in, left out, held by Free, and "2 of 3" mistakes (A4 3.2.4)', () => {
  assert.equal(pileView({ id: 'cards', label: 'Key cards', count: 16, minutes: 4 }).line, 'about 4 min');
  assert.equal(pileView({ id: 'lesson', label: 'Lesson', count: 1, minutes: 7 }).line, '7 min');
  assert.equal(pileView({ id: 'questions', label: 'Questions', left: true }).line, 'Tap to add it back');
  const held = pileView({ id: 'questions', label: 'Questions', left: true, held: true });
  assert.deepEqual([held.state, held.line], ['held', 'Back tomorrow']);
  const m = pileView({ id: 'mistakes', label: 'Your mistakes', count: 2, of: 3, minutes: 2 });
  assert.equal(m.of, 3);
  assert.match(m.aria, /Your mistakes: 2 of 3, about 2 min/);
});

test('R4 owner-eye#9: a mistakes pile that holds fewer than the chapter has says "2 fit in 10 min", so it never reads as a different number from "Fix 3 open mistakes"', () => {
  const m = pileView({ id: 'mistakes', label: 'Your mistakes', count: 2, of: 3, minutes: 2 }, { minutes: 10 });
  assert.equal(m.line, '2 fit in 10 min');
  assert.equal(m.of, 3);
  assert.match(m.aria, /Your mistakes: 2 of 3, 2 fit in 10 min\./);
  // all of them fit: the pile and the row say the same number, and the line is the usual minutes
  assert.equal(pileView({ id: 'mistakes', label: 'Your mistakes', count: 3, minutes: 3 }, { minutes: 10 }).line, 'about 3 min');
  assert.equal(pileView({ id: 'mistakes', label: 'Your mistakes', count: 3, of: 3, minutes: 3 }, { minutes: 10 }).line, 'about 3 min', 'of equal to count is no "of"');
  // other piles never read "fit in"
  assert.equal(pileView({ id: 'cards', label: 'Key cards', count: 16, minutes: 4 }, { minutes: 10 }).line, 'about 4 min');
  // a length that is not a whole number of minutes is rounded up, as every label is
  assert.equal(pileView({ id: 'mistakes', label: 'Your mistakes', count: 1, of: 4, minutes: 1 }, { minutes: 4.2 }).line, '1 fit in 5 min');
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
    ['Key cards', 'All 46, 12 in Revise'], ['Questions only', '10 questions in this chapter'], ['Your mistakes', 'Fix 3 open mistakes · 3 min'], ['Chapter sheet', '12 Must-know lines, with your name on it'],
  ]);
  assert.equal(pro.missing, null, 'R2 ruling 9: what is missing is never announced');
  const free = shelfView({ freeSession: { used: true }, shelf: { cards: { count: 46, open: 5 }, questions: { total: 0 }, mistakes: { open: 0 }, lesson: { id: 'l', title: 'Goodwill', minutes: 7, read: false }, print: { mustKnow: 12, locked: true } } });
  assert.deepEqual(free.rows.map((r) => [r.title, r.line, Boolean(r.link)]), [
    ['Key cards', '46 cards. 5 open on Free.', true], ['Goodwill', 'Lesson · 7 min, not read yet', true], ['Chapter sheet', 'Part of Pro', true],
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

test('R2 ruling 9 and R3 W: the recap is a quiet key "Quick recap · 1 min"; First up is up to 3 real fronts, none drawn when empty', () => {
  assert.equal(recapLabel({ count: 5, minutes: 1 }), 'Quick recap · 1 min');
  assert.equal(recapLabel({ count: 12, minutes: 2 }), 'Quick recap · 2 min');
  assert.equal(recapLabel({ count: 12, minutes: 0.4 }), 'Quick recap · 1 min', 'at least 1 min');
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
  assert.match(readFileSync(new URL('../LengthPicker.jsx', import.meta.url), 'utf8'), /: 'Other' }]/, 'the length control (now shared with Learn home) says Other');
  assert.match(page, /<FirstUp key=/);
  assert.match(page, /const picker = !resume \|\| fresh;/, 'with a run to pick up, the picker waits under "Start fresh instead"');
  assert.equal((page.match(/kc-btn--volt/g) || []).length, 3, 'the volt is the resume key, or the Start key (its link and its waiting button) only when there is no resume');
});

// ---- Round 3 (packet R3-explore): X6 and ruling W on the chapter page -------------------------------------------------------
test('R3 X6: Quick recap shows only after the student has seen at least 1 card in the chapter', () => {
  const recap = { count: 5, minutes: 1 };
  assert.equal(recapLabel(recap, { seen: false }), null, 'a brand-new student has nothing to recap');
  assert.equal(recapLabel(recap, { seen: true }), 'Quick recap · 1 min');
  assert.equal(hasSeenCards({ cardsSeen: 0, firstVisit: false }), false, 'the count wins');
  assert.equal(hasSeenCards({ cardsSeen: 1, firstVisit: true }), true);
  assert.equal(hasSeenCards({ firstVisit: true }), false, 'an older server: a first visit has seen nothing');
  assert.equal(hasSeenCards({ firstVisit: false }), true);
  assert.equal(hasSeenCards(null), false);
});

test('R3 W: the Start key and the key that continues a run use the one time format', () => {
  assert.equal(startKeyLabel('Start 10 minutes', 10), 'Start · 10 min');
  assert.equal(startKeyLabel('Start 1 minute', 1), 'Start · 1 min');
  assert.equal(startKeyLabel('Start 10 minutes', 10, { fresh: true }), 'Start fresh · 10 min');
  assert.equal(startKeyLabel(undefined, 5), 'Start · 5 min', 'before the first dry run answers');
  assert.equal(startKeyLabel('Start the 7-minute lesson', 10), 'Start the 7-minute lesson');
  assert.equal(startKeyLabel('Nothing to start yet', 10), 'Nothing to start yet');
  assert.equal(continueLabel({ minutesLeft: 6 }), 'Continue · 6 min');
  assert.equal(continueLabel({ minutesLeft: 0 }), 'Continue · 1 min');
  assert.equal(continueLabel({}), 'Continue · 1 min');
  assert.equal(continueLabel({ minutesLeft: 5.2 }), 'Continue · 6 min', 'rounded up');
});

test('R3 W: Free after the session says "3 open mistakes", never a bare "3 open"', () => {
  const view = shelfView({ freeSession: { used: true }, shelf: { cards: { count: 46, open: 5 }, questions: { total: 4 }, mistakes: { open: 3 }, print: { mustKnow: 12, locked: true } } });
  const row = view.rows.find((r) => r.id === 'mistakes');
  assert.equal(row.line, '3 open mistakes, back tomorrow');
  assert.equal(shelfView({ freeSession: { used: true }, shelf: { cards: { count: 1 }, mistakes: { open: 1 } } }).rows.find((r) => r.id === 'mistakes').line, '1 open mistake, back tomorrow');
});

test('R3 X6: the pile tip is kept per student; the piles share the row; the page uses the shared words', async () => {
  const { readFileSync } = await import('node:fs');
  assert.notEqual(coachKeyFor('a'), coachKeyFor('b'));
  assert.equal(coachKeyFor(null), coachKeyFor(undefined));
  const page = readFileSync(new URL('./ChapterPage.jsx', import.meta.url), 'utf8');
  assert.match(page, /coachKeyFor\(user\?\.id\)/, 'the tip is once per student');
  assert.match(page, /tipDue = picker && piles\.length > 1/, 'and only once it is drawn');
  assert.doesNotMatch(page, /Pick up where you stopped/, 'W: one word for resuming');
  assert.doesNotMatch(page, /Start a new/);
  assert.doesNotMatch(page, /About \{resume\.minutesLeft\} min left/, 'the time sits on the key only');
  assert.match(page, /continueLabel\(resume\)/);
  assert.match(page, /recapLabel\(data\?\.recap, \{ seen: hasSeenCards\(data\) \}\)/);
  const css = readFileSync(new URL('./chapter.css', import.meta.url), 'utf8');
  assert.match(css, /\.lc-piles:is\(\[data-n='1'\], \[data-n='2'\]\) \{ grid-template-columns: repeat\(2, minmax\(0, 1fr\)\)/, 'two piles take the full row at 390');
  assert.doesNotMatch(css, /lc-first__front \{[^}]*hyphens: auto/, 'L6: no hyphenated card text');
});

test('R3 X6: the dry run reports how many of the chapter\'s cards the student has seen', async () => {
  const { readFileSync } = await import('node:fs');
  const server = readFileSync(new URL('../../../lib/server/learn.js', import.meta.url), 'utf8');
  assert.match(server, /cardsSeen: info\.coverage\.seen/);
});

test('R3 W: a due count on the chapter page always says "cards", never a bare "46 due"', async () => {
  const { dueWords } = await import('./chapterModel.mjs');
  assert.equal(dueWords('Revise first: 46 due'), 'Revise first: 46 due cards');
  assert.equal(dueWords('Revise first: 1 due. Until then a run takes at most 5 new cards.'), 'Revise first: 1 due card. Until then a run takes at most 5 new cards.');
  assert.equal(dueWords('Revise first: 9 due cards'), 'Revise first: 9 due cards');
  assert.equal(dueWords('Revise first: 1,200 due'), 'Revise first: 1,200 due cards');
  assert.equal(dueWords(null), '');
  assert.equal(pileView({ id: 'cards', label: 'Key cards', count: 5, minutes: 2, note: 'Revise first: 46 due' }).note, 'Revise first: 46 due cards');
  assert.equal(chapterQuietLine({ shrink: { text: 'Revise first: 8 due. Until then a run takes at most 5 new cards, about 2 min.' } }), 'Revise first: 8 due cards. Until then a run takes at most 5 new cards, about 2 min.');
});

test('LK37: "What\'s in this run" has one live line over its switches: only piles that are in count', () => {
  const piles = [
    { id: 'cards', count: 12, left: false }, { id: 'questions', count: 6, left: false },
    { id: 'mistakes', count: 2, left: true }, { id: 'lesson', count: 1, left: false, held: 'free' },
  ];
  assert.equal(runSummary({ realMinutes: 10 }, piles), '18 steps · about 10 min');
  assert.equal(runSummary({ realMinutes: 4 }, [{ id: 'mistakes', count: 1, left: false }]), '1 step · about 4 min');
  assert.equal(runSummary({ realMinutes: 0 }, [{ id: 'cards', count: 3, left: false }]), '3 steps');
  assert.equal(runSummary({ realMinutes: 10 }, [{ id: 'cards', count: 3, left: true }]), '', 'nothing in, nothing said');
  assert.equal(runSummary(null, []), '');
});

test('LK37: the piles are real switches (role=switch, aria-checked) with In or Out beside them; the last one in still shakes', async () => {
  const { readFileSync } = await import('node:fs');
  const page = readFileSync(new URL('./ChapterPage.jsx', import.meta.url), 'utf8').replace(/\r\n/g, '\n');
  assert.match(page, /role="switch"\n\s+aria-checked=\{!pile\.left\}/);
  assert.match(page, /What's in this session/);
  assert.match(page, /runSummary\(data, piles\)/);
  assert.match(page, /v\.state === 'in' \? 'In' : 'Out'/);
  assert.match(page, /if \(inRun\.length <= 1\) \{\n\s+setShake\(pile\.id\);/, 'the last pile in cannot be switched off');
  const css = readFileSync(new URL('./chapter.css', import.meta.url), 'utf8');
  assert.match(css, /\.lc-sw__knob \{[^}]*transition: transform 180ms/, 'the knob moves by transform only');
});
