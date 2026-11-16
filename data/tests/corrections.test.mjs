// The public corrections log's data (data/corrections.json through data/corrections.mjs): the committed file is clean, a
// malformed entry is caught, the private source never reaches the page, and each seed entry agrees with its proof.
// The page and its links: data/tests/corrections_page.test.mjs.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  ACTIONS, FOUND, correctionsProblems, countLine, dateParts, entryProblems, isRealDate, istToday, loadCorrections, sentenceProblems,
} from '../corrections.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const read = (rel) => readFileSync(join(ROOT, rel), 'utf8');
const RAW = JSON.parse(read('data/corrections.json'));
const TODAY = '2026-11-16';

const good = (over = {}) => ({
  id: '2026-10-31-sample',
  date: '2026-10-31',
  subject: 'Accountancy',
  count: 2,
  action: 'fixed',
  found: 'check',
  wrong: 'Two questions had no right option among the four.',
  did: 'Rewrote the option meant to be right.',
  source: 'docs/brain/intel-1031/answer-keys-2026-10-31/VERDICTS.md',
  ...over,
});
const without = (field) => { const e = good(); delete e[field]; return e; };

test('the committed log has no malformed entry, as of today in India', () => {
  assert.deepEqual(correctionsProblems(RAW, { today: istToday() }), []);
  assert.ok(RAW.entries.length >= 1, 'the log is never empty once it has started');
  assert.equal(loadCorrections(RAW, { today: istToday() }).skipped, 0, 'nothing in the file is quietly left off the page');
});

test('every committed entry names its proof and keeps it off the page', () => {
  for (const entry of RAW.entries) assert.ok(typeof entry.source === 'string' && entry.source.length >= 10, `${entry.id} has a source`);
  const log = loadCorrections(RAW, { today: TODAY });
  for (const entry of log.entries) assert.equal('source' in entry, false, `${entry.id} carries no source to the page`);
  assert.doesNotMatch(JSON.stringify(log), /docs\/brain|commit |supabase\//, 'no proof path reaches what the page draws');
});

test('a good entry passes', () => {
  assert.deepEqual(entryProblems(good(), { today: TODAY }), []);
});

test('a bad date fails: not a day, the wrong shape, or a day still to come', () => {
  assert.match(entryProblems(good({ date: '2026-02-31', id: '2026-02-31-sample' }), { today: TODAY }).join('\n'), /not a real day/);
  assert.match(entryProblems(good({ date: '31/10/2026' }), { today: TODAY }).join('\n'), /not a real day/);
  assert.match(entryProblems(good({ date: '2026-11-17', id: '2026-11-17-sample' }), { today: TODAY }).join('\n'), /after today/);
  assert.deepEqual(entryProblems(good({ date: TODAY, id: `${TODAY}-sample` }), { today: TODAY }), [], 'today itself is fine');
  assert.equal(isRealDate('2028-02-29'), true);
  assert.equal(isRealDate('2027-02-29'), false);
});

test('a missing field fails, the source above all', () => {
  for (const field of ['id', 'date', 'subject', 'count', 'action', 'found', 'wrong', 'did', 'source']) {
    assert.ok(entryProblems(without(field), { today: TODAY }).length > 0, `missing ${field}`);
  }
  assert.match(entryProblems(without('source'), { today: TODAY }).join('\n'), /source is missing/);
  assert.match(entryProblems(good({ source: '  ' }), { today: TODAY }).join('\n'), /source is missing/);
});

test('fields hold what they promise', () => {
  const problems = (over) => entryProblems(good(over), { today: TODAY }).join('\n');
  assert.match(problems({ action: 'removed' }), /action is not one of/);
  assert.match(problems({ found: 'twitter' }), /found is not one of/);
  assert.match(problems({ count: 0 }), /count is not a whole number/);
  assert.match(problems({ count: 2.5 }), /count is not a whole number/);
  assert.match(problems({ soruce: 'x' }), /unknown field "soruce"/);
  assert.match(problems({ id: 'Sample' }), /id is not a slug/);
  assert.match(problems({ id: '2026-10-30-sample' }), /does not start with its date/);
  assert.deepEqual(entryProblems(good({ subject: 'All subjects', count: undefined }), { today: TODAY }), [], 'only every question may leave out its count');
});

test('a split across subjects adds up and is named for its size', () => {
  const split = { subject: '2 subjects', count: 5, bySubject: { Accountancy: 3, Economics: 2 } };
  assert.deepEqual(entryProblems(good(split), { today: TODAY }), []);
  assert.match(entryProblems(good({ ...split, count: 6 }), { today: TODAY }).join('\n'), /adds up to 5, not count 6/);
  assert.match(entryProblems(good({ ...split, subject: '3 subjects' }), { today: TODAY }).join('\n'), /should read "2 subjects"/);
  assert.match(entryProblems(good({ ...split, bySubject: { Accountancy: 5 } , count: 5 }), { today: TODAY }).join('\n'), /should read "1 subjects"|needs N of 2/);
});

test('the two sentences read as plain sentences and never print an answer letter', () => {
  assert.deepEqual(sentenceProblems('Took them out of practice.', 'did'), []);
  assert.match(sentenceProblems('took them out.', 'did').join(), /capital letter/);
  assert.match(sentenceProblems('Took them out of practice', 'did').join(), /full stop/);
  assert.match(sentenceProblems('Took them out of practice!.', 'did').join(), /exclamation/);
  assert.match(sentenceProblems('Fixed it 🎉 for you.', 'did').join(), /emoji/);
  assert.match(sentenceProblems('Fixed it · for you.', 'did').join(), /middle dot/);
  assert.match(sentenceProblems('x'.repeat(230) + '.', 'did').join(), /characters/);
  assert.match(sentenceProblems('The right answer is C, not B.', 'wrong').join(), /answer letter/);
  assert.match(sentenceProblems('Changed the key from B to C.', 'did').join(), /answer letter/);
  assert.match(sentenceProblems('The key B to C was wrong.', 'did').join(), /answer letter/);
  assert.deepEqual(sentenceProblems('Option A was the right answer in about two of every three questions.', 'wrong'), [], 'a share of letters is not a key');
});

test('the page gets the log newest first, grouped by day, the file order kept inside a day', () => {
  const raw = { entries: [
    good({ id: '2026-10-06-one', date: '2026-10-06' }),
    good({ id: '2026-10-31-first' }),
    good({ id: '2026-11-02-later', date: '2026-11-02' }),
    good({ id: '2026-10-31-second' }),
    good({ id: '2026-11-20-future', date: '2026-11-20' }),
    good({ id: '2026-10-31-first' }),
  ] };
  const log = loadCorrections(raw, { today: TODAY });
  assert.deepEqual(log.entries.map((e) => e.id), ['2026-11-02-later', '2026-10-31-first', '2026-10-31-second', '2026-10-06-one']);
  assert.deepEqual(log.days.map((d) => [d.date, d.entries.length]), [['2026-11-02', 1], ['2026-10-31', 2], ['2026-10-06', 1]]);
  assert.equal(log.skipped, 2, 'the future entry and the repeated id are left out');
  assert.equal(log.latest, '2026-11-02');
  assert.equal(log.first, '2026-10-06');
  assert.deepEqual(correctionsProblems(raw, { today: TODAY }).filter((p) => /twice|after today/.test(p)).length, 2);
});

test('words the page prints', () => {
  assert.deepEqual(dateParts('2026-10-31'), { day: '31', month: 'October', monthShort: 'Oct', year: '2026', label: '31 October 2026' });
  assert.equal(countLine({ count: 1 }), '1 question');
  assert.equal(countLine({ count: 1405 }), '1,405 questions');
  assert.equal(countLine({}), null);
  assert.deepEqual(Object.keys(ACTIONS), ['fixed', 'pulled', 'held']);
  assert.deepEqual(Object.keys(FOUND), ['check', 'report']);
  assert.equal(istToday(Date.UTC(2026, 10, 15, 19, 0)), '2026-11-16', '12:30 am IST is the next day');
});

test('the seed entries say only what their proof says', () => {
  const by = Object.fromEntries(RAW.entries.map((e) => [e.id, e]));
  // docs/brain/intel-1031/answer-keys-2026-10-31/README.md: 3 keys fixed, 31 reworded, 25 out of the pool.
  const keyFixes = ['2026-10-31-key-forfeit-premium', '2026-10-31-key-forfeit-account', '2026-10-31-key-retiring-partner'];
  assert.equal(keyFixes.reduce((n, id) => n + by[id].count, 0), 3);
  assert.equal(by['2026-10-31-no-right-option'].count + by['2026-10-31-share-premium-numbers'].count + by['2026-10-31-reworded'].count, 31);
  assert.equal(by['2026-10-31-debenture-discount'].count + by['2026-10-31-pulled-flawed'].count, 25);
  // docs/brain/intel-1031/off-syllabus-2026-10-31/list.json: 218 rows.
  const offSyllabus = JSON.parse(read('docs/brain/intel-1031/off-syllabus-2026-10-31/list.json'));
  assert.equal(by['2026-10-31-off-syllabus'].count, offSyllabus.length);
  // data/syllabus/retag-live-2026-10-31.json: 476 moves.
  assert.equal(by['2026-10-31-wrong-chapter'].count, JSON.parse(read('data/syllabus/retag-live-2026-10-31.json')).length);
  // The circular-queue receipt the result page shows (data/answer_corrections.mjs).
  assert.match(read('data/answer_corrections.mjs'), /checkedAt: '2026-10-06'/);
});
