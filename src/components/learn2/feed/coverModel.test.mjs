// node --test src/components/learn2/feed/coverModel.test.mjs
// The words on an Explore cover (A2-explore-covers.md 4.2, 4.6, 4.8; BUILD-1101 B7), with and without packet S3's fields.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  refLineOf, isCloze, isReadableHook, hasHistory, isFreePlan, leadLine, studentLineOf, mixLineOf, keyLabelOf, hookTier, mediaOf, opensQuestions, chapterNameOf, slugOf, readLength,
} from './coverModel.js';

test('R4 ruling N: a cover is labelled by its roadmap place, "Chapter 5"; never the NCERT number, and no label without a place', () => {
  assert.equal(refLineOf({ place: { n: 5, of: 14 }, ref: 'Ch 2', refLine: 'Part 1, Ch 2' }), 'Chapter 5');
  assert.equal(refLineOf({ place: { n: 12, of: 14 }, partTitle: 'Part 2, Financial Statement Analysis' }), 'Chapter 12');
  assert.equal(refLineOf({ ref: 'Ch 2', refLine: 'Part 1, Ch 2', partTitle: 'Part 1, Partnership Accounts' }), null, 'no place, no label (never "Ch N")');
  assert.equal(refLineOf({ place: { n: 0, of: 14 } }), null);
  assert.equal(refLineOf({}), null);
});

test('lead line: For you only from history; book order reads Start here', () => {
  assert.deepEqual(leadLine({ forYou: true, reason: '3 old mistakes to fix' }), { prefix: 'For you:', text: '3 open mistakes to fix' }, 'R3 X4: the server line says "old", the page says "open"');
  assert.deepEqual(leadLine({ forYou: true, reason: 'Pick up where you stopped' }), { prefix: 'For you:', text: 'pick up where you stopped' });
  assert.deepEqual(leadLine({ forYou: true, reason: 'Next after Goodwill: Nature and Valuation' }), { prefix: 'For you:', text: 'next after Goodwill: Nature and Valuation' });
  assert.deepEqual(leadLine({ forYou: true, reason: 'Chapter 1 of your book' }), { prefix: 'Start here:', text: 'first in the syllabus' });
  assert.deepEqual(leadLine({ forYou: true, reason: 'First in the syllabus' }), { prefix: 'Start here:', text: 'first in the syllabus' });
  assert.deepEqual(leadLine({ forYou: true, reason: '3 old mistakes to fix' }, { history: false }), { prefix: 'Start here:', text: 'first in the syllabus' });
  assert.equal(leadLine({ forYou: false, reason: 'x' }), null);
});

test('student line: never a due count; resume, mistakes, state, New to you; nothing without history', () => {
  assert.equal(studentLineOf({ studentLine: '3 due, 3 old mistakes' }), '3 open mistakes to fix');
  assert.equal(studentLineOf({ studentLine: '2 old mistakes to fix' }), '2 open mistakes to fix');
  assert.equal(studentLineOf({ mistakes: 3, studentLine: '' }), '3 open mistakes to fix');
  assert.equal(studentLineOf({ studentLine: '1 old mistake' }), '1 open mistake to fix');
  // R2 ruling 2: "Needs work" is the only verdict word; Holding, Getting there and Too few answers never show.
  assert.equal(studentLineOf({ studentLine: '3 due', state: { key: 'holding', label: 'Holding' } }), null);
  assert.equal(studentLineOf({ studentLine: '', state: { key: 'needs_work', label: 'Needs work' } }), 'Needs work');
  assert.equal(studentLineOf({ studentLine: 'Too few answers', state: { key: 'thin', label: 'Too few answers' } }), null);
  assert.equal(studentLineOf({ studentLine: 'Holding, 2 old mistakes' }), '2 open mistakes to fix');
  assert.equal(studentLineOf({ studentLine: '3 due', state: { key: 'none', label: 'Not started' } }), 'New to you');
  assert.equal(studentLineOf({ studentLine: 'Getting there' }), null);
  assert.equal(studentLineOf({ studentLine: 'Needs work' }), 'Needs work');
  assert.equal(studentLineOf({ studentLine: 'x', resume: { done: 6, of: 16, minutesLeft: 4 } }), 'You stopped at 6 of 16');
  assert.equal(studentLineOf({ studentLine: 'New to you' }), 'New to you');
  assert.equal(studentLineOf({ studentLine: 'New to you' }, { history: false }), null);
});

test('history: the server flag, else any line that is not New to you', () => {
  assert.equal(hasHistory({ history: false, covers: [{ studentLine: 'Holding' }] }), false);
  assert.equal(hasHistory({ covers: [{ studentLine: 'New to you' }, { studentLine: 'New to you' }] }), false);
  assert.equal(hasHistory({ covers: [{ studentLine: 'New to you' }, { studentLine: '3 due' }] }), true);
});

test('mix line and key: the picked length, short chapters, Free, resume and the day limit', () => {
  const c = { counts: { 5: { cards: 8, questions: 2, minutes: 5 }, 10: { cards: 16, questions: 5, minutes: 10 }, 20: { cards: 16, questions: 0, minutes: 4 } } };
  assert.equal(mixLineOf(c, 10), '16 Key cards, 5 questions');
  assert.equal(mixLineOf(c, 20), '16 Key cards, all it has today');
  assert.equal(mixLineOf({ counts: { 10: { cards: 0, questions: 8, minutes: 10 } } }, 10), '8 questions');
  assert.equal(mixLineOf({ counts: { 10: { cards: 1, questions: 1, minutes: 10 } } }, 10), '1 Key card, 1 question');
  assert.equal(mixLineOf({ counts: { 10: { cards: 5, questions: 0, minutes: 1 } } }, 10, { free: true }), '5 Key cards');
  assert.equal(mixLineOf({ counts: { 20: { cards: 5, questions: 7, minutes: 9, capped: true } } }, 20), '5 Key cards, 7 questions');
  assert.equal(keyLabelOf(c, 10), 'Play · 10 min');
  assert.equal(keyLabelOf(c, 20), 'Play · 4 min');
  assert.equal(keyLabelOf({ counts: { 10: { cards: 5, questions: 0, minutes: 1 } } }, 10), 'Play · 1 min');
  const r = { ...c, resume: { done: 6, of: 16, minutesLeft: 4 } };
  assert.equal(keyLabelOf(r, 20), 'Continue · 4 min', 'R3 W: one word for resuming, "Continue · N min"');
  assert.equal(mixLineOf(r, 5), '', 'the key carries the time, so the line does not repeat it');
  assert.equal(keyLabelOf(c, 10, { freeDone: true }), 'Questions on this chapter');
  // M3: at Free's day limit a cover with a feed to pick up says so (the feed resumes its own run); only the others open questions.
  assert.equal(keyLabelOf(r, 10, { freeDone: true }), 'Continue · 4 min');
  assert.equal(opensQuestions(r, { freeDone: true }), false);
  assert.equal(opensQuestions(c, { freeDone: true }), true);
  assert.equal(opensQuestions(c, { freeDone: false }), false);
  assert.equal(isFreePlan({ covers: [c, { counts: { 20: { capped: true } } }] }), true);
  assert.equal(isFreePlan({ covers: [c] }), false);
});

test('media: the opening card, a locked card never prints null, a questions-only chapter', () => {
  assert.deepEqual(mediaOf({ hook: { front: 'What is goodwill?' } }), { kind: 'card', text: 'What is goodwill?' });
  assert.deepEqual(mediaOf({ hook: { front: null, kind: 'definition', locked: true } }), { kind: 'locked', label: 'Definition' });
  // R4 owner-eye#10: a cover's line is never a cloze (a fill-in-the-blank reads as a broken template), and never a long card.
  const cloze = "Persons who have entered into partnership with one another are individually called '____' and collectively called '____'.";
  assert.equal(isCloze(cloze), true);
  assert.equal(isCloze('Name the 6 essential features of a partnership [...]'), true);
  assert.equal(isCloze('What is the gaining ratio?'), false);
  assert.equal(isCloze('Table 2.4 shows a 1_000 ratio'), false, 'one underscore is not a blank');
  assert.equal(isReadableHook(cloze), false);
  assert.equal(isReadableHook('x'.repeat(106)), false, 'longer than the display type holds');
  assert.equal(isReadableHook('What is goodwill?'), true);
  // the server's candidates (`hooks`, in feed order): the first short non-cloze front wins
  assert.deepEqual(mediaOf({ hook: { front: cloze }, hooks: [{ front: cloze }, { front: 'What is the gaining ratio?' }, { front: 'What is goodwill?' }] }), { kind: 'card', text: 'What is the gaining ratio?' });
  // only a cloze is left: the cover says what the feed holds, in plain words, never the unfinished sentence
  assert.deepEqual(mediaOf({ hook: { front: cloze }, counts: { 10: { cards: 10, questions: 6, minutes: 10 } } }), { kind: 'cards', text: '10 Key cards', note: 'and 6 questions' });
  assert.deepEqual(mediaOf({ hook: { front: cloze }, counts: { 10: { cards: 1, questions: 0, minutes: 10 } } }), { kind: 'cards', text: '1 Key card', note: 'one at a time' });
  // each length's own first card is the line for that length
  assert.deepEqual(mediaOf({ hook: { front: 'Ten?' }, counts: { 10: { cards: 4, questions: 1, minutes: 10, hook: { front: 'Ten?' } }, 5: { cards: 2, questions: 0, minutes: 5, hook: { front: 'Five?' } } } }, 5), { kind: 'card', text: 'Five?' });
  assert.deepEqual(mediaOf({ hook: null, counts: { 10: { cards: 0, questions: 8, minutes: 10 } } }), { kind: 'questions', text: '8 questions', note: 'No Key cards here yet.' });
  // A chapter that still has cards (kept or due, so none is served in a feed) says where they are, not that it has none.
  assert.deepEqual(mediaOf({ hook: null, due: 6, kept: 6, counts: { 10: { cards: 0, questions: 4, minutes: 10 } } }), { kind: 'questions', text: '4 questions', note: 'Your cards here are in Revise.' });
  assert.equal(mediaOf({ hook: null, kept: 2, counts: { 10: { cards: 0, questions: 4, minutes: 10 } } }).note, 'Your cards here are in Revise.');
  assert.equal(hookTier('What is goodwill?'), 's');
  assert.equal(hookTier('What is reconstitution of a partnership firm?'), 'm');
  assert.equal(hookTier('Sum due to a retiring/deceased partner includes: name items (i) to (v).'), 'l');
  assert.equal(hookTier('Define the dissolution of the firm (Section 39 of the Partnership Act 1932) as a whole.'), 'xl');
  assert.equal(hookTier('Which Article requires the government to present its estimated receipts and expenditures to Parliament every year?'), 'xxl');
});

test('chapter names: the server name, else the syllabus chapter matching the key or title', () => {
  const names = ['Partnership Fundamentals', 'Admission of Partner', 'Profit & Loss Appropriation Account'];
  assert.equal(chapterNameOf({ name: 'Goodwill', key: 'accountancy.x' }, names), 'Goodwill');
  assert.equal(chapterNameOf({ key: 'accountancy.admission-of-partner', title: 'Admission of a Partner' }, names), 'Admission of Partner');
  assert.equal(chapterNameOf({ key: 'accountancy.profit-and-loss-appropriation-account', title: 'Profit and Loss Appropriation Account' }, names), 'Profit & Loss Appropriation Account');
  assert.equal(chapterNameOf({ key: 'accountancy.none', title: 'None' }, names), null);
  assert.equal(slugOf('accountancy.partnership-fundamentals'), 'partnership-fundamentals');
});

test('the stored length: 5, 10 or 20, else 10', () => {
  assert.equal(readLength('20'), 20);
  assert.equal(readLength('30'), 10);
  assert.equal(readLength(null), 10);
});

test('a feed started from a cover reads where it came from once, within a minute, for that chapter only', async () => {
  const { readCoverStart, COVER_START_KEY } = await import('./coverModel.js');
  const mem = new Map();
  const storage = { getItem: (k) => mem.get(k) ?? null, setItem: (k, v) => mem.set(k, v), removeItem: (k) => mem.delete(k) };
  storage.setItem(COVER_START_KEY, JSON.stringify({ chapterKey: 'a.b', forYou: true, position: 3, at: 1000 }));
  assert.deepEqual(readCoverStart('a.b', { now: 2000, storage }), { source: 'explore_cover', forYou: true, position: 3 });
  assert.equal(readCoverStart('a.b', { now: 2000, storage }), null);
  storage.setItem(COVER_START_KEY, JSON.stringify({ chapterKey: 'a.b', forYou: false, position: 1, at: 1000 }));
  assert.equal(readCoverStart('a.c', { now: 2000, storage }), null);
  storage.setItem(COVER_START_KEY, JSON.stringify({ chapterKey: 'a.b', forYou: false, position: 1, at: 1000 }));
  assert.equal(readCoverStart('a.b', { now: 70000, storage }), null);
});

test('R2: a first visit names what a feed holds in plain words, not "Key cards" counts (phone-clarity 18)', () => {
  const c = { counts: { 10: { cards: 5, questions: 7, minutes: 10 } } };
  assert.equal(mixLineOf(c, 10, { history: false }), 'Cards and questions');
  assert.equal(mixLineOf({ counts: { 10: { cards: 5, questions: 0, minutes: 10 } } }, 10, { history: false }), 'Cards, one at a time');
  assert.equal(mixLineOf(c, 10), '5 Key cards, 7 questions', 'a returning student keeps the counts');
});

// R2 (packet P3): Explore's own page rules run with test:learn from here, so package.json's one-line test list is not edited by
// three packets at once (the orchestrator may move it there).
await import('../../feed/exploreModel.test.mjs');

test('R6 Web D: a cover carries its hook card\'s kind for the kind tab; every kind has one of four families', async () => {
  assert.deepEqual(mediaOf({ hook: { front: 'What is goodwill?', kind: 'definition' } }), { kind: 'card', text: 'What is goodwill?', cardKind: 'definition' });
  assert.deepEqual(mediaOf({ hook: { front: 'What is goodwill?' } }), { kind: 'card', text: 'What is goodwill?' }, 'no kind from the server: no tab');
  const { kindFamily, KIND_FAMILIES, KIND_LABELS } = await import('../../keycards/kinds.js');
  for (const k of Object.keys(KIND_LABELS)) assert.ok(KIND_FAMILIES.includes(kindFamily(k)), k);
  assert.equal(kindFamily('definition'), 'meaning');
  assert.equal(kindFamily('formula'), 'rule');
  assert.equal(kindFamily('entry'), 'rule');
  assert.equal(kindFamily('steps'), 'parts');
  assert.equal(kindFamily('key_line'), 'fact');
  assert.equal(kindFamily(undefined), 'fact', 'an unknown kind is a fact');
  assert.equal(kindFamily('Definition'), 'meaning', 'case does not matter');
});
