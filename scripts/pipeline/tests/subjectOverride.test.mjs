import test from 'node:test';
import assert from 'node:assert/strict';
import { getCuetOverrideConfig, isJobAllowedByOverride } from '../lib/overrideConfig.mjs';
import { rankPlannerGapsForTests } from '../autonomous/planner.mjs';
import { selectCoverageFallbackJobFromRows, selectPlannerPriorityJobFromRows } from '../autonomous/worker.mjs';

const coverage = { chapterCounts: new Map(), subjectTotals: new Map() };

test('subject override filters planner jobs to English', () => {
  const override = getCuetOverrideConfig({ env: { CUET_SUBJECT_OVERRIDE: 'english' }, argv: [] });
  const ranked = rankPlannerGapsForTests([
    { subject_id: 'english', chapter: 'Narrative Passage', question_count: 0 },
    { subject_id: 'physics', chapter: 'Electromagnetic Induction', question_count: 0 },
  ], override);
  assert.equal(ranked.length, 1);
  assert.equal(ranked[0].subject_id, 'english');
});

test('chapter override keeps only requested chapter', () => {
  const override = getCuetOverrideConfig({ env: { CUET_SUBJECT_OVERRIDE: 'english', CUET_CHAPTER_OVERRIDE: 'Narrative Passage' }, argv: [] });
  assert.equal(isJobAllowedByOverride({ subject_id: 'english', chapter: 'Narrative Passage' }, override).allowed, true);
  assert.equal(isJobAllowedByOverride({ subject_id: 'english', chapter: 'Para Jumbles' }, override).allowed, false);
});

test('worker fallback cannot pick Sociology when subject override is English', () => {
  const override = getCuetOverrideConfig({ env: { CUET_SUBJECT_OVERRIDE: 'english' }, argv: [] });
  const selected = selectCoverageFallbackJobFromRows([
    { id: 's1', subject_id: 'sociology', chapter: 'Social Institutions: Continuity and Change', status: 'queued', priority: 99 },
    { id: 'e1', subject_id: 'english', chapter: 'Narrative Passage', status: 'queued', priority: 10 },
  ], coverage, override);
  assert.equal(selected.id, 'e1');
});

test('CLI override beats env override', () => {
  const override = getCuetOverrideConfig({
    env: { CUET_SUBJECT_OVERRIDE: 'physics' },
    argv: ['--subjects=english'],
  });
  assert.deepEqual(override.subjects, ['english']);
});

test('exclude subject removes Psychology from planner priority selection', () => {
  const override = getCuetOverrideConfig({ env: { CUET_EXCLUDE_SUBJECTS: 'psychology' }, argv: [] });
  const selected = selectPlannerPriorityJobFromRows([
    { id: 'p1', subject_id: 'psychology', chapter: 'Variations in Psychological Attributes', status: 'queued', priority: 500 },
    { id: 'e1', subject_id: 'english', chapter: 'Vocabulary', status: 'queued', priority: 100 },
  ], ['p1', 'e1'], coverage, override);
  assert.equal(selected.id, 'e1');
});
