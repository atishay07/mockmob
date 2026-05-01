import test from 'node:test';
import assert from 'node:assert/strict';
import { selectPlannerPriorityJobFromRows, selectCoverageFallbackJobFromRows } from '../autonomous/worker.mjs';

const coverage = {
  chapterCounts: new Map([
    ['english::Para Jumbles', 25],
    ['computer_science::Boolean Algebra', 0],
  ]),
  subjectTotals: new Map([
    ['english', 50],
    ['computer_science', 0],
  ]),
};

test('worker picks highest planner priority job before coverage fallback', () => {
  const jobs = [
    { id: 'cs1', status: 'queued', subject_id: 'computer_science', chapter: 'Boolean Algebra', priority: 66, created_at: '2026-01-01' },
    { id: 'eng1', status: 'queued', subject_id: 'english', chapter: 'Para Jumbles', priority: 195, created_at: '2026-01-02' },
  ];
  const selected = selectPlannerPriorityJobFromRows(jobs, ['cs1', 'eng1'], coverage);
  assert.equal(selected.id, 'eng1');
  assert.equal(selected.original_priority, 195);
  assert.equal(selected.priority, 195);
});

test('coverage fallback is used only when no preferred queued jobs exist', () => {
  const jobs = [
    { id: 'cs1', status: 'queued', subject_id: 'computer_science', chapter: 'Boolean Algebra', priority: 66, created_at: '2026-01-01' },
    { id: 'eng1', status: 'completed', subject_id: 'english', chapter: 'Para Jumbles', priority: 195, created_at: '2026-01-02' },
  ];
  assert.equal(selectPlannerPriorityJobFromRows(jobs, ['eng1'], coverage), null);
  assert.equal(selectCoverageFallbackJobFromRows(jobs, coverage).id, 'cs1');
});

test('original priority is not overwritten by coverage priority 75', () => {
  const selected = selectPlannerPriorityJobFromRows([
    { id: 'eng1', status: 'queued', subject_id: 'english', chapter: 'Para Jumbles', priority: 195, created_at: '2026-01-02' },
  ], ['eng1'], coverage);
  assert.equal(selected.original_priority, 195);
  assert.notEqual(selected.original_priority, 75);
});
