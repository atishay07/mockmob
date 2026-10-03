import test from 'node:test';
import assert from 'node:assert/strict';
import { compassProjection, compareToCutoff, projectPaper, projectTotal, subjectSummaries, MIN_PAPER_SAMPLE, PAPER_MAX } from '../compass_projection.js';

const attempt = (subject, outcomes) => ({ subject, details: outcomes.map((o, i) => ({ qid: `${subject}-${i}`, isCorrect: o === 'r' ? true : o === 'w' ? false : null })) });
const many = (pattern, times) => Array.from({ length: times }, () => pattern).join('');

test('a paper is only projected after enough practice, and says how much is missing', () => {
  const [summary] = subjectSummaries([attempt('accountancy', [...'rrrwr'])]);
  const paper = projectPaper(summary);
  assert.equal(paper.status, 'thin');
  assert.equal(paper.needed, MIN_PAPER_SAMPLE - 5);
  assert.equal(paper.mid, undefined, 'no number is shown for a thin record');
});

test('projection is the +5/-1 arithmetic of attempt share and accuracy, with a range', () => {
  // 40 questions: 24 right, 8 wrong, 8 blank -> attempt share 0.8, accuracy 0.75.
  const outcomes = [...many('rrrw', 8), ...many('b', 8)];
  const paper = projectPaper(subjectSummaries([attempt('economics', outcomes)])[0]);
  assert.equal(paper.status, 'ready');
  // 50 * 0.8 * (0.75*5 - 0.25) = 140
  assert.equal(paper.mid, 140);
  assert.ok(paper.low <= paper.mid && paper.mid <= paper.high);
  assert.ok(paper.high <= PAPER_MAX && paper.low >= 0);
  assert.equal(paper.open, PAPER_MAX - 140);
});

test('the total uses one language and the three strongest domain papers, and is marked partial otherwise', () => {
  const strong = [...many('rrrrw', 8)];
  const weak = [...many('rww', 12)];
  const attempts = [attempt('english', strong), attempt('accountancy', strong), attempt('economics', weak), attempt('business_studies', strong), attempt('history', weak)];
  const { total, papers } = compassProjection(attempts);
  assert.equal(total.complete, true);
  assert.equal(total.count, 4);
  assert.ok(total.papers.includes('english'));
  assert.ok(!total.papers.includes('history') || !total.papers.includes('economics'), 'only the three strongest domain papers count');
  assert.equal(total.max, 4 * PAPER_MAX);
  assert.equal(total.mid, total.papers.reduce((s, id) => s + papers.find((p) => p.subject === id).mid, 0));

  const partial = projectTotal(compassProjection([attempt('accountancy', strong)]).papers);
  assert.equal(partial.complete, false);
  assert.equal(partial.count, 1);
});

test('a band sits above, within or below a cutoff, and missing cutoffs are never a verdict', () => {
  const band = { low: 600, mid: 640, high: 680 };
  assert.deepEqual(compareToCutoff(band, 550), { position: 'above', by: 50 });
  assert.deepEqual(compareToCutoff(band, 700), { position: 'below', by: 20 });
  assert.deepEqual(compareToCutoff(band, 650), { position: 'within' });
  assert.deepEqual(compareToCutoff(band, null), { position: 'none' });
});

test('next move names the paper with the most marks open and its weakest ranked chapter', () => {
  const attempts = [attempt('english', [...many('rrrrw', 8)]), attempt('accountancy', [...many('rww', 12)])];
  const result = compassProjection(attempts, { rankedChapters: [{ subject: 'accountancy', chapter: 'Partnership', wrong: 6, skip: 1, n: 12 }] });
  assert.equal(result.next.subject, 'accountancy');
  assert.equal(result.next.chapter.name, 'Partnership');
});
