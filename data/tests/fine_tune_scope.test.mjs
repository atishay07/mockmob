// The fine-tune scope (START-1017 section 4.3, owner F9) and the chapter picker's rules (D6, F8).
//   Quick practice: chapters and difficulty.  Full mock: difficulty only.  Smart practice and NTA mode: nothing.
// The scope table is checked as data, then through the real POST /api/sessions route (data/tests/nta_e2e_harness.mjs:
// real route and server code, a stand-in database and sign-in): a crafted request cannot add chapters or a level
// where the mode does not take them, on the practice path and on the recovery path.
import test from 'node:test';
import assert from 'node:assert/strict';
import * as h from './nta_e2e_harness.mjs';
import { TEST_MODES, fineTuneScope, fineTuneViolation } from '../test_modes.js';
import { MAX_CHAPTERS, chapterUnits, chaptersForMode, filterUnits, matchRange, searchKey, toggleChapter, toggleUnit } from '../../src/app/(app)/dashboard/chapterGroups.mjs';

test('the scope table: chapters for Quick practice only, difficulty for Quick practice and Full mock', () => {
  assert.deepEqual(fineTuneScope('quick'), { chapters: true, difficulty: true });
  assert.deepEqual(fineTuneScope('full'), { chapters: false, difficulty: true });
  assert.deepEqual(fineTuneScope('smart'), { chapters: false, difficulty: false });
  assert.deepEqual(fineTuneScope('nta'), { chapters: false, difficulty: false });
  assert.deepEqual(fineTuneScope('nope'), { chapters: false, difficulty: false });
  assert.deepEqual(Object.keys(TEST_MODES).filter((id) => TEST_MODES[id].allowChapters), ['quick']);
});

test('fineTuneViolation names the first thing a mode does not take', () => {
  assert.equal(fineTuneViolation('quick', { chapters: ['Goodwill Valuation'], difficulty: 'hard' }), null);
  assert.equal(fineTuneViolation('full', { difficulty: 'hard' }), null);
  assert.equal(fineTuneViolation('full', { chapters: ['Goodwill Valuation'] }), 'CHAPTERS_NOT_ALLOWED');
  assert.equal(fineTuneViolation('smart', { chapters: ['Goodwill Valuation'] }), 'CHAPTERS_NOT_ALLOWED');
  assert.equal(fineTuneViolation('nta', { chapters: 1 }), 'CHAPTERS_NOT_ALLOWED');
  assert.equal(fineTuneViolation('smart', { difficulty: 'easy' }), 'DIFFICULTY_NOT_ALLOWED');
  assert.equal(fineTuneViolation('nta', { difficulty: 'medium' }), 'DIFFICULTY_NOT_ALLOWED');
  assert.equal(fineTuneViolation('nta', { chapters: [''], difficulty: '' }), null);
});

test('the real session route refuses chapters and levels outside the scope', async () => {
  h.configure({ signingKey: h.TEST_SECRET });
  const { fake } = h;
  fake.resetStore({ missing: ['nta_question_index', 'nta_paper_shortfalls'] });
  for (const name of ['questions', 'passage_groups', 'question_content_disputes', 'recovery_family_holds', 'attempts', 'user_question_progress', 'recovery_sessions']) fake.seed(name, []);
  fake.seed('users', [{ id: 'pro', email: 'pro@example.test', name: 'Test Student', role: 'student', credit_balance: 100, subscription_status: 'active', created_at: new Date().toISOString() }]);
  const start = (body) => h.call('POST', { subject: 'accountancy', count: 10, experience: 'practice', generationKey: h.generationKey('scope'), ...body }, 'pro');

  for (const mode of ['full', 'smart', 'nta']) {
    const one = await start({ mode, chapter: 'Goodwill Valuation' });
    assert.equal(one.status, 422, `${mode} with a chapter`);
    assert.equal(one.body.error, 'CHAPTERS_NOT_ALLOWED');
    const many = await start({ mode, chapters: 'Goodwill Valuation,Share Capital' });
    assert.equal(many.body.error, 'CHAPTERS_NOT_ALLOWED', `${mode} with chapters`);
  }
  for (const mode of ['smart', 'nta']) {
    const level = await start({ mode, difficulty: 'hard' });
    assert.equal(level.status, 422);
    assert.equal(level.body.error, 'DIFFICULTY_NOT_ALLOWED', `${mode} with a level`);
  }
  // In scope, the route goes on to build the paper (the stand-in bank is empty, so it stops there, for another reason).
  const quick = await start({ mode: 'quick', chapters: 'Goodwill Valuation,Share Capital', difficulty: 'hard' });
  assert.notEqual(quick.body.error, 'CHAPTERS_NOT_ALLOWED');
  assert.notEqual(quick.body.error, 'DIFFICULTY_NOT_ALLOWED');
  const full = await start({ mode: 'full', difficulty: 'hard' });
  assert.notEqual(full.body.error, 'DIFFICULTY_NOT_ALLOWED');
  // The recovery path (a fresh check) keeps the same rule.
  const recovery = await h.call('POST', { subject: 'accountancy', mode: 'full', count: 5, experience: 'recovery', chapter: 'Goodwill Valuation', generationKey: h.generationKey('rec') }, 'pro');
  assert.equal(recovery.body.error, 'CHAPTERS_NOT_ALLOWED');
});

const ACCOUNTANCY_FLAT = { grouped: false, chapters: ['Goodwill Valuation', 'Partnership Fundamentals', 'Share Capital', 'Profit & Loss Appropriation Account', 'Admission of Partner', 'Retirement & Death of Partner', 'Change in Profit Sharing Ratio', 'Not In The Syllabus'].map((name, i) => ({ id: `c${i}`, name })) };

test('a flat chapter list is grouped by the syllabus units, in syllabus order, with the rest under Other chapters', () => {
  const { units, count, flat } = chapterUnits(ACCOUNTANCY_FLAT, 'accountancy');
  assert.equal(count, 8);
  assert.equal(flat, false);
  assert.deepEqual(units.map((unit) => unit.name), ['Accounting for Partnership', 'Reconstitution of a Partnership firm', 'Company Accounts: Accounting for Share and Debenture Capital', 'Other chapters']);
  assert.deepEqual(units[1].chapters.map((c) => c.name), ['Goodwill Valuation', 'Admission of Partner', 'Retirement & Death of Partner', 'Change in Profit Sharing Ratio']);
});

test('grouped bodies keep their units; one chapter per unit renders flat', () => {
  const grouped = chapterUnits({ grouped: true, units: [{ id: 'u1', name: 'Planning', chapters: [{ id: 'a', name: 'Planning' }] }, { id: 'u2', name: 'Staffing', chapters: [{ id: 'b', name: 'Staffing' }] }] }, 'business_studies');
  assert.equal(grouped.flat, true);
  assert.equal(grouped.count, 2);
  const empty = chapterUnits(null, 'accountancy');
  assert.deepEqual(empty, { units: [], count: 0, flat: true });
});

test('search ignores case and punctuation, reads & as and, matches chapter names first (unit names only as a fallback), and folds empty units away', () => {
  const { units } = chapterUnits(ACCOUNTANCY_FLAT, 'accountancy');
  assert.equal(searchKey('Profit & Loss'), 'profit and loss');
  const goodwill = filterUnits(units, 'GOODWILL');
  assert.deepEqual(goodwill.map((unit) => unit.name), ['Reconstitution of a Partnership firm']);
  assert.deepEqual(goodwill[0].chapters.map((c) => c.name), ['Goodwill Valuation']);
  assert.ok(filterUnits(units, 'and').some((unit) => unit.chapters.some((c) => c.name === 'Profit & Loss Appropriation Account')));
  assert.equal(filterUnits(units, 'reconstitution')[0].chapters.length, 4, 'with no chapter match, a unit name match keeps the whole unit');
  // A chapter-name match wins: every chapter shown contains what was typed (verifier W-005: 'partn' listed unit-only hits).
  const partn = filterUnits(units, 'partn');
  assert.ok(partn.length > 0);
  for (const unit of partn) for (const c of unit.chapters) assert.ok(searchKey(c.name).includes('partn'), c.name);
  assert.deepEqual(matchRange('Admission of Partner', 'partn'), [13, 18]);
  assert.equal(matchRange('Goodwill Valuation', 'xyz'), null);
  assert.deepEqual(filterUnits(units, 'xyz'), []);
  assert.equal(filterUnits(units, '  '), units);
});

test('the picker never passes 12 chapters, and Whole unit toggles a unit', () => {
  const twelve = Array.from({ length: MAX_CHAPTERS }, (_, i) => `C${i}`);
  assert.equal(toggleChapter(twelve, 'C99'), twelve);
  assert.deepEqual(toggleChapter(twelve, 'C0'), twelve.slice(1));
  const unit = { chapters: [{ name: 'A' }, { name: 'B' }] };
  assert.deepEqual(toggleUnit([], unit), ['A', 'B']);
  assert.deepEqual(toggleUnit(['A', 'B', 'Z'], unit), ['Z']);
  assert.equal(toggleUnit(twelve.slice(0, 11), unit).length, 12);
});

test('chapters from a link or a remembered choice are kept only for a mode that takes them', () => {
  assert.deepEqual(chaptersForMode(true, ['A', 'B'], ['A']), { chapters: ['A'], dropped: 1 });
  assert.deepEqual(chaptersForMode(false, ['A', 'B'], ['A', 'B']), { chapters: [], dropped: 2 });
  assert.deepEqual(chaptersForMode(true, ['A']), { chapters: ['A'], dropped: 0 });
});

// Source guards for the two START-1017 bugs that were rules in the code, not data (F10, F12).
test('F10: the runner draws the chosen answer on the option itself, with no second gliding box', async () => {
  const { readFileSync } = await import('node:fs');
  const runner = readFileSync(new URL('../../src/app/(app)/test/TestPageClient.jsx', import.meta.url), 'utf8');
  const css = readFileSync(new URL('../../src/app/(app)/test/practice-run.css', import.meta.url), 'utf8');
  assert.equal(/pr-glide|placeGlides|glideRefs/.test(runner), false);
  assert.equal(/\.pr-glide/.test(css), false);
  // The old outline clears at once (border-color 0ms), at a specificity arena.css's 180 ms fade cannot beat.
  assert.match(css, /\.app-shell \.nta-runner\.pr-run\[data-interface="mockmob"\] \.nta-option \{\s*transition: border-color 0ms/);
});

test('F12 (kept) and W-075: the phone Start key is not tied to the old scroll rules; its one page-dependent look is data-quiet', async () => {
  const { readFileSync } = await import('node:fs');
  const css = readFileSync(new URL('../../src/components/start/start.css', import.meta.url), 'utf8');
  const phone = css.slice(css.indexOf('@media (max-width: 1023px)'), css.indexOf('/* Wide screens'));
  // The selectors that made it flip on a page's own scroll state stay gone. Since release 8 it also follows exactly one
  // thing, whether the page's own volt key is on screen (data-quiet, drawn by StartKey from the shell's watch).
  assert.equal(/pr-dock|data-start-quiet|data-primary-shown|data-cta-shown/.test(phone), false);
  assert.equal(/data-primary-shown|pr-dock\[data-shown\]/.test(css), false);
  assert.match(phone, /\.stk--bar\[data-quiet\]/);
  const page = readFileSync(new URL('../../src/app/(app)/dashboard/DashboardPageClient.jsx', import.meta.url), 'utf8');
  assert.equal(/IntersectionObserver|addEventListener\('scroll'/.test(page), false);
});