// Review's page reads the body of GET /api/me/review and rebuilds the record for the shared next move (LEARN-REVIEW-1017
// packet P-LR1). The page's move must be the move of the record the server read, on every shared fixture.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { reviewBody, reviewMove, chapterRows, receipt } from '../review_input.mjs';
import { recordFromBody } from '../../src/components/review/reviewRecord.mjs';
import { scopeOf, statsOf, subjectsOf, firstOpen, subjectKey } from '../../src/components/review/reviewScope.mjs';

const fixture = (name) => JSON.parse(readFileSync(new URL(`./fixtures/review/${name}.json`, import.meta.url), 'utf8'));
const NAMES = ['student', 'check_pending', 'zero_credits', 'all_held', 'one_paper', 'revise_dedupe', 'nothing_missed'];

for (const name of NAMES) {
  test(`Review page: the body rebuilt gives the same move, chapters and receipt (${name})`, () => {
    const record = fixture(name);
    const body = JSON.parse(JSON.stringify(reviewBody(record)));
    const rebuilt = recordFromBody(body);
    assert.deepEqual(reviewMove(rebuilt), reviewMove(record));
    assert.deepEqual(chapterRows(rebuilt), chapterRows(record));
    assert.deepEqual(receipt(rebuilt), receipt(record));
  });
}

test('Review page: the design student opens on Repair Q42 in Mock 3, and every row names its paper and 12-hour time', () => {
  const body = reviewBody(fixture('student'));
  const move = reviewMove(recordFromBody(body));
  assert.equal(move.label, 'Repair Q42');
  assert.equal(move.target.attemptId, 'm3');
  for (const item of body.items) assert.match(item.stamp, /^(Mock \d|Quick practice), \d{1,2} [A-Z][a-z]{2}, \d{1,2}:\d{2} (AM|PM)$/);
  // A repaired, held or slipped mistake is never repairable (it opens its saved repair, free: F17).
  for (const item of body.items) if (['repaired', 'held', 'slipped'].includes(item.state)) assert.equal(item.repairable, false);
});

test('Review page: a failed read and an empty account never rebuild into a ready record', () => {
  assert.equal(recordFromBody(reviewBody(fixture('record_down'))), null);
  assert.equal(recordFromBody(reviewBody(fixture('empty'))).state, 'empty');
});

// ---------- 19 Oct 2026 (owner G25, D106): the stats strip, the subject filter, papers first ----------
// "At the top, it's not showing the core statistics like it used to show ... Nothing left to repair, then so many questions
// ... then chapters." The strip, the rows and the chapters must agree on every fixture and in every subject.

const ONE_1018 = (() => {
  const s = fixture('student-1018');
  return { ...s, papers: s.papers.filter((p) => p.id === 'm3'), items: s.items.filter((i) => i.paper === 'm3'), chapterQuestions: { m3: s.chapterQuestions.m3 } };
})();

for (const [name, record] of [['student-1018', fixture('student-1018')], ['one paper (fresh account, 1018)', ONE_1018]]) {
  test(`G25 Review strip: the figures agree with the papers, the chapters and Saved repairs, in every subject (${name})`, () => {
    const body = JSON.parse(JSON.stringify(reviewBody(record)));
    const subjects = subjectsOf(body.papers, ['accountancy', 'economics', 'business_studies', 'english']);
    for (const subject of ['all', ...subjects.map((x) => x.id)]) {
      const scope = scopeOf(body, subject, subjects.find((x) => x.id === subject)?.name || '');
      const stats = statsOf(scope);
      assert.equal(stats.papers, scope.papers.length, `${subject}: papers sat = the rows under Your papers`);
      assert.equal(stats.toRepair, scope.rows.reduce((t, r) => t + r.open.length, 0), `${subject}: to repair = the chapters' "N mistakes to repair"`);
      assert.equal(stats.repaired, scope.saved.length, `${subject}: repaired = the Saved repairs count`);
      assert.equal(stats.latest, scope.papers.length ? scope.papers[0].score : null, `${subject}: latest marks = the first row`);
      for (const p of scope.papers) assert.equal(subject === 'all' || subjectKey(p.subject) === subject, true);
      for (const r of scope.rows) assert.equal(subject === 'all' || subjectKey(r.subject) === subject, true);
      // The chapters still add up to their papers' lost marks inside a subject.
      assert.equal(scope.line.lost, scope.rows.reduce((t, r) => t + r.lost, 0));
    }
    // All subjects is the server's own head line.
    assert.deepEqual(scopeOf(body, 'all').line, body.lose.line);
  });
}

test('G25 Review strip: the latest marks name the paper and the change on the one before, in words', () => {
  const body = reviewBody(fixture('student-1018'));
  const all = statsOf(scopeOf(body, 'all'));
  assert.equal(all.latest, 158);
  assert.equal(all.latestNote, 'Mock 3, Accountancy');
  assert.deepEqual(all.trend, { dir: 'up', text: 'Up 18 marks on Mock 2' });
  assert.equal(all.papersNote, '2 full mocks, 1 practice set');
  const one = statsOf(scopeOf(reviewBody(ONE_1018), 'all'));
  assert.deepEqual(one.trend, { dir: 'first', text: 'Your first full mock in Accountancy' });
  const none = statsOf(scopeOf(reviewBody(fixture('student-1018')), 'english', 'English'), 'English');
  assert.equal(none.papers, 0);
  assert.equal(none.latest, null);
  assert.equal(none.papersNote, 'No English papers yet');
  assert.equal(none.toRepairNote, 'No mistakes yet');
});

test('G25 Review: the subject filter lists subjects with papers first, newest first, then the rest of the student\'s subjects', () => {
  const body = reviewBody(fixture('student-1018'));
  const subjects = subjectsOf(body.papers, ['accountancy', 'economics', 'business_studies', 'english']);
  assert.deepEqual(subjects.map((x) => [x.id, x.n]), [['accountancy', 2], ['business_studies', 1], ['economics', 0], ['english', 0]]);
});

test('G25 Review: a chapter opens on arrival only when it has a mistake to repair', () => {
  const body = reviewBody(fixture('student-1018'));
  assert.equal(firstOpen(body.lose.rows), body.lose.rows.find((r) => r.open.length).id);
  const repaired = body.lose.rows.map((r) => ({ ...r, open: [] }));
  assert.equal(firstOpen(repaired), null, 'never a chapter whose header reads "Nothing left to repair"');
});

test('G25 Review page order (D106): the strip, the subject filter, Your papers, then Mistakes to repair', () => {
  const page = readFileSync(new URL('../../src/components/review/ReviewChapters.jsx', import.meta.url), 'utf8');
  const render = page.slice(page.indexOf('export default function ReviewChapters('));
  const at = (piece) => { const i = render.indexOf(piece); assert.ok(i > 0, `${piece} is rendered`); return i; };
  assert.ok(at('<StatsStrip') < at('<SubjectFilter') && at('<SubjectFilter') < at('<PapersList') && at('<PapersList') < at('<WeakChapters'));
  assert.match(page, /<h2 id="rv8-wk-h">Mistakes to repair<\/h2>/);
  assert.match(page, /return firstOpen\(scope\.rows\);/, 'the chapter that opens on arrival has a mistake to repair');
  assert.match(page, /useRailCue\(rowRef, \{ items: '\.rv8-chip'/, 'the filter has the sideways-scroll cue');
  const css = readFileSync(new URL('../../src/components/review/review-1018.css', import.meta.url), 'utf8');
  assert.match(css, /\.rv8-board > \.rv8-main \{ grid-column: 1; grid-row: 1; \}/);
});
