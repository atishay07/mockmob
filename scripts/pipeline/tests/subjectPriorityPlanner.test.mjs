import test from 'node:test';
import assert from 'node:assert/strict';
import { getSubjectPriority, rankPlannerGapsForTests, selectPlannerJobsForTests } from '../autonomous/planner.mjs';

test('core CUET subjects have higher priority tiers than Sociology and Psychology', () => {
  assert.equal(getSubjectPriority('english').tier, 'S');
  assert.equal(getSubjectPriority('gat').tier, 'S');
  assert.equal(getSubjectPriority('chemistry').tier, 'S');
  assert.equal(getSubjectPriority('physics').tier, 'S');
  assert.equal(getSubjectPriority('mathematics').tier, 'S');
  assert.equal(getSubjectPriority('sociology').tier, 'C');
  assert.equal(getSubjectPriority('psychology').tier, 'C');
});

test('English outranks Sociology even when both have coverage gaps', () => {
  const ranked = rankPlannerGapsForTests([
    { subject_id: 'sociology', chapter: 'Introducing Indian Society', question_count: 0 },
    { subject_id: 'english', chapter: 'Para Jumbles', question_count: 20 },
  ]);
  assert.equal(ranked[0].subject_id, 'english');
});

test('GAT and science subjects outrank Psychology/Sociology', () => {
  const ranked = rankPlannerGapsForTests([
    { subject_id: 'psychology', chapter: 'Self & Personality', question_count: 0 },
    { subject_id: 'sociology', chapter: 'Demographic Structure', question_count: 0 },
    { subject_id: 'gat', chapter: 'General Knowledge', question_count: 25 },
    { subject_id: 'physics', chapter: 'Electromagnetic Induction', question_count: 25 },
    { subject_id: 'chemistry', chapter: 'Solutions', question_count: 25 },
  ]);
  assert.deepEqual(ranked.slice(0, 3).map((gap) => gap.subject_id).sort(), ['chemistry', 'gat', 'physics']);
});

test('planner selection preserves some lower tier coverage when higher tiers are healthy', () => {
  const selected = selectPlannerJobsForTests([
    { subject_id: 'english', chapter: 'Para Jumbles', question_count: 95 },
    { subject_id: 'gat', chapter: 'General Knowledge', question_count: 95 },
    { subject_id: 'physics', chapter: 'Electromagnetic Induction', question_count: 95 },
    { subject_id: 'economics', chapter: 'Money & Banking', question_count: 70 },
    { subject_id: 'business_studies', chapter: 'Marketing', question_count: 70 },
    { subject_id: 'sociology', chapter: 'Introducing Indian Society', question_count: 0 },
  ], 3);
  assert.equal(selected.some((job) => job.subject_id === 'sociology'), true);
});
