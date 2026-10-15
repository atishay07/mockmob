// Across your mocks (data/across_mocks.js; spec tmp/mistake-lab-v4/SPEC.md 4.9). Fixtures: build-s3-fixtures.mjs.
import test from 'node:test';
import assert from 'node:assert/strict';
import { buildAcrossMocks, mockRecord, timedMocks, changeCounts, countList, ACROSS_RULES } from '../across_mocks.js';
import { LAB_COPY } from '../mistake_lab.js';
import { mock, S3 } from '../../scripts/mistake-lab/build-s3-fixtures.mjs';

const { M1, M2, M3, M4, PRACTICE } = S3;
const HISTORY = [M4, PRACTICE, M3, M2, M1];
const allLines = (out) => [...out.lines, ...out.more];
const line = (out, id, subject = null) => allLines(out).find((l) => l.id === id && (subject === null || l.subject === subject));

test('only Full and NTA mocks with a device record count; a practice set and an inconsistent record never do', () => {
  assert.equal(mockRecord(PRACTICE), null);
  const bad = structuredClone(M3);
  bad.selectionMeta.recovery.telemetry = 'inconsistent';
  assert.equal(mockRecord(bad), null);
  const device = structuredClone(M3);
  device.selectionMeta.scoringVersion = undefined;
  assert.equal(mockRecord(device), null);
  assert.deepEqual(timedMocks(HISTORY).map((m) => m.id), ['m4', 'm3', 'm2', 'm1']);
  assert.equal(buildAcrossMocks({ attempts: [...HISTORY, bad] }).mocks, 4);
});

test('second thoughts: the counts and marks equal a hand count from the scorer\'s own answer changes', () => {
  const out = buildAcrossMocks({ attempts: HISTORY });
  // Independent count: every scorer change from one option to another (clears and re-picks left out).
  const changes = [M1, M2, M3, M4].flatMap((a) => a.selectionMeta.recovery.observed.answerChanges).filter((c) => c.before !== null && c.after !== null);
  const toRight = changes.filter((c) => c.markEffect === 6).length;
  const toWrong = changes.filter((c) => c.markEffect === -6).length;
  const wrongWrong = changes.filter((c) => c.markEffect === 0).length;
  assert.equal(toRight + toWrong + wrongWrong, changes.length);
  const c = changeCounts(timedMocks(HISTORY));
  assert.deepEqual([c.total, c.toRight, c.toWrong, c.wrongWrong], [changes.length, toRight, toWrong, wrongWrong]);
  const net = 6 * toRight - 6 * toWrong;
  const expected = `Across 4 timed mocks: ${changes.length} changes from one option to another. ${toRight} wrong to right (+${6 * toRight}), ${toWrong} right to wrong (−${6 * toWrong}), ${wrongWrong} between two wrong options (0). Net ${net > 0 ? '+' : net < 0 ? '−' : ''}${Math.abs(net)} marks.`;
  assert.equal(line(out, 'second_thoughts').text, expected);
  assert.equal(line(out, 'second_thoughts').marks, 6 * toWrong, 'ranked by the marks the right-to-wrong changes lost');
});

test('never opened: per subject, its last 3 mocks oldest first; a subject with one mock gets no line', () => {
  const out = buildAcrossMocks({ attempts: HISTORY });
  const acc = line(out, 'never_opened', 'accountancy');
  const counts = [M1, M3, M4].map((a) => a.questionsSnapshot.filter((q) => !a.selectionMeta.recovery.timeline.some((e) => e.qid === q.id)).length);
  assert.equal(acc.text, `Never opened, last 3 Accountancy mocks, oldest first: ${counts[0]}, ${counts[1]} and ${counts[2]} of 50.`);
  assert.equal(acc.marks, 5 * counts.reduce((s, n) => s + n, 0));
  assert.equal(line(out, 'never_opened', 'economics'), undefined, 'one Economics mock is not a pattern across mocks');
  assert.equal(countList([{ n: 9, total: 50 }, { n: 7, total: 40 }]), '9 of 50 and 7 of 40');
  assert.equal(countList([{ n: 9, total: 50 }, { n: 7, total: 50 }, { n: 6, total: 50 }]), '9, 7 and 6 of 50');
});

test('long stays use the ledger\'s own 2-minute band on time under the one rule', () => {
  const recs = timedMocks(HISTORY);
  const long = recs.flatMap((m) => m.rows.filter((r) => r.ms !== null && r.ms >= 120000));
  const right = long.filter((r) => r.outcome === 'right').length;
  const out = buildAcrossMocks({ attempts: HISTORY });
  assert.equal(line(out, 'long_stays').text, `Across 4 timed mocks, ${long.length} questions took 2 minutes or more. ${right} of them were right.`);
  assert.equal(line(out, 'long_stays').marks, long.reduce((s, r) => s + r.lost, 0));
});

test('the gates are sentences: 1 mock, none, changes of each kind, the last 10 minutes', () => {
  const none = buildAcrossMocks({ attempts: [PRACTICE] });
  assert.equal(none.state, 'none');
  assert.equal(none.message, LAB_COPY.across.none);
  const one = buildAcrossMocks({ attempts: [M1, PRACTICE] });
  assert.equal(one.state, 'below_gate');
  assert.equal(one.message, 'Across your mocks opens at 2 timed mocks with a device record. You have 1.');
  assert.deepEqual([one.lines, one.more, one.basis], [[], [], null]);

  const two = buildAcrossMocks({ attempts: [M1, M3] });
  const help = line(two, 'changes_help');
  const c = changeCounts(timedMocks([M1, M3]));
  assert.ok(c.later.n < ACROSS_RULES.helpMin || c.same.n < ACROSS_RULES.helpMin);
  assert.equal(help.gated, true);
  assert.equal(help.text, `Changes on a later visit against changes without leaving the question: this comparison opens at 8 of each. You have ${c.later.n} and ${c.same.n}.`);
  const ten = line(two, 'last_ten');
  assert.equal(ten.gated, true);
  assert.match(ten.text, /^Last 10 minutes against the rest of the paper opens at 3 timed mocks with 20 answers on each side\. You have 2 timed mocks, with \d+ answers in the last 10 minutes and \d+ before\.$/);
  // Gated lines carry no marks and sort after every measured line.
  const all = allLines(two);
  const firstGated = all.findIndex((l) => l.gated);
  assert.ok(firstGated === -1 || all.slice(firstGated).every((l) => l.gated && l.marks === 0));
});

test('the last 10 minutes counts each answer where its final pick was made, against the paper\'s own limit', () => {
  const recs = timedMocks(HISTORY);
  let late = 0, lateRight = 0, early = 0, earlyRight = 0;
  for (const m of recs) for (const r of m.rows) {
    if (r.given === null || r.finalAt === null) continue;
    if (r.finalAt >= m.paperMs - 600000) { late++; if (r.outcome === 'right') lateRight++; } else { early++; if (r.outcome === 'right') earlyRight++; }
  }
  assert.ok(late >= 20 && early >= 20, 'the fixture passes the gate');
  const out = buildAcrossMocks({ attempts: HISTORY });
  assert.equal(line(out, 'last_ten').text, `Last 10 minutes, across 4 timed mocks: ${lateRight} right of ${late} answered. First 50 minutes: ${earlyRight} right of ${early}.`);
  // Every answered question is on one side or the other.
  const answered = recs.flatMap((m) => m.rows.filter((r) => r.given !== null)).length;
  assert.equal(late + early, answered);
});

test('ranked by marks lost: at most 3 shown, the rest behind Show all; asOf reads the record as it stood', () => {
  const out = buildAcrossMocks({ attempts: HISTORY });
  assert.equal(out.lines.length, 3);
  const all = allLines(out);
  for (let i = 1; i < all.length; i++) if (!all[i].gated && !all[i - 1].gated) assert.ok(all[i - 1].marks >= all[i].marks);
  assert.equal(out.showAll, `Show all ${all.length}`);
  const then = buildAcrossMocks({ attempts: HISTORY, asOf: M3.completedAt });
  assert.equal(then.mocks, 3, 'the paper read on an old result page counts only the mocks up to it');
  // A window of 10: an 11th older mock is left out.
  const many = Array.from({ length: 11 }, (_, i) => mock({ id: `w${i}`, day: -20 + i, plan: { 5: 'kw' } }));
  assert.equal(buildAcrossMocks({ attempts: many }).mocks, 10);
});

test('every across string keeps the copy rules: no "!", em dash or middle dot, and the minus sign for minus marks', () => {
  const strings = (v, out = []) => { if (typeof v === 'string') out.push(v); else if (v && typeof v === 'object') Object.values(v).forEach((x) => strings(x, out)); return out; };
  const texts = [...strings(LAB_COPY.across), ...strings(buildAcrossMocks({ attempts: HISTORY })), ...strings(buildAcrossMocks({ attempts: [M1, M3] }))];
  for (const s of texts) {
    assert.ok(!/[!—·]/.test(s), s);
    assert.ok(!/\(-\d/.test(s) && !/ -\d/.test(s), `hyphen used as a minus: ${s}`);
    assert.ok(!/\b(would|could) have\b|\bpotential\b|\brushed\b|\boverthink/i.test(s), s);
  }
});
