// One next move on three pages (LEARN-REVIEW-1017 section 7, packet P-LR0, acceptance check 5): the result page, Today and
// Review must name the same kind, target and key for one paper. Review has no move builder of its own: it feeds the result
// page's own nextMove() (data/result_next_move.mjs), so the first block is a real equality. Today's move (src/lib/today/move.mjs,
// TODAY-1017 4.2) is built by its own rules and names a BATCH ("12 mistakes to repair", key "Start repair", the result page of
// the paper), not a first question ("Repair Q42"). That cannot be made equal from here without changing Today's wording
// (LEARN-REVIEW-1017 12, flag 2), so the Today block asserts what does agree (kind, and the paper the key opens) and records
// the rest as KNOWN GAPS: node:test `todo` tests that state the equality we want and fail today. They are not faked green.
// When Today's key names the first target (for example "Start repair: Q42 first"), remove `todo` and they must pass.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { analysisFromRows, nextMove } from '../result_next_move.mjs';
import { paperRepairOrder } from '../result_papers.mjs';
import { reviewCounts, reviewMove } from '../review_input.mjs';
import { buildMove } from '../../src/lib/today/move.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const load = (path) => JSON.parse(readFileSync(resolve(here, 'fixtures', path), 'utf8'));
const onePaper = load('review/one_paper.json');
const resultAvg = load('result_next_move/avg.json'); // the same paper, as the result page's tests read it
const student = load('review/student.json');

// The result page's move for the paper, exactly as ResultPageClient builds it (analysis from the rows, repair order from the Lab).
function resultMove(input = resultAvg.input) {
  const analysis = analysisFromRows(input.rows);
  return nextMove({ ...input, analysis, repaired: new Set(input.repaired || []), repairOrder: input.repairOrder });
}

// Today's move for the same paper: one saved paper with its open mistakes, nothing repaired yet, the first week over.
function todayMove(paper = onePaper.papers[0]) {
  const now = Date.parse(onePaper.now);
  return buildMove({
    papers: [{ id: paper.id, subject: paper.subject, mode: paper.mode, correct: paper.right, wrong: paper.wrong, unattempted: paper.blank, total: paper.questions, completedAt: Date.parse(paper.at) }],
    rhythm: { counts: { sessions: 3, repairs: 0 }, milestones: [], daysSinceLastActivity: 0 },
    facts: { sessions: 3, mocks: 1 },
    repaired: new Map(), subjectName: () => 'Accountancy', now,
  });
}
// Today's move ids that are a repair of mistakes on a paper, read as the shared kind.
const todayKind = (move) => (['repair', 'firstRepair', 'returning'].includes(move?.id) && move.open > 0 ? 'repair' : move?.id === 'check' ? 'check' : null);

test('the result page and Review name the same move on one paper: kind, rule, key, target, price and the alternative', () => {
  const result = resultMove();
  const review = reviewMove(onePaper);
  assert.equal(result.kind, 'repair');
  assert.equal(result.label, 'Repair Q42');
  assert.equal(review.kind, result.kind);
  assert.equal(review.rule, result.rule);
  assert.equal(review.label, result.label);
  assert.equal(review.value, result.value);
  assert.equal(review.cost, result.cost);
  assert.equal(review.note, result.note);
  assert.deepEqual({ qid: review.target.qid, number: review.target.number, chapter: review.target.chapter }, { qid: result.target.qid, number: result.target.number, chapter: result.target.chapter });
  assert.equal(review.alt.label, result.alt.label);
  assert.equal(review.alt.target.href, result.alt.target.href);
  assert.equal(review.target.attemptId, onePaper.papers[0].id);
});

test('the result page and Review agree on every shared paper rule: practise, repair, check, harder', () => {
  // The result fixtures are papers of one attempt; each becomes a one-paper Review record through the same rows.
  const cases = ['weak', 'avg', 'strong', 'zero_credits', 'all_repaired', 'perfect', 'blank', 'practice5'];
  for (const name of cases) {
    const { input } = load(`result_next_move/${name}.json`);
    const result = resultMove(input);
    const letters = 'ABCD';
    const chapters = [...new Set(input.rows.map((r) => r.chapter))].map((n, i) => ({ id: `c${i}`, name: n, subject: input.subject, subjectName: input.subjectName }));
    const id = (n) => chapters.find((c) => c.name === n).id;
    const wrong = input.rows.filter((r) => r.verdict === 'wrong').length;
    const blank = input.rows.filter((r) => r.verdict === 'skipped').length;
    const right = input.rows.length - wrong - blank;
    const repaired = new Set(input.repaired || []);
    const record = {
      now: onePaper.now, wallet: { aiCredits: input.aiCredits, practiceCredits: input.practiceCredits, isPremium: input.isPremium, aiRenews: '2026-11-01' },
      papers: [{ id: 'p1', name: 'Mock 1', subject: input.subject, subjectName: input.subjectName, kind: 'full mock', mode: input.mode, at: '2026-10-17T20:30:00+05:30', questions: input.rows.length, right, wrong, blank, score: right * 5 - wrong, of: input.rows.length * 5 }],
      chapters,
      items: input.rows.filter((r) => r.verdict !== 'correct').map((r) => ({
        paper: 'p1', q: r.number, qid: r.qid, ch: id(r.chapter), state: r.verdict === 'skipped' ? 'blank' : input.answerReviews?.[r.qid] ? 'open' : repaired.has(r.qid) ? 'repaired' : 'open',
        ...(r.verdict === 'wrong' ? { pick: letters[r.givenIndex] } : {}), ...(input.answerReviews?.[r.qid] ? { keyState: input.answerReviews[r.qid].state } : {}), stem: 's',
      })),
      repairOrder: input.repairOrder?.qids?.map((q) => `p1:${q}`),
    };
    const review = reviewMove(record, { hour: input.hour });
    assert.equal(review.kind, result.kind, name);
    assert.equal(review.label, result.label, name);
    assert.equal(review.rule, result.rule, name);
    assert.equal(review.cost, result.cost, name);
    assert.equal(review.target.qid ?? null, result.target.qid ?? null, name);
    assert.equal(review.target.chapter ?? null, result.target.chapter ?? null, name);
  }
});

test('Review on the design student: Repair Q42 in Mock 3; with 0 AI credits, Practise 10 on the costliest chapter', () => {
  const move = reviewMove(student);
  assert.equal(move.kind, 'repair');
  assert.equal(move.target.uid, 'm3:42');
  assert.equal(move.label, 'Repair Q42');
  const zero = reviewMove({ ...student, wallet: { ...student.wallet, aiCredits: 0 } });
  assert.equal(zero.kind, 'practise');
  assert.equal(zero.label, 'Practise 10 on Admission of a partner');
});

test('Today and Review agree on the kind of move and on the paper the key opens (one paper, open mistakes)', () => {
  const today = todayMove();
  const review = reviewMove(onePaper);
  assert.equal(todayKind(today), review.kind, 'both say repair');
  assert.equal(today.key.href, `/result/${review.target.attemptId}`, 'the key opens the paper the first mistake is in');
  assert.equal(today.open, 12);
});

// ---- KNOWN GAPS (LEARN-REVIEW-1017 12, flag 2). Each states the equality we want. They fail today, and are todo, not faked. ----
test('KNOWN GAP: Today\'s key names the same first target as Review ("Repair Q42"), not a batch ("Start repair")', { todo: 'TODAY-1017 repairs a batch; the TODAY owner decides the wording, for example "Start repair: Q42 first"' }, () => {
  const today = todayMove();
  const review = reviewMove(onePaper);
  assert.match(today.key.label, /Q42/);
  assert.equal(today.target?.qid, review.target.qid);
});

test('KNOWN GAP: Today\'s move carries the first target\'s number and chapter', { todo: 'src/lib/today/move.mjs repairMove has no target: it only knows the paper and the open count' }, () => {
  const today = todayMove();
  const review = reviewMove(onePaper);
  assert.equal(today.target?.number, review.target.number);
  assert.equal(today.target?.chapter, review.target.chapter);
});

test('KNOWN GAP: on a paper with saved repairs Today still counts "paper wrong less repaired" on the newest paper only', { todo: 'Today reads one paper; Review reads the open set across papers, so their counts can differ once a second paper has open mistakes' }, () => {
  // Two papers with open mistakes: Review's open set is across both, Today's move counts the newest paper's only.
  const today = buildMove({
    papers: [
      { id: 'm3', subject: 'accountancy', mode: 'full', correct: 34, wrong: 12, unattempted: 4, total: 50, completedAt: Date.parse('2026-10-16T21:40:00+05:30') },
      { id: 'm2', subject: 'accountancy', mode: 'full', correct: 31, wrong: 15, unattempted: 4, total: 50, completedAt: Date.parse('2026-10-12T22:42:00+05:30') },
    ],
    rhythm: { counts: { sessions: 3, repairs: 2 }, daysSinceLastActivity: 0 }, facts: { sessions: 3, mocks: 2 }, repaired: new Map(), subjectName: () => 'Accountancy', now: Date.parse('2026-10-17T21:41:00+05:30'),
  });
  assert.equal(today.open, reviewCounts(student).open, 'Review: 22 open mistakes across three papers; Today counts the newest paper');
});

test('the todo tests are real assertions that currently fail: a reader can see the gap, and removing `todo` turns them red until it closes', () => {
  const today = todayMove();
  assert.ok(!/Q\d+/.test(today.key.label), 'today\'s key does not name a question yet');
  assert.equal(today.target, undefined);
  assert.equal(paperRepairOrder('avg').qids[0], 'paper-avg-q42');
});
