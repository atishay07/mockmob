import { createClient } from '@supabase/supabase-js';
import { analyzeCoverage } from './analyzer.mjs';
import { planGeneration } from './planner.mjs';
import { generateQuestions, getLastGenerationDiagnostics, validateAndAlignBatch } from '../lib/llm.mjs';
import { deduplicateBatch } from '../lib/dedupe.mjs';
import { publishQuestion } from '../lib/publish.mjs';
import { SUBJECTS } from '../../../data/subjects.js';
import { getCanonicalUnitForChapter } from '../../../data/canonical_syllabus.js';

const supabase = createClient(
  process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const API_SECRET = process.env.INTERNAL_API_SECRET || 'test-secret';
const MAX_API_CALLS_PER_JOB = 3;

/** Removes questions that fail structural integrity before dedup or validation. */
function filterMalformedQuestions(questions) {
  const valid = [];
  let removed = 0;

  for (const question of questions) {
    if (!question || typeof question !== 'object') { removed += 1; continue; }
    if (!String(question.body || '').trim()) { removed += 1; continue; }
    if (!question.correct_answer) { removed += 1; continue; }

    const options = question.options;
    if (!Array.isArray(options) || options.length !== 4) { removed += 1; continue; }

    const keys = options.map((o) => String(o?.key || '').trim().toUpperCase());
    if (new Set(keys).size !== 4) { removed += 1; continue; }

    const texts = options.map((o) => String(o?.text || '').trim().toLowerCase());
    if (new Set(texts).size !== 4) { removed += 1; continue; }

    const answer = String(question.correct_answer || '').trim().toUpperCase();
    if (!['A', 'B', 'C', 'D'].includes(answer)) { removed += 1; continue; }
    if (!keys.includes(answer)) { removed += 1; continue; }

    valid.push(question);
  }

  return { valid, removed };
}

/** Final schema guard before publish — ensures no corrupt question reaches the DB. */
function isSchemaValid(question) {
  if (!question || typeof question !== 'object') return false;
  if (!String(question.body || '').trim()) return false;
  if (!Array.isArray(question.options) || question.options.length !== 4) return false;
  const answer = String(question.correct_answer || '').trim().toUpperCase();
  if (!['A', 'B', 'C', 'D'].includes(answer)) return false;
  const keys = question.options.map((o) => String(o?.key || '').trim().toUpperCase());
  return keys.includes(answer);
}

async function workerLoop() {
  console.log('\nAutonomous CUET Question Engine Started');

  let lastPlanTime = 0;
  const PLAN_INTERVAL = 60 * 60 * 1000;

  while (true) {
    try {
      const now = Date.now();

      if (now - lastPlanTime > PLAN_INTERVAL) {
        const { gaps } = await analyzeCoverage();
        await planGeneration(gaps);
        lastPlanTime = now;
      }

      const { data: job, error: jobErr } = await supabase
        .from('generation_jobs')
        .select('*')
        .eq('status', 'queued')
        .order('priority', { ascending: true })
        .order('created_at', { ascending: true })
        .limit(1)
        .maybeSingle();

      if (jobErr) throw jobErr;

      if (!job) {
        console.log('No queued jobs. Sleeping for 5 minutes...');
        await new Promise((resolve) => setTimeout(resolve, 5 * 60 * 1000));
        lastPlanTime = 0;
        continue;
      }

      await supabase
        .from('generation_jobs')
        .update({ status: 'processing', started_at: new Date().toISOString() })
        .eq('id', job.id);

      await processJob(job);

      console.log('Cooling down for 15s to respect API limits...');
      await new Promise((resolve) => setTimeout(resolve, 15000));
    } catch (err) {
      if (err.message?.includes('429') || err.message?.includes('quota')) {
        console.warn('Rate limit hit. Sleeping for 30s...');
        await new Promise((resolve) => setTimeout(resolve, 30000));
      } else {
        console.error('Worker loop error:', err.message);
        await new Promise((resolve) => setTimeout(resolve, 10000));
      }
    }
  }
}

async function processJob(job) {
  console.log(`\n[JOB ${job.id.substring(0, 8)}] Starting: [${job.subject_id}] ${job.chapter}`);

  const subject = SUBJECTS.find((entry) => entry.id === job.subject_id);
  const stats = {
    total: 0, accepted: 0, rejected: 0, duplicates: 0,
    preValidationFiltered: 0, retryCount: 0, apiCallsUsed: 0, scores: [],
  };
  const dropReasons = {
    normalization_failed: 0,
    invalid_options_format: 0,
    missing_required_fields: 0,
    validation_failed: 0,
    low_score: 0,
    difficulty_mismatch: 0,
    cuet_alignment_failed: 0,
    chapter_mismatch: 0,
  };

  try {
    if (!subject) {
      throw new Error(`Subject ${job.subject_id} not found in system mapping`);
    }

    const canonicalUnit = getCanonicalUnitForChapter(job.subject_id, job.chapter);
    if (!subject.chapters.includes(job.chapter) || !canonicalUnit) {
      console.warn('[llm] chapter_mismatch_detected', {
        expected: subject.chapters,
        received: job.chapter,
        subject: job.subject_id,
        source: 'generation_job',
      });
      await supabase
        .from('generation_jobs')
        .update({ status: 'failed', error_message: `Invalid chapter mapping: ${job.chapter}` })
        .eq('id', job.id);
      return;
    }

    // ── Step 1: Generate — API call 1 ────────────────────────────────────────
    stats.apiCallsUsed += 1;
    const generateCount = Math.max(job.target_count || 15, 35);
    console.log(`[pipeline] Generating ${generateCount} candidates... chapter="${job.chapter}" unit="${canonicalUnit.unit_name}" (api_call=${stats.apiCallsUsed})`);
    const rawQuestions = await generateQuestions(subject, job.chapter, generateCount);

    if (rawQuestions?.error) {
      await supabase
        .from('generation_jobs')
        .update({ status: 'failed', completed_at: new Date().toISOString(), error_message: rawQuestions.error })
        .eq('id', job.id);
      return;
    }

    const generationDiagnostics = getLastGenerationDiagnostics();
    mergeDropReasons(dropReasons, generationDiagnostics.dropReasons);

    if (!rawQuestions || rawQuestions.length === 0) {
      logDropSummary(job, dropReasons, generationDiagnostics);
      await supabase
        .from('generation_jobs')
        .update({ status: 'completed', completed_at: new Date().toISOString(), error_message: 'Skipped: LLM returned 0 valid questions' })
        .eq('id', job.id);
      return;
    }

    stats.total = rawQuestions.length;
    console.log(`[pipeline] generated_count=${rawQuestions.length} | mix=${formatDifficultyCounts(rawQuestions)}`);

    // ── Step 2: Chapter filter — sync ─────────────────────────────────────────
    const chapterFiltered = [];
    for (const question of rawQuestions) {
      if (question.chapter !== job.chapter || !getCanonicalUnitForChapter(question.subject, question.chapter)) {
        dropReasons.chapter_mismatch += 1;
        stats.rejected += 1;
        console.warn('[llm] question_rejected_due_to_wrong_chapter', {
          expected: job.chapter,
          received: question.chapter || null,
          subject: job.subject_id,
        });
        continue;
      }
      chapterFiltered.push(question);
    }

    // ── Step 3: Structural quality filter — sync ──────────────────────────────
    const { valid: structFiltered, removed: structRemoved } = filterMalformedQuestions(chapterFiltered);
    stats.preValidationFiltered = structRemoved;
    dropReasons.missing_required_fields += structRemoved;
    if (structRemoved > 0) {
      console.warn(`[pipeline] pre_validation_filtered=${structRemoved} malformed questions removed (missing fields / bad options)`);
    }

    // ── Step 4: Pre-validation deduplication — sync ───────────────────────────
    const { unique: dedupedQuestions, removed: dupCount } = deduplicateBatch(structFiltered);
    stats.duplicates = dupCount;
    const dupRate = structFiltered.length > 0 ? dupCount / structFiltered.length : 0;

    console.log(`[pipeline] after_chapter_filter=${chapterFiltered.length} | pre_validation_filtered=${structRemoved} | duplicates_removed=${dupCount} | to_validate=${dedupedQuestions.length}`);

    if (dupRate > 0.30) {
      console.warn(`[pipeline] HIGH_DUPLICATE_RATE=${(dupRate * 100).toFixed(1)}% (threshold=30%)`);
    }

    if (dedupedQuestions.length === 0) {
      logDropSummary(job, dropReasons, {
        rawParsedCount: generationDiagnostics.rawParsedCount,
        normalizedCount: rawQuestions.length,
        sampleFailedRawQuestion: null,
        sampleFailedNormalizedAttempt: null,
      });
      await supabase
        .from('generation_jobs')
        .update({ status: 'completed', completed_at: new Date().toISOString(), error_message: 'Skipped: 0 unique valid questions after filtering' })
        .eq('id', job.id);
      return;
    }

    // ── Step 5: Batch validation with exactly 1 retry — API call 2 (+1) ───────
    stats.apiCallsUsed += 1;
    if (stats.apiCallsUsed > MAX_API_CALLS_PER_JOB) {
      throw new Error(`api_call_limit_exceeded before validation (${stats.apiCallsUsed} calls)`);
    }

    console.log(`[pipeline] Starting batch validation for ${dedupedQuestions.length} questions... (api_call=${stats.apiCallsUsed})`);
    let validationResults;

    try {
      validationResults = await validateAndAlignBatch(dedupedQuestions, subject);
    } catch (firstErr) {
      stats.retryCount += 1;
      console.warn(`[pipeline] Batch validation attempt 1 failed: ${firstErr.message}. Retrying once...`);

      stats.apiCallsUsed += 1;
      if (stats.apiCallsUsed > MAX_API_CALLS_PER_JOB) {
        console.error(`[pipeline] api_call_limit_exceeded: retry blocked at ${stats.apiCallsUsed} calls`);
        await supabase
          .from('generation_jobs')
          .update({ status: 'failed', error_message: `validation_failed_retry_blocked: ${firstErr.message}` })
          .eq('id', job.id);
        return;
      }

      try {
        validationResults = await validateAndAlignBatch(dedupedQuestions, subject);
        console.log(`[pipeline] Batch validation retry succeeded. (api_call=${stats.apiCallsUsed})`);
      } catch (retryErr) {
        console.error(`[pipeline] Batch validation failed after retry: ${retryErr.message}. Aborting job.`);
        await supabase
          .from('generation_jobs')
          .update({ status: 'failed', error_message: `validation_failed_after_retry: ${retryErr.message}` })
          .eq('id', job.id);
        return;
      }
    }

    // ── Step 6: Filter by validation scores ───────────────────────────────────
    const validatedQuestions = [];
    for (let i = 0; i < dedupedQuestions.length; i += 1) {
      const question = dedupedQuestions[i];
      const validation = validationResults[i];
      const scoreThreshold = getDifficultyThreshold(question.difficulty);
      const validationSkippedForReview =
        validation.requires_review === true && validation.validation_confidence === 'low';
      const shouldReject =
        !validationSkippedForReview &&
        (validation.score < scoreThreshold || validation.cuet_alignment === false);

      if (shouldReject) {
        dropReasons.validation_failed += 1;
        if (validation.score < scoreThreshold) dropReasons.low_score += 1;
        if (validation.difficulty_correct === false) dropReasons.difficulty_mismatch += 1;
        if (validation.cuet_alignment === false) dropReasons.cuet_alignment_failed += 1;
        console.warn(
          `[pipeline] Rejected | score=${validation.score} | difficulty_correct=${validation.difficulty_correct} | cuet_alignment=${validation.cuet_alignment} | issues=${(validation.issues || []).join('; ')}`,
        );
        stats.rejected += 1;
        continue;
      }

      validatedQuestions.push(question);
      stats.scores.push(validation.score);
    }

    const acceptanceRate = dedupedQuestions.length > 0 ? validatedQuestions.length / dedupedQuestions.length : 0;
    if (acceptanceRate < 0.30) {
      console.warn(`[pipeline] LOW_ACCEPTANCE_RATE=${(acceptanceRate * 100).toFixed(1)}% (threshold=30%)`);
    }
    console.log(`[pipeline] validated_count=${validatedQuestions.length} | acceptance_rate=${(acceptanceRate * 100).toFixed(1)}%`);

    const selectedQuestions = selectBalancedQuestions(validatedQuestions);

    // ── Step 7: Final sanity dedup — catches any edge-case survivors ──────────
    const { unique: sanityUnique, removed: sanityDupes } = deduplicateBatch(selectedQuestions);
    if (sanityDupes > 0) {
      console.warn(`[pipeline] FINAL_SANITY_DEDUP removed ${sanityDupes} late-stage duplicates`);
      stats.duplicates += sanityDupes;
    }

    // ── Step 8: Schema guard — last line of defence before DB write ───────────
    const publishReady = sanityUnique.filter(isSchemaValid);
    const schemaRejected = sanityUnique.length - publishReady.length;
    if (schemaRejected > 0) {
      console.warn(`[pipeline] SCHEMA_GUARD removed ${schemaRejected} questions with invalid schema`);
      stats.rejected += schemaRejected;
    }

    console.log(`[pipeline] selected_count=${publishReady.length} | FINAL DISTRIBUTION: ${JSON.stringify(countDifficultyMix(publishReady))}`);

    // ── Step 9: Publish ───────────────────────────────────────────────────────
    const acceptedQuestions = [];
    for (const question of publishReady) {
      const publishRes = await publishQuestion(question, API_SECRET, { expectedChapter: job.chapter });
      if (publishRes.success) {
        acceptedQuestions.push(question);
        stats.accepted += 1;
      } else {
        stats.rejected += 1;
      }
    }

    if (acceptedQuestions.length === 0) {
      logDropSummary(job, dropReasons, {
        rawParsedCount: generationDiagnostics.rawParsedCount,
        normalizedCount: rawQuestions.length,
        sampleFailedRawQuestion: generationDiagnostics.sampleFailedRawQuestion || rawQuestions[0] || null,
        sampleFailedNormalizedAttempt: generationDiagnostics.sampleFailedNormalizedAttempt || rawQuestions[0] || null,
      });
    }

    const avgScore = stats.scores.length > 0
      ? stats.scores.reduce((sum, score) => sum + score, 0) / stats.scores.length
      : 0;

    await supabase
      .from('generation_jobs')
      .update({ status: 'completed', completed_at: new Date().toISOString() })
      .eq('id', job.id);

    await supabase
      .from('generation_stats')
      .insert({
        run_id: job.id,
        subject_id: job.subject_id,
        chapter: job.chapter,
        total_attempted: stats.total,
        accepted_count: stats.accepted,
        rejected_count: stats.rejected,
        duplicate_count: stats.duplicates,
        avg_score: avgScore,
      });

    console.log(
      `[pipeline] SUMMARY | generated_count=${stats.total} | duplicates_removed=${stats.duplicates} | pre_validation_filtered=${stats.preValidationFiltered} | validated_count=${validatedQuestions.length} | accepted_count=${stats.accepted} | rejected_count=${stats.rejected} | retry_count=${stats.retryCount} | api_calls_used=${stats.apiCallsUsed}`,
    );
    console.log(`[pipeline] Accepted difficulty mix: ${formatDifficultyCounts(acceptedQuestions)}`);

  } catch (err) {
    console.error('Failed:', err.message);

    if (err.message?.includes('429') || err.message?.includes('quota')) {
      await supabase.from('generation_jobs').update({ status: 'queued' }).eq('id', job.id);
      throw err;
    }

    await supabase
      .from('generation_jobs')
      .update({ status: 'failed', error_message: err.message })
      .eq('id', job.id);
  }
}

function formatDifficultyCounts(questions) {
  const counts = { easy: 0, medium: 0, hard: 0 };

  for (const question of questions || []) {
    if (question?.difficulty === 'easy' || question?.difficulty === 'medium' || question?.difficulty === 'hard') {
      counts[question.difficulty] += 1;
    }
  }

  return `easy=${counts.easy}, medium=${counts.medium}, hard=${counts.hard}`;
}

function getDifficultyThreshold(difficulty) {
  if (difficulty === 'easy') return 5;
  if (difficulty === 'hard') return 6;
  return 7;
}

function selectBalancedQuestions(validatedQuestions) {
  const buckets = { easy: [], medium: [], hard: [] };

  for (const question of validatedQuestions) {
    const difficulty = question?.difficulty === 'easy' || question?.difficulty === 'medium' || question?.difficulty === 'hard'
      ? question.difficulty
      : 'medium';
    buckets[difficulty].push(question);
  }

  const total = validatedQuestions.length;
  const targetRatio = { easy: 0.20, medium: 0.50, hard: 0.30 };
  const target = {
    easy: Math.ceil(total * targetRatio.easy),
    medium: Math.ceil(total * targetRatio.medium),
    hard: Math.ceil(total * targetRatio.hard),
  };

  const selected = [];
  const remainingBuckets = {
    easy: [...buckets.easy],
    medium: [...buckets.medium],
    hard: [...buckets.hard],
  };

  for (const difficulty of ['easy', 'medium', 'hard']) {
    const taken = remainingBuckets[difficulty].splice(0, target[difficulty]);
    selected.push(...taken);
  }

  while (selected.length < total) {
    if (remainingBuckets.hard.length > 0) {
      selected.push(remainingBuckets.hard.shift());
    } else if (remainingBuckets.medium.length > 0) {
      selected.push(remainingBuckets.medium.shift());
    } else if (remainingBuckets.easy.length > 0) {
      selected.push(remainingBuckets.easy.shift());
    } else {
      break;
    }
  }

  return selected;
}

function countDifficultyMix(questions) {
  return {
    easy: questions.filter((question) => question.difficulty === 'easy').length,
    medium: questions.filter((question) => question.difficulty === 'medium').length,
    hard: questions.filter((question) => question.difficulty === 'hard').length,
  };
}

if (process.argv.includes('--start')) {
  workerLoop();
}

function mergeDropReasons(target, source) {
  for (const key of Object.keys(target)) {
    target[key] += source?.[key] || 0;
  }
}

function logDropSummary(job, dropReasons, diagnostics = {}) {
  console.warn(`No questions returned for ${job.subject_id}/${job.chapter}`);
  console.warn(`RAW_PARSED_COUNT=${diagnostics.rawParsedCount ?? 0}`);
  console.warn(`NORMALIZED_COUNT=${diagnostics.normalizedCount ?? 0}`);
  console.warn(`VALIDATED_COUNT=0`);
  console.warn('Drop summary:');
  for (const [reason, count] of Object.entries(dropReasons)) {
    console.warn(`- ${reason}: ${count}`);
  }
  if (diagnostics.sampleFailedRawQuestion) {
    console.warn(`Sample failed raw question: ${JSON.stringify(diagnostics.sampleFailedRawQuestion)}`);
  }
  if (diagnostics.sampleFailedNormalizedAttempt) {
    console.warn(`Sample normalized attempt: ${JSON.stringify(diagnostics.sampleFailedNormalizedAttempt)}`);
  }
}
