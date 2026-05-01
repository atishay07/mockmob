import { selectPlannerJobsForTests } from '../autonomous/planner.mjs';

const sampleGaps = [
  { subject_id: 'english', chapter: 'Para Jumbles', question_count: 18 },
  { subject_id: 'english', chapter: 'Narrative Passage', question_count: 12 },
  { subject_id: 'gat', chapter: 'General Knowledge', question_count: 20 },
  { subject_id: 'physics', chapter: 'Electromagnetic Induction', question_count: 18 },
  { subject_id: 'chemistry', chapter: 'Solutions', question_count: 18 },
  { subject_id: 'mathematics', chapter: 'Probability', question_count: 22 },
  { subject_id: 'economics', chapter: 'Money & Banking', question_count: 15 },
  { subject_id: 'business_studies', chapter: 'Marketing', question_count: 15 },
  { subject_id: 'accountancy', chapter: 'Partnership', question_count: 15 },
  { subject_id: 'biology', chapter: 'Evolution', question_count: 18 },
  { subject_id: 'history', chapter: 'Bricks, Beads & Bones', question_count: 8 },
  { subject_id: 'psychology', chapter: 'Self & Personality', question_count: 2 },
  { subject_id: 'sociology', chapter: 'Introducing Indian Society', question_count: 2 },
];

const selected = selectPlannerJobsForTests(sampleGaps, 10);
const tierDistribution = selected.reduce((acc, job) => {
  const key = `tier_${String(job.priority_tier).toLowerCase()}`;
  acc[key] = (acc[key] || 0) + 1;
  return acc;
}, {});

console.log(JSON.stringify({
  selected_jobs: selected.map((job) => ({
    subject: job.subject_id,
    chapter: job.chapter,
    tier: job.priority_tier,
    final_score: job.final_score,
  })),
  tier_distribution: tierDistribution,
  top_subjects_selected: selected.filter((job) => ['S', 'A'].includes(job.priority_tier)).map((job) => job.subject_id),
  low_priority_subjects_selected: selected.filter((job) => ['C', 'D'].includes(job.priority_tier)).map((job) => job.subject_id),
}, null, 2));
