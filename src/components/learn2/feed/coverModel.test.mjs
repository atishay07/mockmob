// node --test src/components/learn2/feed/coverModel.test.mjs
// The words on an Explore cover (A2-explore-covers.md 4.2, 4.6, 4.8; BUILD-1101 B7), with and without packet S3's fields.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  refLineOf, hasHistory, isFreePlan, leadLine, studentLineOf, mixLineOf, keyLabelOf, hookTier, mediaOf, chapterNameOf, slugOf, readLength,
} from './coverModel.js';

test('ref line: the server line wins, else derived from part and ref, else the unit', () => {
  assert.equal(refLineOf({ refLine: 'Part 1, Ch 2', ref: 'Ch 9' }), 'Part 1, Ch 2');
  assert.equal(refLineOf({ ref: 'Ch 2', partTitle: 'Part 1, Partnership Accounts' }), 'Part 1, Ch 2');
  assert.equal(refLineOf({ ref: 'Ch 4', partTitle: 'Business Studies Part 2' }), 'Part 2, Ch 4');
  assert.equal(refLineOf({ ref: 'Ch 2', partTitle: 'Introductory Microeconomics' }), 'Microeconomics, Ch 2');
  assert.equal(refLineOf({ ref: 'Ch 5', partTitle: 'Indian Economic Development' }), 'Indian Economic Development, Ch 5');
  assert.equal(refLineOf({ ref: null, unitTitle: 'Verbal Ability' }), 'Verbal Ability');
  assert.equal(refLineOf({}), null);
});

test('lead line: For you only from history; book order reads Start here', () => {
  assert.deepEqual(leadLine({ forYou: true, reason: '3 old mistakes to fix' }), { prefix: 'For you:', text: '3 old mistakes to fix' });
  assert.deepEqual(leadLine({ forYou: true, reason: 'Pick up where you stopped' }), { prefix: 'For you:', text: 'pick up where you stopped' });
  assert.deepEqual(leadLine({ forYou: true, reason: 'Next after Goodwill: Nature and Valuation' }), { prefix: 'For you:', text: 'next after Goodwill: Nature and Valuation' });
  assert.deepEqual(leadLine({ forYou: true, reason: 'Chapter 1 of your book' }), { prefix: 'Start here:', text: 'first in the syllabus' });
  assert.deepEqual(leadLine({ forYou: true, reason: 'First in the syllabus' }), { prefix: 'Start here:', text: 'first in the syllabus' });
  assert.deepEqual(leadLine({ forYou: true, reason: '3 old mistakes to fix' }, { history: false }), { prefix: 'Start here:', text: 'first in the syllabus' });
  assert.equal(leadLine({ forYou: false, reason: 'x' }), null);
});

test('student line: never a due count; resume, mistakes, state, New to you; nothing without history', () => {
  assert.equal(studentLineOf({ studentLine: '3 due, 3 old mistakes' }), '3 old mistakes to fix');
  assert.equal(studentLineOf({ studentLine: '2 old mistakes to fix' }), '2 old mistakes to fix');
  assert.equal(studentLineOf({ studentLine: '1 old mistake' }), '1 old mistake to fix');
  assert.equal(studentLineOf({ studentLine: '3 due', state: { key: 'holding', label: 'Holding' } }), 'Holding');
  assert.equal(studentLineOf({ studentLine: '3 due', state: { key: 'none', label: 'Not started' } }), 'New to you');
  assert.equal(studentLineOf({ studentLine: 'Getting there' }), 'Getting there');
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
  assert.equal(keyLabelOf(c, 10), 'Play 10 minutes');
  assert.equal(keyLabelOf(c, 20), 'Play 4 minutes');
  assert.equal(keyLabelOf({ counts: { 10: { cards: 5, questions: 0, minutes: 1 } } }, 10), 'Play 1 minute');
  const r = { ...c, resume: { done: 6, of: 16, minutesLeft: 4 } };
  assert.equal(keyLabelOf(r, 20), 'Pick up, 4 minutes');
  assert.equal(mixLineOf(r, 5), 'About 4 minutes left');
  assert.equal(keyLabelOf(c, 10, { freeDone: true }), 'Questions on this chapter');
  assert.equal(isFreePlan({ covers: [c, { counts: { 20: { capped: true } } }] }), true);
  assert.equal(isFreePlan({ covers: [c] }), false);
});

test('media: the opening card, a locked card never prints null, a questions-only chapter', () => {
  assert.deepEqual(mediaOf({ hook: { front: 'What is goodwill?' } }), { kind: 'card', text: 'What is goodwill?' });
  assert.deepEqual(mediaOf({ hook: { front: null, kind: 'definition', locked: true } }), { kind: 'locked', label: 'Definition' });
  assert.deepEqual(mediaOf({ hook: null, counts: { 10: { cards: 0, questions: 8, minutes: 10 } } }), { kind: 'questions', text: '8 questions', note: 'No Key cards here yet.' });
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
