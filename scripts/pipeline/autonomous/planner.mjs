import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'node:fs';
import { CANONICAL_SYLLABUS, TOP_SUBJECTS, isValidTopSyllabusPair } from '../../../data/canonical_syllabus.js';
import {
  getCuetOverrideConfig,
  getEnglishNtaChapterPlan,
  isJobAllowedByOverride,
  logOverrideConfig,
} from '../lib/overrideConfig.mjs';

const supabase = process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY
  ? createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)
  : null;

const MAX_JOBS_PER_RUN = 10;
const MAX_JOBS_PER_CHAPTER = 2;
const TOP_SUBJECT_SET = new Set(TOP_SUBJECTS);
const VALID_SUBJECTS = new Set(
  CANONICAL_SYLLABUS
    .map((subject) => subject.subject_id)
    .filter((subjectId) => TOP_SUBJECT_SET.has(subjectId))
);
const SYLLABUS_MAP = new Map(
  CANONICAL_SYLLABUS
    .filter((subject) => TOP_SUBJECT_SET.has(subject.subject_id))
    .map((subject) => [
      subject.subject_id,
      new Set(subject.units.flatMap((unit) => unit.chapters)),
    ])
);

const SUBJECT_PRIORITY_CONFIG = loadJsonConfig('../../../data/cuet_subject_priorities.json', {
  tiers: {},
  aliases: {},
  exam_importance_boost: {},
  default_tier: 'C',
});
const CHAPTER_PRIORITY_CONFIG = loadJsonConfig('../../../data/cuet_chapter_priorities.json', {});
const TIER_ORDER = ['S', 'A', 'B', 'C', 'D'];
const TIER_TARGET_COUNTS = { S: 6, A: 3, B: 1, C: 0, D: 0 };

function loadJsonConfig(relativePath, fallback) {
  try {
    return JSON.parse(readFileSync(new URL(relativePath, import.meta.url), 'utf8'));
  } catch (error) {
    console.warn('[planner] priority_config_load_failed', {
      file: relativePath,
      error: error.message,
    });
    return fallback;
  }
}

function normalizeId(id) {
  return String(id)
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_|_$/g, '');
}

function canonicalPrioritySubject(subject) {
  const id = normalizeId(subject);
  return SUBJECT_PRIORITY_CONFIG.aliases?.[id] || id;
}

function getGapSubject(gap) {
  return normalizeId(gap?.subject || gap?.subject_id || '');
}

export function getSubjectPriority(subject) {
  const canonical = canonicalPrioritySubject(subject);
  for (const tier of TIER_ORDER) {
    const tierConfig = SUBJECT_PRIORITY_CONFIG.tiers?.[tier];
    const subjects = new Set((tierConfig?.subjects || []).map(canonicalPrioritySubject));
    if (subjects.has(canonical)) {
      return {
        tier,
        priority_weight: Number(tierConfig.priority_weight || 0),
        target_coverage_per_chapter: Number(tierConfig.target_coverage_per_chapter || 20),
        planner_share: Number(tierConfig.planner_share || 0),
        exam_importance_boost: getExamImportanceBoost(canonical),
      };
    }
  }

  const defaultTier = SUBJECT_PRIORITY_CONFIG.default_tier || 'C';
  const defaultConfig = SUBJECT_PRIORITY_CONFIG.tiers?.[defaultTier] || {};
  return {
    tier: defaultTier,
    priority_weight: Number(defaultConfig.priority_weight || 0.2),
    target_coverage_per_chapter: Number(defaultConfig.target_coverage_per_chapter || 20),
    planner_share: Number(defaultConfig.planner_share || 0.04),
    exam_importance_boost: getExamImportanceBoost(canonical),
  };
}

function getExamImportanceBoost(subject) {
  const canonical = canonicalPrioritySubject(subject);
  return Number(SUBJECT_PRIORITY_CONFIG.exam_importance_boost?.[canonical] || 0);
}

function getChapterPriorityBoost(subject, chapter) {
  const canonical = canonicalPrioritySubject(subject);
  const chapters = CHAPTER_PRIORITY_CONFIG[canonical] || [];
  const chapterId = normalizeComparable(chapter);
  return chapters.some((entry) => normalizeComparable(entry) === chapterId) ? 10 : 0;
}

function normalizeComparable(value) {
  return String(value || '')
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function isValidSyllabusGap(gap) {
  const subjectId = getGapSubject(gap);
  return VALID_SUBJECTS.has(subjectId) && isValidTopSyllabusPair(subjectId, gap?.chapter);
}

export function scorePlannerGap(gap) {
  const subjectId = getGapSubject(gap);
  const priority = getSubjectPriority(subjectId);
  const currentChapterCount = Number(gap?.question_count ?? gap?.count ?? 0);
  const targetCoverage = priority.target_coverage_per_chapter;
  const coverageGap = Math.max(0, targetCoverage - currentChapterCount);
  const recentQualityNeedScore = Number(gap?.recent_quality_need_score || 0);
  const saturationPenalty = currentChapterCount >= targetCoverage ? 100 : 0;
  const recentYieldRate = Number(gap?.recent_yield_rate ?? gap?.yield_rate ?? 1);
  const lowYieldPenalty = recentYieldRate < 0.2 && !['S', 'A'].includes(priority.tier) ? 20 : 0;
  const chapterPriorityBoost = getChapterPriorityBoost(subjectId, gap?.chapter);
  const finalScore =
    priority.priority_weight * 100 +
    coverageGap +
    recentQualityNeedScore +
    priority.exam_importance_boost +
    chapterPriorityBoost -
    saturationPenalty -
    lowYieldPenalty;

  return {
    ...gap,
    subject_id: subjectId,
    subject: subjectId,
    priority_tier: priority.tier,
    priority_weight: priority.priority_weight,
    current_chapter_count: currentChapterCount,
    target_coverage: targetCoverage,
    coverage_gap: coverageGap,
    recent_quality_need_score: recentQualityNeedScore,
    exam_importance_boost: priority.exam_importance_boost,
    saturation_penalty: saturationPenalty,
    low_yield_penalty: lowYieldPenalty,
    chapter_priority_boost: chapterPriorityBoost,
    final_score: Number(finalScore.toFixed(2)),
    priority: Number(finalScore.toFixed(2)),
  };
}

export function rankPlannerGapsForTests(gaps, override = null) {
  const overrideConfig = override || getCuetOverrideConfig();
  return (gaps || [])
    .filter(isValidSyllabusGap)
    .filter((gap) => isJobAllowedByOverride(gap, overrideConfig).allowed)
    .map(scorePlannerGap)
    .map((gap) => applyOverridePriorityBoost(gap, overrideConfig))
    .sort(compareGaps);
}

export function selectPlannerJobsForTests(gaps, limit = MAX_JOBS_PER_RUN, override = null) {
  return selectPlannerJobs(rankPlannerGapsForTests(gaps, override), limit);
}

export async function planGeneration(gaps) {
  console.log('Planning generation jobs...');
  const overrideConfig = getCuetOverrideConfig();
  logOverrideConfig(overrideConfig);
  const rankedPool = rankPlannerGapsForTests(gaps, overrideConfig);
  const syllabusTotal = rankedPool.length;
  const coveredChapters = rankedPool.filter((gap) => gap.current_chapter_count > 0).length;
  const missingCount = rankedPool.filter((gap) => gap.current_chapter_count === 0).length;

  console.log('[planner] syllabus_total:', syllabusTotal);
  console.log('[planner] db_covered:', coveredChapters);
  console.log('[planner] missing_chapters:', missingCount);

  if (rankedPool.length === 0) {
    const fallbackPool = getFallbackPriorityChapters(overrideConfig)
      .filter((gap) => isJobAllowedByOverride(gap, overrideConfig).allowed)
      .map(scorePlannerGap)
      .map((gap) => applyOverridePriorityBoost(gap, overrideConfig))
      .sort(compareGaps);
    if (fallbackPool.length === 0) {
      console.log('[planner] No new jobs needed across any tier.');
      return [];
    }
    rankedPool.push(...fallbackPool);
  }

  for (const gap of rankedPool.slice(0, 30)) {
    console.log('[planner_priority]', {
      subject: gap.subject_id,
      tier: gap.priority_tier,
      priority_weight: gap.priority_weight,
      current_chapter_count: gap.current_chapter_count,
      target_coverage: gap.target_coverage,
      coverage_gap: gap.coverage_gap,
      final_score: gap.final_score,
    });
  }

  const selected = selectPlannerJobs(rankedPool, overrideConfig.max_jobs || MAX_JOBS_PER_RUN);
  if (selected.length === 0) {
    console.log('[planner] No new jobs to insert.');
    return [];
  }

  const topJobs = selected.map((gap) => ({
    subject_id: gap.subject_id,
    chapter: gap.chapter,
    target_count: overrideConfig.target_count || 15,
    priority: gap.final_score,
    _coverage: gap.current_chapter_count,
    status: 'queued',
  }));

  const distribution = countTierMix(topJobs);
  console.log('[planner_distribution]', distribution);
  console.log('[planner] OUTPUT_JOBS:', topJobs.map((job) => ({
    expected_subject: job.subject_id,
    expected_chapter: job.chapter,
    tier: getSubjectPriority(job.subject_id).tier,
    priority: job.priority,
    target_count: job.target_count,
  })));

  console.log('[queue] INSERT_GENERATION_JOBS_REQUEST:', topJobs.map((job) => ({
    subject_id: job.subject_id,
    chapter: job.chapter,
    status: job.status,
    priority: job.priority,
  })));

  if (!supabase) {
    console.warn('[planner] supabase_unavailable_returning_uninserted_jobs');
    return topJobs;
  }

  const { data, error } = await supabase
    .from('generation_jobs')
    .insert(topJobs.map(({ _coverage, ...job }) => job))
    .select('*');

  if (error) {
    console.error('[planner] Error creating jobs:', error);
    return [];
  }

  console.log('[queue] INSERT_GENERATION_JOBS_RESULT:', (data || []).map((job) => ({
    id: job.id,
    subject_id: job.subject_id,
    chapter: job.chapter,
    status: job.status,
    priority: job.priority,
    created_at: job.created_at,
  })));

  console.log(`[planner] Created ${data ? data.length : 0} new generation jobs.`);
  return data || [];
}

function selectPlannerJobs(rankedPool, limit) {
  const buckets = Object.fromEntries(TIER_ORDER.map((tier) => [tier, []]));
  for (const gap of rankedPool) {
    buckets[gap.priority_tier || getSubjectPriority(gap.subject_id).tier]?.push(gap);
  }

  const selected = [];
  const selectedKeys = new Set();
  const chapterCounts = new Map();

  for (const tier of TIER_ORDER) {
    const unsaturated = (buckets[tier] || []).filter((gap) => gap.current_chapter_count < gap.target_coverage);
    pickInto(selected, unsaturated, Math.min(TIER_TARGET_COUNTS[tier] || 0, limit - selected.length), chapterCounts, selectedKeys);
  }

  const overflow = rankedPool.filter((gap) => !selectedKeys.has(getGapKey(gap)));
  pickInto(selected, overflow, limit - selected.length, chapterCounts, selectedKeys);
  return selected;
}

function pickInto(selected, candidates, limit, chapterCounts, selectedKeys) {
  if (limit <= 0) return;
  for (const candidate of candidates || []) {
    if (limit <= 0) break;
    const key = getGapKey(candidate);
    if (selectedKeys.has(key)) continue;
    const chapterKey = `${candidate.subject_id}::${candidate.chapter}`;
    if ((chapterCounts.get(chapterKey) || 0) >= MAX_JOBS_PER_CHAPTER) continue;
    selected.push(candidate);
    selectedKeys.add(key);
    chapterCounts.set(chapterKey, (chapterCounts.get(chapterKey) || 0) + 1);
    limit -= 1;
  }
}

function getGapKey(gap) {
  return `${gap.subject_id || getGapSubject(gap)}::${gap.chapter}`;
}

function getFallbackPriorityChapters(overrideConfig = getCuetOverrideConfig()) {
  const fallback = [];
  const subjects = overrideConfig.subjects?.length > 0
    ? overrideConfig.subjects
    : ['english', 'gat', 'chemistry', 'physics', 'mathematics', 'economics', 'business_studies', 'accountancy', 'biology'];
  if (overrideConfig.mode === 'nta' && overrideConfig.subjects?.length === 1 && overrideConfig.subjects[0] === 'english') {
    return getEnglishNtaChapterPlan().map((entry, index) => ({
      subject_id: 'english',
      subject: 'english',
      chapter: entry.chapter,
      count: 0,
      question_count: 0,
      recent_quality_need_score: 20 - index,
      type: 'ENGLISH_NTA_OVERRIDE_FALLBACK',
    })).filter((gap) => isJobAllowedByOverride(gap, overrideConfig).allowed);
  }
  for (const subjectId of subjects) {
    const chapters = SYLLABUS_MAP.get(subjectId);
    if (!chapters) continue;
    for (const chapter of chapters) {
      fallback.push({
        subject_id: subjectId,
        subject: subjectId,
        chapter,
        count: 0,
        question_count: 0,
        type: 'PRIORITY_FALLBACK',
      });
    }
  }
  return fallback;
}

function applyOverridePriorityBoost(gap, overrideConfig = getCuetOverrideConfig()) {
  if (!overrideConfig?.active) return gap;
  let boost = 0;
  if (overrideConfig.subjects?.length > 0 && overrideConfig.subjects.includes(gap.subject_id)) boost += 200;
  if (overrideConfig.chapters?.length > 0 && overrideConfig.chapters.includes(normalizeComparable(gap.chapter))) boost += 100;
  if (overrideConfig.mode === 'nta' && gap.subject_id === 'english') {
    const chapterPlan = getEnglishNtaChapterPlan();
    const planIndex = chapterPlan.findIndex((entry) => normalizeComparable(entry.chapter) === normalizeComparable(gap.chapter));
    if (planIndex >= 0) boost += 80 - planIndex * 10;
  }
  if (boost <= 0) return gap;
  const finalScore = Number((Number(gap.final_score || 0) + boost).toFixed(2));
  return {
    ...gap,
    override_priority_boost: boost,
    final_score: finalScore,
    priority: finalScore,
  };
}

function compareGaps(a, b) {
  return b.final_score - a.final_score ||
    a.current_chapter_count - b.current_chapter_count ||
    String(a.subject_id).localeCompare(String(b.subject_id)) ||
    String(a.chapter).localeCompare(String(b.chapter));
}

function countTierMix(jobs) {
  const counts = {
    tier_s_selected: 0,
    tier_a_selected: 0,
    tier_b_selected: 0,
    tier_c_selected: 0,
    tier_d_selected: 0,
    total_jobs: jobs.length,
  };
  for (const job of jobs) {
    const tier = getSubjectPriority(job.subject_id).tier.toLowerCase();
    const key = `tier_${tier}_selected`;
    if (key in counts) counts[key] += 1;
  }
  return counts;
}
