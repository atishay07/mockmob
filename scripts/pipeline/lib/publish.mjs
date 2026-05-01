import { createClient } from '@supabase/supabase-js';
import { getCanonicalUnitForChapter, isValidTopSyllabusPair } from '../../../data/canonical_syllabus.js';
import { validateTraceability } from '../../../data/cuet_controls.js';

const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = supabaseUrl && serviceRoleKey ? createClient(supabaseUrl, serviceRoleKey) : null;
const ALLOWED_ANCHOR_TIERS = new Set([1, 2, 3, 4]);
const OPTIONAL_QUESTION_COLUMNS = [
  'concept',
  'concept_id',
  'pyq_anchor_id',
  'anchor_tier',
  'difficulty_weight',
  'question_type',
  'passage_group_id',
  'passage_id',
  'passage_type',
  'order_index',
];

let questionColumnSupportPromise = null;

/**
 * Publishes a question directly to the same Supabase project the app reads from.
 * Marks the row as live and creates the discovery row needed by ranking queries.
 */
export async function publishQuestion(question, apiSecret, options = {}) {
  try {
    if (!supabase) return { success: false, error: 'supabase_unavailable' };
    const now = new Date().toISOString();
    const difficulty = normalizeDifficulty(question.difficulty);
    const difficultyWeight = getDifficultyWeight(difficulty);
    const chapter = typeof question.chapter === 'string' ? question.chapter : '';
    const expectedChapter = options.expectedChapter;
    const canonicalUnit = getCanonicalUnitForChapter(question.subject, chapter);

    if (question.fallback_used === true) {
      return { success: false, error: 'fallback_never_publishes' };
    }
    const anchorSourceQuality = String(question.anchor_source_quality || '').trim().toLowerCase();
    if (anchorSourceQuality && !['real_pyq', 'manual_seed'].includes(anchorSourceQuality)) {
      return { success: false, error: `draft_only_anchor_source_${anchorSourceQuality}` };
    }
    if (question.strict_cuet_validated === false) {
      return { success: false, error: 'not_strictly_validated' };
    }
    if ((question.is_passage_linked === true || question.passage_group_id || question.group_id || question.temporary_group_key) && question.passage_group_publish_allowed !== true) {
      return { success: false, error: 'passage_child_without_parent_group_publish' };
    }

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
      return { success: false, error: 'draft_only_anchor_source_none' };
    }
    if (!ALLOWED_ANCHOR_TIERS.has(Number(question.anchor_tier))) {
      const original = question.anchor_tier;
      question.anchor_tier = 3;
      console.warn('[publish] auto_corrected_anchor_tier', {
        subject: question.subject || null,
        chapter,
        original_tier: original,
        corrected_tier: 3,
      });
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

    const questionColumnSupport = await getQuestionColumnSupport();
    const questionInsert = {
      author_id: 'test-user',
      subject: question.subject.trim(),
      chapter,
      body: question.body.trim(),
      options: question.options || null,
      correct_answer: question.correct_answer.trim(),
      explanation: question.explanation || null,
      difficulty,
      tags: Array.from(new Set(traceTags)),
      topic: traceability.concept.topic,
      status: 'live',
      ai_tier: 'A',
      verification_state: 'verified',
      quality_band: 'strong',
      exploration_state: 'active',
      exploration_lane: 'standard',
      live_at: now,
    };

    addOptionalQuestionColumn(questionInsert, questionColumnSupport, 'concept', traceability.concept.concept);
    addOptionalQuestionColumn(questionInsert, questionColumnSupport, 'concept_id', traceability.concept.concept_id);
    addOptionalQuestionColumn(questionInsert, questionColumnSupport, 'pyq_anchor_id', question.pyq_anchor_id);
    addOptionalQuestionColumn(questionInsert, questionColumnSupport, 'anchor_tier', Number(question.anchor_tier));
    addOptionalQuestionColumn(questionInsert, questionColumnSupport, 'difficulty_weight', difficultyWeight);
    addOptionalQuestionColumn(questionInsert, questionColumnSupport, 'question_type', question.question_type || 'direct_concept');
    addOptionalQuestionColumn(questionInsert, questionColumnSupport, 'passage_group_id', question.passage_group_id || question.group_id || null);
    addOptionalQuestionColumn(questionInsert, questionColumnSupport, 'passage_id', question.passage_id || null);
    addOptionalQuestionColumn(questionInsert, questionColumnSupport, 'passage_type', question.passage_type || null);
    addOptionalQuestionColumn(questionInsert, questionColumnSupport, 'order_index', Number(question.order_index || 0) || null);

    const { data: qData, error: qError } = await supabase
      .from('questions')
      .insert(questionInsert)
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

export async function publishPassageGroup(group, questions, apiSecret, options = {}) {
  try {
    if (!supabase) return { success: false, error: 'supabase_unavailable' };
    const validQuestions = Array.isArray(questions) ? questions.filter(Boolean) : [];
    const minChildren = Number(options.minValidatedChildren || 2);
    if (validQuestions.length < minChildren) {
      return { success: false, error: `passage_group_requires_${minChildren}_validated_questions` };
    }
    const first = validQuestions[0];
    const chapter = String(first?.chapter || group?.chapter || '').trim();
    const subject = String(first?.subject || group?.subject || '').trim();
    const passageText = String(group?.passage_text || first?.passage_text || '').trim();
    if (!subject || !chapter || !passageText) {
      return { success: false, error: 'invalid_passage_group_payload' };
    }
    if (!isValidTopSyllabusPair(subject, chapter)) {
      return { success: false, error: 'invalid_subject_unit_chapter_mapping' };
    }

    const now = new Date().toISOString();
    const { data: groupData, error: groupError } = await supabase
      .from('passage_groups')
      .insert({
        subject,
        chapter,
        passage_type: group?.passage_type || first?.passage_type || null,
        title: group?.title || first?.passage_title || null,
        passage_text: passageText,
        source: 'generated',
        difficulty: normalizeDifficulty(first?.difficulty),
        status: 'live',
        discoverable: true,
        mode_visibility: ['full_mock', 'nta_mode'],
        created_at: now,
      })
      .select('id')
      .single();

    if (groupError) throw groupError;

    const publishedChildren = [];
    for (const question of validQuestions.sort((a, b) => Number(a.order_index || 0) - Number(b.order_index || 0))) {
      const child = {
        ...question,
        passage_group_publish_allowed: true,
        passage_group_id: groupData.id,
        group_id: groupData.id,
      };
      const result = await publishQuestion(child, apiSecret, options);
      if (!result.success) {
        return {
          success: false,
          error: `passage_child_publish_failed:${result.error}`,
          group_id: groupData.id,
          published_children: publishedChildren.length,
        };
      }
      publishedChildren.push(result.id);
    }

    return { success: true, group_id: groupData.id, child_ids: publishedChildren };
  } catch (error) {
    console.warn(`[passage_group] publish failed: ${error.message}`);
    return { success: false, error: error.message };
  }
}

export async function saveDraftQuestion(question, reason = 'draft_only', options = {}) {
  try {
    if (!supabase) return { success: false, error: 'supabase_unavailable' };
    const difficulty = normalizeDifficulty(question.difficulty);
    const difficultyWeight = getDifficultyWeight(difficulty);
    const chapter = typeof question.chapter === 'string' ? question.chapter : '';
    const expectedChapter = options.expectedChapter;

    if (!isValidTopSyllabusPair(question.subject, chapter)) {
      return { success: false, error: 'invalid_subject_unit_chapter_mapping' };
    }
    if (expectedChapter !== undefined && chapter !== expectedChapter) {
      return { success: false, error: 'chapter_mismatch' };
    }

    const traceability = validateTraceability(question, question.subject, chapter);
    if (!traceability.valid) {
      return { success: false, error: traceability.reason };
    }

    const tags = Array.from(new Set([
      ...(question.tags || []),
      'draft_only',
      `draft_reason:${reason}`,
      `topic:${traceability.concept.topic}`,
      `concept:${traceability.concept.concept_id}`,
      `pyq_anchor:${question.pyq_anchor_id || 'none'}`,
      `anchor_source_quality:${question.anchor_source_quality || 'unknown'}`,
      `difficulty_weight:${difficultyWeight}`,
      `question_type:${question.question_type || 'unknown'}`,
    ]));

    const questionColumnSupport = await getQuestionColumnSupport();
    const questionInsert = {
      author_id: 'test-user',
      subject: question.subject.trim(),
      chapter,
      body: question.body.trim(),
      options: question.options || null,
      correct_answer: question.correct_answer.trim(),
      explanation: question.explanation || null,
      difficulty,
      tags,
      topic: traceability.concept.topic,
      status: 'pending',
      ai_tier: 'PENDING',
      verification_state: 'pending_review',
      quality_band: 'unrated',
      exploration_state: 'frozen',
      exploration_lane: 'none',
      live_at: null,
    };

    addOptionalQuestionColumn(questionInsert, questionColumnSupport, 'concept', traceability.concept.concept);
    addOptionalQuestionColumn(questionInsert, questionColumnSupport, 'concept_id', traceability.concept.concept_id);
    addOptionalQuestionColumn(questionInsert, questionColumnSupport, 'pyq_anchor_id', question.pyq_anchor_id || null);
    addOptionalQuestionColumn(questionInsert, questionColumnSupport, 'anchor_tier', Number(question.anchor_tier || 0));
    addOptionalQuestionColumn(questionInsert, questionColumnSupport, 'difficulty_weight', difficultyWeight);
    addOptionalQuestionColumn(questionInsert, questionColumnSupport, 'question_type', question.question_type || null);
    addOptionalQuestionColumn(questionInsert, questionColumnSupport, 'passage_group_id', question.passage_group_id || question.group_id || null);
    addOptionalQuestionColumn(questionInsert, questionColumnSupport, 'passage_id', question.passage_id || null);
    addOptionalQuestionColumn(questionInsert, questionColumnSupport, 'passage_type', question.passage_type || null);
    addOptionalQuestionColumn(questionInsert, questionColumnSupport, 'order_index', Number(question.order_index || 0) || null);

    const { data, error } = await supabase
      .from('questions')
      .insert(questionInsert)
      .select('id')
      .single();

    if (error) throw error;
    console.log(`[draft] Saved ${data.id} | reason=${reason}`);
    return { success: true, id: data.id };
  } catch (error) {
    console.warn(`[draft] save failed: ${error.message}`);
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

async function getQuestionColumnSupport() {
  if (!questionColumnSupportPromise) {
    questionColumnSupportPromise = probeQuestionColumnSupport();
  }

  return questionColumnSupportPromise;
}

async function probeQuestionColumnSupport() {
  const support = Object.fromEntries(OPTIONAL_QUESTION_COLUMNS.map((column) => [column, true]));

  for (const column of OPTIONAL_QUESTION_COLUMNS) {
    const { error } = await supabase
      .from('questions')
      .select(`id,${column}`)
      .limit(1);

    if (error?.code === '42703' || /does not exist|schema cache/i.test(error?.message || '')) {
      support[column] = false;
    } else if (error) {
      console.warn(`[publish] column probe warning for questions.${column}: ${error.message}`);
    }
  }

  const missingColumns = Object.entries(support)
    .filter(([, supported]) => !supported)
    .map(([column]) => column);

  if (missingColumns.length > 0) {
    console.warn(`[publish] optional question columns unavailable; traceability retained in tags only: ${missingColumns.join(', ')}`);
  }

  return support;
}

function addOptionalQuestionColumn(target, support, column, value) {
  if (!support[column]) return;
  target[column] = value;
}
