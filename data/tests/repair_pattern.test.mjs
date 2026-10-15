import test from 'node:test';
import assert from 'node:assert/strict';
import { buildRepairPattern, mistakeKeyOf, trapPhrase, PATTERN_RULES } from '../repair_pattern.js';
import { TRAP_LABELS } from '../repair_presentation.mjs';
import { violatesTruthRules, claimsAboutStudent } from '../mistake_repair.js';

// Fixture rows shaped like the findRepairTraps read: newest first, one committed reservation per row.
let seq = 0;
const row = (trap, { subject = 'english', chapter = 'Correct Word Usage', mistake = null } = {}) => {
  seq += 1;
  return { operation_key: `repair:${mistake || `m${seq}`}:req_${String(seq).padStart(16, '0')}`, trap, subject, chapter };
};
const current = (over = {}) => ({ mistakeKey: 'repair:now', trapType: 'look_alike_term', subject: 'english', chapter: 'Correct Word Usage', ...over });
const build = (rows, over = {}, subjectName = 'English') => buildRepairPattern({ rows, current: current(over), subjectName });

test('chapter gate: 3 typed repairs in the chapter, 2 with this trap, the current one counted once', () => {
  assert.deepEqual(build([row('look_alike_term'), row('reversed')]), {
    line: '2 of your 3 repaired mistakes in Correct Word Usage had the same trap: a look-alike term.', scope: 'chapter', k: 2, n: 3, trapType: 'look_alike_term',
  });
  assert.equal(build([row('look_alike_term')]), null, 'n = 2 is below the chapter gate, and too few for the subject');
  assert.equal(build([row('reversed'), row('partly_true')]), null, 'k = 1 is below the chapter gate');
  assert.deepEqual(PATTERN_RULES.chapter, { minRepairs: 3, minSame: 2 });
});

test('subject gate when the chapter gate fails: n >= 5, k >= 3 and k/n >= 0.3', () => {
  const rows = [
    row('look_alike_term', { chapter: 'Vocabulary' }), row('look_alike_term', { chapter: 'Grammar' }),
    row('reversed', { chapter: 'Grammar' }), row('partly_true', { chapter: 'Reading' }),
  ];
  assert.deepEqual(build(rows), { line: '3 of your 5 repaired English mistakes had the same trap: a look-alike term.', scope: 'subject', k: 3, n: 5, trapType: 'look_alike_term' });
  // k = 3 of n = 11 is below 0.3.
  const thin = [...rows, ...Array.from({ length: 6 }, () => row('reversed', { chapter: 'Grammar' }))];
  assert.equal(build(thin), null);
  // k = 2 of n = 5 is below k >= 3.
  assert.equal(build([row('look_alike_term', { chapter: 'Vocabulary' }), row('reversed', { chapter: 'Grammar' }), row('reversed', { chapter: 'Grammar' }), row('partly_true', { chapter: 'Reading' })]), null);
  // Other subjects never count.
  assert.equal(build(rows.map((r) => ({ ...r, subject: 'accountancy' }))), null);
});

test('v1 and v2 rows (no trap type) count in neither the numerator nor the denominator', () => {
  const rows = [row('look_alike_term'), row(null), row(undefined), row(''), row('reversed')];
  assert.deepEqual(build(rows).n, 3);
  assert.equal(build([row('look_alike_term'), row(null), row(null)]), null, 'two untyped rows do not lift n to 3');
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
  assert.match(buildRepairPattern({ rows, current: current({ chapter: 'E' }) }).line, /repaired english mistakes/);
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
    assert.match(out.line, /^\d+ of your \d+ repaired /);
  }
});
