import test from 'node:test';
import assert from 'node:assert/strict';
import { getCuetOverrideConfig, isJobAllowedByOverride } from '../lib/overrideConfig.mjs';
import { rankPlannerGapsForTests, selectPlannerJobsForTests } from '../autonomous/planner.mjs';
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

test('parses --chapters equals form with display names', () => {
  const override = getCuetOverrideConfig({
    env: {},
    argv: ['--chapters=Narrative Passage,Factual Passage'],
  });
  assert.deepEqual(override.chapters, ['Narrative Passage', 'Factual Passage']);
  assert.deepEqual(override.chapter_keys, ['narrative passage', 'factual passage']);
});

test('parses --chapters followed by quoted comma list', () => {
  const override = getCuetOverrideConfig({
    env: {},
    argv: ['--chapters', 'Narrative Passage,Factual Passage'],
  });
  assert.deepEqual(override.chapters, ['Narrative Passage', 'Factual Passage']);
});

test('parses PowerShell style --chapters and next token value', () => {
  const override = getCuetOverrideConfig({
    env: {},
    argv: [
      '--subjects=english',
      '--mode=nta',
      '--quality=balanced',
      '--chapters',
      'Narrative Passage,Factual Passage,Literary Passage,Reading Comprehension',
      '--max-jobs=5',
    ],
  });
  assert.deepEqual(override.chapters, [
    'Narrative Passage',
    'Factual Passage',
    'Literary Passage',
    'Reading Comprehension',
  ]);
  assert.equal(override.mode, 'nta');
  assert.equal(override.quality_mode, 'balanced');
  assert.equal(override.max_jobs, 5);
});

test('does not parse chapters as true', () => {
  const override = getCuetOverrideConfig({
    env: {},
    argv: ['--chapters'],
  });
  assert.deepEqual(override.chapters, []);
});

test('env CUET_ONLY_CHAPTERS works', () => {
  const override = getCuetOverrideConfig({
    env: { CUET_ONLY_CHAPTERS: 'Narrative Passage,Factual Passage' },
    argv: [],
  });
  assert.deepEqual(override.chapters, ['Narrative Passage', 'Factual Passage']);
});

test('CLI chapters override env chapters', () => {
  const override = getCuetOverrideConfig({
    env: { CUET_ONLY_CHAPTERS: 'Vocabulary' },
    argv: ['--chapters', 'Narrative Passage,Factual Passage'],
  });
  assert.deepEqual(override.chapters, ['Narrative Passage', 'Factual Passage']);
});

test('boolean chapter CLI falls back to env override', () => {
  const override = getCuetOverrideConfig({
    env: { CUET_ONLY_CHAPTERS: 'Reading Comprehension' },
    argv: ['--chapters=true'],
  });
  assert.deepEqual(override.chapters, ['Reading Comprehension']);
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

test('planner receives only listed chapters', () => {
  const override = getCuetOverrideConfig({
    env: {},
    argv: ['--subjects=english', '--mode=nta', '--chapters', 'Narrative Passage,Factual Passage,Literary Passage,Reading Comprehension'],
  });
  const jobs = selectPlannerJobsForTests([
    { subject_id: 'english', chapter: 'Narrative Passage', question_count: 0 },
    { subject_id: 'english', chapter: 'Factual Passage', question_count: 0 },
    { subject_id: 'english', chapter: 'Literary Passage', question_count: 0 },
    { subject_id: 'english', chapter: 'Reading Comprehension', question_count: 0 },
    { subject_id: 'english', chapter: 'Vocabulary', question_count: 0 },
    { subject_id: 'english', chapter: 'Match the Following', question_count: 0 },
    { subject_id: 'english', chapter: 'Para Jumbles', question_count: 0 },
  ], 10, override);
  const selectedChapters = jobs.map((job) => job.chapter);
  assert.ok(selectedChapters.length > 0);
  assert.ok(selectedChapters.every((chapter) => [
    'Narrative Passage',
    'Factual Passage',
    'Literary Passage',
    'Reading Comprehension',
  ].includes(chapter)));
  assert.equal(selectedChapters.includes('Vocabulary'), false);
  assert.equal(selectedChapters.includes('Match the Following'), false);
  assert.equal(selectedChapters.includes('Para Jumbles'), false);
});
