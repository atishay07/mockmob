import { createClient } from '@supabase/supabase-js';
import { getCanonicalUnitForChapter, isValidTopSyllabusPair } from '../../../data/canonical_syllabus.js';
import { validateTraceability } from '../../../data/cuet_controls.js';

const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, serviceRoleKey);

/**
 * Publishes a question directly to the same Supabase project the app reads from.
 * Marks the row as live and creates the discovery row needed by ranking queries.
 */
export async function publishQuestion(question, apiSecret, options = {}) {
  try {
    const now = new Date().toISOString();
    const difficulty = normalizeDifficulty(question.difficulty);
    const difficultyWeight = getDifficultyWeight(difficulty);
    const chapter = typeof question.chapter === 'string' ? question.chapter : '';
    const expectedChapter = options.expectedChapter;
    const canonicalUnit = getCanonicalUnitForChapter(question.subject, chapter);

    if (!isValidTopSyllabusPair(question.subject, chapter) || !canonicalUnit) {
      console.warn('[llm] question_rejected_due_to_invalid_mapping', {
        subject: question.subject || null,
        chapter: chapter || null,
        source: 'publish_guard',
      });
      return { success: false, error: 'invalid_subject_unit_chapter_mapping' };
    }

    if (expectedChapter !== undefined && chapter !== expectedChapter) {
      console.warn('[llm] chapter_mismatch_detected', {
        expected: expectedChapter,
        received: chapter || null,
        subject: question.subject || null,
        source: 'publish_guard',
      });
      console.warn('[llm] question_rejected_due_to_wrong_chapter', {
        expected: expectedChapter,
        received: chapter || null,
        subject: question.subject || null,
      });
      return { success: false, error: 'chapter_mismatch' };
    }

    const traceability = validateTraceability(question, question.subject, chapter);
    if (!traceability.valid) {
      console.warn('[llm] question_rejected_due_to_traceability', {
        subject: question.subject || null,
        chapter,
        reason: traceability.reason,
        source: 'publish_guard',
      });
      return { success: false, error: traceability.reason };
    }
    if (!String(question.pyq_anchor_id || '').trim()) {
      return { success: false, error: 'missing_pyq_anchor' };
    }
    if (![1, 2, 3].includes(Number(question.anchor_tier))) {
      return { success: false, error: 'missing_or_invalid_anchor_tier' };
    }

    const traceTags = [
      ...(question.tags || []),
      `topic:${traceability.concept.topic}`,
      `concept:${traceability.concept.concept_id}`,
      `pyq_anchor:${question.pyq_anchor_id}`,
      `anchor_tier:${Number(question.anchor_tier)}`,
      `difficulty_weight:${difficultyWeight}`,
      `question_type:${question.question_type || 'direct_concept'}`,
    ];

    const { data: qData, error: qError } = await supabase
      .from('questions')
      .insert({
        author_id: 'test-user',
        subject: question.subject.trim(),
        chapter,
        body: question.body.trim(),
        options: question.options || null,
        correct_answer: question.correct_answer.trim(),
        explanation: question.explanation || null,
        difficulty,
        difficulty_weight: difficultyWeight,
        tags: Array.from(new Set(traceTags)),
        topic: traceability.concept.topic,
        concept: traceability.concept.concept,
        concept_id: traceability.concept.concept_id,
        pyq_anchor_id: question.pyq_anchor_id,
        anchor_tier: Number(question.anchor_tier),
        question_type: question.question_type || 'direct_concept',
        status: 'live',
        ai_tier: 'A',
        verification_state: 'verified',
        quality_band: 'strong',
        exploration_state: 'active',
        exploration_lane: 'standard',
        live_at: now,
      })
      .select('id')
      .single();

    if (qError) throw qError;

    const { error: scoreError } = await supabase
      .from('question_scores')
      .upsert({
        question_id: qData.id,
        subject: question.subject.trim(),
        chapter,
        difficulty,
        rank_score: 0,
        momentum_score: 0,
        quality_score: 0,
        is_eligible_for_discovery: true,
        exploration_lane: 'standard',
        last_computed_at: now,
      }, { onConflict: 'question_id' });

    if (scoreError) {
      console.warn(`⚠️ question_scores upsert failed for ${qData.id}: ${scoreError.message}`);
    }

    await supabase
      .from('moderation_jobs')
      .insert({
        question_id: qData.id,
        status: 'completed',
        priority: 5,
        completed_at: now,
      });

    console.log(`✅ Published ${qData.id} | status=live | difficulty=${difficulty} | discoverable=${!scoreError}`);
    return { success: true, id: qData.id };
  } catch (error) {
    console.error(`❌ Database publish error: ${error.message}`);
    return { success: false, error: error.message };
  }
}

function normalizeDifficulty(rawDifficulty) {
  if (rawDifficulty === 'easy' || rawDifficulty === 'medium' || rawDifficulty === 'hard') {
    return rawDifficulty;
  }

  return 'medium';
}

function getDifficultyWeight(difficulty) {
  return { easy: 1, medium: 2, hard: 3 }[normalizeDifficulty(difficulty)] || 2;
}
