import { selectPlannerJobsForTests } from '../autonomous/planner.mjs';
import { getGenerationLoopConfigForModel, getSubBatchRequestCountsForTarget, selectGenerationModel } from '../lib/llm.mjs';

const jobs = [
  { subject_id: 'english', chapter: 'Para Jumbles', question_count: 15, question_type: 'para_jumble', anchor_match_level: 'exact_chapter' },
  { subject_id: 'english', chapter: 'Vocabulary', question_count: 20, question_type: 'vocabulary_in_context', anchor_match_level: 'exact_chapter' },
  { subject_id: 'mathematics', chapter: 'Probability', question_count: 20, question_type: 'statement_based', anchor_match_level: 'exact_chapter' },
  { subject_id: 'physics', chapter: 'Electromagnetic Induction', question_count: 20, question_type: 'statement_based', anchor_match_level: 'exact_chapter' },
  { subject_id: 'chemistry', chapter: 'Aldehydes, Ketones & Carboxylic Acids', question_count: 20, question_type: 'statement_based', anchor_match_level: 'exact_chapter' },
  { subject_id: 'physics', chapter: 'Moving Charges & Magnetism', question_count: 25, question_type: 'statement_based', anchor_match_level: 'exact_chapter' },
  { subject_id: 'economics', chapter: 'Money & Banking', question_count: 25, question_type: 'statement_based', anchor_match_level: 'exact_chapter' },
  { subject_id: 'economics', chapter: 'Balance of Payments', question_count: 25, question_type: 'statement_based', anchor_match_level: 'exact_chapter' },
  { subject_id: 'biology', chapter: 'Molecular Basis of Inheritance', question_count: 25, question_type: 'statement_based', anchor_match_level: 'exact_chapter' },
  { subject_id: 'computer_science', chapter: 'Boolean Algebra', question_count: 25, question_type: 'application_based', anchor_match_level: 'exact_chapter' },
];

const selected = selectPlannerJobsForTests(jobs, 10);
let generatedCandidates = 0;
let selfcheckPassed = 0;
let validatorSent = 0;
let wouldPublish = 0;
let totalDurationMs = 0;
const modelBreakdown = {};

for (const job of selected) {
  const model = selectGenerationModel({
    subject: job.subject_id,
    question_type: job.question_type,
    anchor_match_level: job.anchor_match_level,
    anchor_confidence: 'high',
    requires_passage: false,
    subject_priority_tier: job.priority_tier,
    recent_flash_yield_rate: 0.75,
  });
  const subBatches = getSubBatchRequestCountsForTarget(10, model);
  const generated = subBatches.reduce((sum, count) => sum + count, 0);
  const passed = Math.floor(generated * 0.7);
  const accepted = Math.floor(generated * 0.55);
  const modelConfig = getGenerationLoopConfigForModel(model);
  const durationMs = model.includes('pro') ? 85000 : Math.min(42000, 18000 + subBatches.length * 9000);

  generatedCandidates += generated;
  selfcheckPassed += passed;
  validatorSent += passed;
  wouldPublish += accepted;
  totalDurationMs += durationMs;

  if (!modelBreakdown[model]) {
    modelBreakdown[model] = {
      calls: 0,
      generated: 0,
      would_publish: 0,
      batch_size: modelConfig.batchSize,
    };
  }
  modelBreakdown[model].calls += subBatches.length;
  modelBreakdown[model].generated += generated;
  modelBreakdown[model].would_publish += accepted;
}

const concurrency = 3;
const wallClockMs = Math.max(totalDurationMs / concurrency, 1);
const projectedLivePerHour = (wouldPublish / (wallClockMs / 3600000));
const projectedCandidatesPerHour = (generatedCandidates / (wallClockMs / 3600000));

console.log(JSON.stringify({
  jobs_started: selected.length,
  jobs_completed: selected.length,
  selected_order: selected.map((job) => `${job.subject_id}/${job.chapter}`),
  generated_candidates: generatedCandidates,
  selfcheck_passed: selfcheckPassed,
  validator_sent: validatorSent,
  would_publish: wouldPublish,
  avg_job_duration_ms: Math.round(totalDurationMs / Math.max(selected.length, 1)),
  projected_live_per_hour: Math.round(projectedLivePerHour),
  projected_candidates_per_hour: Math.round(projectedCandidatesPerHour),
  model_breakdown: modelBreakdown,
  no_gpt_generation: true,
}, null, 2));
