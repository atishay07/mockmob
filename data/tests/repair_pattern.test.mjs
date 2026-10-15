import test from 'node:test';
import assert from 'node:assert/strict';
import { buildRepairPattern, mistakeKeyOf, trapPhrase, PATTERN_RULES } from '../repair_pattern.js';
import { TRAP_LABELS } from '../repair_presentation.mjs';
import { istDayMonth } from '../attempt_ledger.js';
import { violatesTruthRules, claimsAboutStudent } from '../mistake_repair.js';

// Fixture rows shaped like the findRepairTraps read: newest first, one committed reservation per row. Each row is a
// day older than the one before it, from 14 Oct back (India time, noon), unless a date is given.
const NOW = Date.parse('2026-10-15T06:30:00Z'); // 15 Oct, 12:00 in India
const DAY = 86_400_000;
let seq = 0;
const row = (trap, { subject = 'english', chapter = 'Correct Word Usage', mistake = null, at = null } = {}) => {
  seq += 1;
  return { operation_key: `repair:${mistake || `m${seq}`}:req_${String(seq).padStart(16, '0')}`, trap, subject, chapter, created_at: at ?? new Date(NOW - seq * DAY).toISOString() };
};
const fresh = () => { seq = 0; };
const current = (over = {}) => ({ mistakeKey: 'repair:now', trapType: 'look_alike_term', subject: 'english', chapter: 'Correct Word Usage', at: NOW, ...over });
const build = (rows, over = {}, subjectName = 'English') => buildRepairPattern({ rows, current: current(over), subjectName });
const strip = (out) => (out ? { line: out.line, scope: out.scope, k: out.k, n: out.n, trapType: out.trapType } : out);

test('chapter gate: 3 typed repairs in the chapter, 2 with this trap, the current one counted once, dated from the earliest', () => {
  fresh();
  const out = build([row('look_alike_term'), row('reversed')]);
  assert.deepEqual(strip(out), {
    line: 'Since 13 Oct, 2 of your 3 repairs in Correct Word Usage had this trap.', scope: 'chapter', k: 2, n: 3, trapType: 'look_alike_term',
  });
  assert.equal(out.since, NOW - 2 * DAY, 'the earliest counted repair, not the newest');
  assert.equal(build([row('look_alike_term')]), null, 'n = 2 is below the chapter gate, and too few for the subject');
  assert.equal(build([row('reversed'), row('partly_true')]), null, 'k = 1 is below the chapter gate');
  assert.deepEqual(PATTERN_RULES.chapter, { minRepairs: 3, minSame: 2 });
});

test('subject gate when the chapter gate fails: n >= 5, k >= 3 and k/n >= 0.3', () => {
  const rows = [
    row('look_alike_term', { chapter: 'Vocabulary' }), row('look_alike_term', { chapter: 'Grammar' }),
    row('reversed', { chapter: 'Grammar' }), row('partly_true', { chapter: 'Reading' }),
  ];
  assert.deepEqual(strip(build(rows)), { line: `Since ${istDayMonth(Date.parse(rows[3].created_at))}, 3 of your 5 repairs in English had this trap.`, scope: 'subject', k: 3, n: 5, trapType: 'look_alike_term' });
  // k = 3 of n = 11 is below 0.3.
  const thin = [...rows, ...Array.from({ length: 6 }, () => row('reversed', { chapter: 'Grammar' }))];
  assert.equal(build(thin), null);
  // k = 2 of n = 5 is below k >= 3.
  assert.equal(build([row('look_alike_term', { chapter: 'Vocabulary' }), row('reversed', { chapter: 'Grammar' }), row('reversed', { chapter: 'Grammar' }), row('partly_true', { chapter: 'Reading' })]), null);
  // Other subjects never count.
  assert.equal(build(rows.map((r) => ({ ...r, subject: 'accountancy' }))), null);
});

test('v1 and v2 rows (no trap type) count in neither the numerator nor the denominator, and fall before the date', () => {
  fresh();
  const rows = [row('look_alike_term'), row('reversed'), row(null, { subject: null, chapter: null }), row(undefined), row('')];
  const out = build(rows);
  assert.equal(out.n, 3);
  assert.equal(out.line, 'Since 13 Oct, 2 of your 3 repairs in Correct Word Usage had this trap.', 'the older untyped repairs are before 13 Oct, outside the claim');
  assert.equal(build([row('look_alike_term'), row(null), row(null)]), null, 'two untyped rows do not lift n to 3');
});

test('the line is literally true: an untyped repair inside the dated period that could be in scope means no line', () => {
  fresh();
  // A rollback to the v1 prompt between two typed repairs: the count since the earliest would not be whole.
  assert.equal(build([row('look_alike_term'), row(null, { subject: null, chapter: null }), row('reversed')]), null, 'v1 row with no subject, inside the period');
  fresh();
  assert.equal(build([row('look_alike_term'), row(null), row('reversed')]), null, 'untyped row in this chapter, inside the period');
  fresh();
  assert.equal(build([row('look_alike_term'), row(null, { chapter: null }), row('reversed')]), null, 'untyped row in this subject with no chapter');
  fresh();
  const elsewhere = [row('look_alike_term'), row(null, { subject: 'accountancy', chapter: 'Partnership' }), row('reversed')];
  assert.equal(build(elsewhere).line, 'Since 12 Oct, 2 of your 3 repairs in Correct Word Usage had this trap.', 'an untyped repair in another subject does not touch this count');
  fresh();
  const otherChapter = [row('look_alike_term'), row(null, { chapter: 'Grammar' }), row('reversed')];
  assert.equal(build(otherChapter).scope, 'chapter', 'an untyped repair in another chapter does not touch the chapter count');
  // A typed repair with no subject stored is not known to be outside the scope either.
  fresh();
  assert.equal(build([row('look_alike_term'), row('reversed', { subject: '' }), row('reversed')]), null);
});

test('no date, no line: a counted repair without a date, or no date for this repair', () => {
  fresh();
  assert.equal(build([row('look_alike_term'), { ...row('reversed'), created_at: null }]), null);
  fresh();
  const rows = [row('look_alike_term'), row('reversed')];
  assert.equal(build(rows, { at: undefined }), null, 'no date for this repair and no stored row of it');
  // A saved repair reopened without its own date is dated by its stored row.
  const withOwnRow = [...rows, { operation_key: 'repair:now:req_0000000000000099', trap: 'look_alike_term', subject: 'english', chapter: 'Correct Word Usage', created_at: new Date(NOW - 9 * DAY).toISOString() }];
  assert.equal(build(withOwnRow, { at: undefined }).line, 'Since 6 Oct, 2 of your 3 repairs in Correct Word Usage had this trap.');
  assert.equal(build(withOwnRow, { at: '2026-10-15T06:30:00.000Z' }).n, 3, 'an ISO generatedAt is read too');
});

test('a current trap of other never makes a line, nor does a missing one; an "other" row still counts in n', () => {
  assert.equal(build([row('other'), row('other'), row('other')], { trapType: 'other' }), null);
  assert.equal(build([row('look_alike_term'), row('look_alike_term')], { trapType: null }), null);
  assert.equal(build([row('look_alike_term'), row('look_alike_term')], { trapType: 'made_up' }), null);
  assert.deepEqual(build([row('look_alike_term'), row('other')]).n, 3);
});

test('the current mistake is removed from the rows and counted once; rows are one per mistake', () => {
  const rows = [
    row('look_alike_term', { mistake: 'now' }), row('look_alike_term', { mistake: 'now' }), // this mistake, stored earlier
    row('look_alike_term', { mistake: 'x' }), row('look_alike_term', { mistake: 'x' }), // the same other mistake twice
  ];
  assert.equal(build(rows), null, 'n is 2: this repair once and one other mistake once');
  const three = [...rows, row('reversed')];
  assert.deepEqual([build(three).k, build(three).n], [2, 3]);
  assert.equal(mistakeKeyOf('repair:abc123:req_0123456789abcdef'), 'repair:abc123');
  assert.equal(mistakeKeyOf(''), '');
});

test('an unmapped or missing chapter skips the chapter scope and still allows the subject scope', () => {
  const rows = Array.from({ length: 4 }, (_, i) => row(i < 2 ? 'look_alike_term' : 'reversed', { chapter: 'Unmapped chapter' }));
  const out = build(rows, { chapter: 'Unmapped chapter' });
  assert.equal(out.scope, 'subject');
  assert.doesNotMatch(out.line, /Unmapped/);
  assert.equal(build(rows.slice(0, 2), { chapter: '' }), null);
});

test('the subject id stands in when no display name is known; bad input gives null, never a throw', () => {
  const rows = [row('look_alike_term', { chapter: 'A' }), row('look_alike_term', { chapter: 'B' }), row('reversed', { chapter: 'C' }), row('reversed', { chapter: 'D' })];
  assert.match(buildRepairPattern({ rows, current: current({ chapter: 'E' }) }).line, /repairs in english had this trap\.$/);
  assert.equal(buildRepairPattern({ rows: null, current: current() }), null);
  assert.equal(buildRepairPattern({}), null);
  assert.equal(buildRepairPattern({ rows: [null, 7, 'x'], current: current() }), null);
});

test('every trap phrase reads in lower case after the colon, and every line is plain and truthful', () => {
  assert.equal(trapPhrase('missed_not_except'), 'a missed NOT or EXCEPT');
  assert.equal(trapPhrase('reversed'), 'the relation turned around');
  assert.equal(trapPhrase('nope'), null);
  for (const type of Object.keys(TRAP_LABELS).filter((t) => t !== 'other')) {
    const out = build([row(type), row('reversed')], { trapType: type });
    assert.ok(out, type);
    assert.doesNotMatch(out.line, /[!—–·]/, type);
    assert.equal(violatesTruthRules(out.line), false, type);
    assert.equal(claimsAboutStudent(out.line), false, type);
    assert.match(out.line, /^Since \d{1,2} (?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec), \d+ of your \d+ repairs in .+ had this trap\.$/);
  }
});
