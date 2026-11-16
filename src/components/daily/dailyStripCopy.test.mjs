// node --test src/components/daily/dailyStripCopy.test.mjs
// The home page's Daily Five and Sunday Mock strip (dailyStripCopy.mjs, DailyFiveRow.jsx HomeStrip, 16 Nov 2026 evening):
// what each row says in each state, that the paper's numbers are the rule's own, where the strip stands on the page (low,
// never under the hero's sample again) and that the day's number is gone.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { DAILY_LINE, STRIP_HEAD, SUNDAY_LINE, dailyRow, sundayRow, waitWords } from './dailyStripCopy.mjs';
import { PAPER_COUNT, PAPER_MINUTES } from '../../lib/sundayMock.mjs';

const read = (rel) => readFileSync(new URL(rel, import.meta.url), 'utf8').replace(/\r\n/g, '\n');
const HOUR = 60 * 60 * 1000;

test('the Daily Five row: open, begun and played each say what, when and where the tap goes', () => {
  const open = dailyRow({ waitMs: 5 * HOUR + 50 * 60 * 1000 });
  assert.deepEqual(open, { state: 'open', line: DAILY_LINE, when: 'Closes in 5 h 50 min', go: 'Play today’s five' });
  const begun = dailyRow({ begun: true, waitMs: HOUR });
  assert.equal(begun.state, 'begun');
  assert.equal(begun.go, 'Continue');
  assert.match(begun.line, /Your answers are kept\.$/);
  const played = dailyRow({ result: { score: 4, clock: '1:32' }, streak: 3, waitMs: 2 * HOUR });
  assert.deepEqual(played, { state: 'played', line: 'You scored 4/5 in 1:32. Day 3 in a row.', when: 'Next five in 2 h', go: 'See your result' });
  assert.equal(dailyRow({ result: { score: 5, clock: '0:58' }, streak: 1, waitMs: HOUR }).line, 'You scored 5/5 in 0:58.');
  assert.equal(dailyRow({}).when, '', 'no clock read yet: no time is claimed');
});

test('the row says which papers the five come from, in plain words', () => {
  assert.match(DAILY_LINE, /^Five questions from English and the General Test, the same five for everyone today\./);
  assert.match(DAILY_LINE, /No sign-up\.$/);
});

test('the Sunday Mock row: the paper is the rule’s own numbers; open today or the wait in days', () => {
  assert.ok(SUNDAY_LINE.includes(`${PAPER_COUNT} questions in ${PAPER_MINUTES} minutes`));
  assert.match(SUNDAY_LINE, /Free with an account\.$/);
  assert.equal(sundayRow({ open: true }).when, 'Open today until 10:00 pm');
  assert.equal(sundayRow({ waitMs: 5 * 24 * HOUR + 3 * HOUR }).when, 'Opens in 5 days');
  assert.equal(sundayRow({ waitMs: 24 * HOUR + 1 }).when, 'Opens in 1 day');
  assert.equal(sundayRow({ waitMs: 3 * HOUR + 20 * 60 * 1000 }).when, 'Opens in 3 h 20 min');
  assert.equal(sundayRow({ known: false }).when, '');
  assert.equal(waitWords(0), 'under a minute');
});

test('no exclamation marks, arrows, ranks or day numbers in any state', () => {
  const all = JSON.stringify([STRIP_HEAD, dailyRow({ waitMs: HOUR }), dailyRow({ begun: true, waitMs: HOUR }), dailyRow({ result: { score: 3, clock: '2:00' }, streak: 2, waitMs: HOUR }), sundayRow({ open: true }), sundayRow({ waitMs: HOUR })]);
  assert.doesNotMatch(all, /!|→|->|\bNo\. \d|\b(rank|percentile)\b/i);
});

test('the strip stands low on the home page, after the exam screen, and the sample card no longer carries it', () => {
  const page = read('../../app/page.js');
  const strip = page.indexOf('id="daily-and-sunday"');
  assert.ok(strip > page.indexOf('<ExamScreen />'), 'after the exam screen');
  assert.ok(strip < page.indexOf('id="compass"'), 'before admissions');
  const sample = page.slice(page.indexOf('id="try"'), page.indexOf('<Statement'));
  assert.doesNotMatch(sample, /DailyFiveRow/, 'not under the sample');
  assert.equal((page.match(/<DailyFiveRow where="home" \/>/g) || []).length, 1);
});

test('the day’s number is shown nowhere: not on the strip, not on Today’s row, not on /daily', () => {
  for (const file of ['./DailyFiveRow.jsx', './DailyFive.jsx']) assert.doesNotMatch(read(file), /No\. \{|`No\. \$\{/, file);
});
