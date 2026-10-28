import test from 'node:test';
import assert from 'node:assert/strict';
import {
  MOCK_SELECTION_POLICY,
  buildSelectionUsageMeta,
  loadPagedQuestionRows,
  ntaSelectionRowsForInventory,
  pickWithConstraints,
  rankCandidates,
} from '../mock_question_selector.js';
import { getMode } from '../test_modes.js';

function row(id, createdAt, difficulty = 'medium', extra = {}) {
  return {
    id,
    subject: 'english',
    chapter: 'Correct Word Usage',
    difficulty,
    concept_id: `concept_${difficulty}`,
    created_at: createdAt,
    score: 0,
    ...extra,
  };
}

test('fresh non-NTA mocks rank newest rows before older high-score rows', () => {
  const quick = getMode('quick');
  const rows = [
    row('old_high_score', '2026-04-01T00:00:00.000Z', 'medium', { score: 99 }),
    row('new_low_score', '2026-05-01T00:00:00.000Z', 'medium', { score: 0 }),
    row('middle', '2026-04-15T00:00:00.000Z', 'medium', { score: 10 }),
  ];

  const ranked = rankCandidates(rows, { mode: quick, progress: new Map(), weakConcepts: new Set() });

  assert.deepEqual(ranked.map((entry) => entry.id), ['new_low_score', 'middle', 'old_high_score']);
});

test('usage pushes already-attempted rows behind unseen rows', () => {
  const quick = getMode('quick');
  const progress = new Map([
    ['new_seen', { attempt_count: 1, last_attempted_at: '2026-05-02T00:00:00.000Z' }],
  ]);
  const rows = [
    row('new_seen', '2026-05-02T00:00:00.000Z'),
    row('older_unseen', '2026-04-01T00:00:00.000Z'),
  ];

  const ranked = rankCandidates(rows, { mode: quick, progress, weakConcepts: new Set() });

  assert.deepEqual(ranked.map((entry) => entry.id), ['older_unseen', 'new_seen']);
});

test('picker preserves difficulty targets while keeping newest rows within each level', () => {
  const quick = getMode('quick');
  const rows = [
    row('easy_new', '2026-05-03T00:00:00.000Z', 'easy'),
    row('easy_old', '2026-04-03T00:00:00.000Z', 'easy'),
    row('medium_new', '2026-05-02T00:00:00.000Z', 'medium'),
    row('medium_old', '2026-04-02T00:00:00.000Z', 'medium'),
    row('hard_new', '2026-05-01T00:00:00.000Z', 'hard'),
    row('hard_old', '2026-04-01T00:00:00.000Z', 'hard'),
  ];

  const selected = pickWithConstraints(rankCandidates(rows, { mode: quick }), 5, quick);

  assert.deepEqual(selected.map((entry) => entry.id), [
    'easy_new',
    'medium_new',
    'hard_new',
    'easy_old',
    'medium_old',
  ]);
});

test('picker never infers an unknown difficulty to satisfy an easy or medium target', () => {
  const quick = getMode('quick');
  const selected = pickWithConstraints([
    row('unlabelled', '2026-05-03T00:00:00.000Z', null),
  ], 1, quick);

  assert.deepEqual(selected, []);
});

test('paged NTA inventory scans beyond 5000 rows and reports a bounded incomplete scan', async () => {
  const pageSizes = [];
  const complete = await loadPagedQuestionRows(async (offset, limit) => {
    pageSizes.push([offset, limit]);
    return Array.from({ length: Math.min(limit, 6501 - offset) }, (_, index) => ({ id: offset + index }));
  }, { pageSize: 1000, maxRows: 7000 });

  assert.equal(complete.rows.length, 6501);
  assert.equal(complete.complete, true);
  assert.ok(pageSizes.some(([offset]) => offset === 6000));

  const bounded = await loadPagedQuestionRows(async (offset, limit) =>
    Array.from({ length: Math.min(limit, 7200 - offset) }, (_, index) => ({ id: offset + index })),
  { pageSize: 1000, maxRows: 7000 });

  assert.equal(bounded.rows.length, 7000);
  assert.equal(bounded.complete, false);
  assert.equal(bounded.scannedCount, 7000);
});

test('NTA withholds Hard fallback when Medium or Easy inventory scan is incomplete', () => {
  const rows = [
    row('medium', '2026-05-03T00:00:00.000Z', 'medium'),
    row('easy', '2026-05-02T00:00:00.000Z', 'easy'),
    row('hard', '2026-05-01T00:00:00.000Z', 'hard'),
  ];
  const incomplete = ntaSelectionRowsForInventory(rows, ['medium']);
  const completeBase = ntaSelectionRowsForInventory(rows, ['hard']);

  assert.deepEqual(incomplete.rows.map((entry) => entry.id), ['medium', 'easy']);
  assert.equal(incomplete.hardFallbackSuppressed, true);
  assert.deepEqual(completeBase.rows, rows);
  assert.equal(completeBase.hardFallbackSuppressed, false);
});

test('selection usage metadata records latest-window and revisit counts', () => {
  const quick = getMode('quick');
  const candidatePool = [
    row('q1', '2026-05-03T00:00:00.000Z'),
    row('q2', '2026-05-02T00:00:00.000Z'),
    row('q3', '2026-04-01T00:00:00.000Z'),
  ];
  const progress = new Map([
    ['q3', { attempt_count: 2, last_attempted_at: '2026-04-20T00:00:00.000Z' }],
  ]);

  const meta = buildSelectionUsageMeta({
    selectedRows: [candidatePool[0], candidatePool[2]],
    candidatePool,
    progress,
    mode: quick,
    targetCount: 2,
    recencyFilteredCount: 1,
  });

  assert.equal(meta.policy, MOCK_SELECTION_POLICY);
  assert.equal(meta.latestSelectedCount, 1);
  assert.equal(meta.olderFallbackSelectedCount, 1);
  assert.equal(meta.unseenSelectedCount, 1);
  assert.equal(meta.revisitedSelectedCount, 1);
  assert.equal(meta.recencyFilteredCount, 1);
});
