import { createClient } from '@supabase/supabase-js';
import { CANONICAL_SYLLABUS, TOP_SUBJECTS, isValidTopSyllabusPair } from '../../../data/canonical_syllabus.js';

const supabase = process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY
  ? createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)
  : null;

const GAP_THRESHOLD = 50;
const TOP_SUBJECT_SET = new Set(TOP_SUBJECTS);

const SYLLABUS_MAP = new Map(
  CANONICAL_SYLLABUS.filter((subject) => TOP_SUBJECT_SET.has(subject.subject_id)).map((subject) => [
    subject.subject_id,
    new Set(subject.units.flatMap((unit) => unit.chapters)),
  ])
);

const SYLLABUS_SUBJECTS = new Map(
  CANONICAL_SYLLABUS.filter((subject) => TOP_SUBJECT_SET.has(subject.subject_id)).map((subject) => [subject.subject_id, subject])
);

function normalizeChapterName(chapter) {
  return String(chapter || '')
    .toLowerCase()
    .trim()
    .replace(/&/g, ' and ')
    .replace(/\band\b/g, ' and ')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .replace(/\s+/g, ' ');
}

function getThreshold(subjectId) {
  return TOP_SUBJECT_SET.has(subjectId) ? GAP_THRESHOLD : 0;
}

function getTier(subjectId) {
  return TOP_SUBJECT_SET.has(subjectId) ? 1 : 3;
}

/**
 * Priority score for a chapter - higher number = higher urgency.
 * Scales relative to the tier's own threshold so all tiers are compared fairly.
 */
function getPriority(count, threshold) {
  if (count === 0) return 100;
  if (count < 10) return 90;
  if (count < 25) return 75;
  if (count < 50) return 60;
  return 10;
}

/**
 * COVERAGE ANALYZER
 * Builds a syllabus-driven view of question coverage.
 * Every canonical subject/chapter is included, even if the DB has 0 rows.
 */
export async function analyzeCoverage() {
  console.log('🧐 Analyzing database coverage...');

  if (!supabase) {
    console.warn('[analyzer] supabase_unavailable_returning_empty_coverage');
    return { gaps: [], summary: { unavailable: true } };
  }

  const counts = [];
  const pageSize = 1000;
  for (let from = 0; ; from += pageSize) {
    const { data, error } = await supabase
      .from('questions')
      .select('subject, chapter')
      .in('subject', TOP_SUBJECTS)
      .eq('is_deleted', false)
      .range(from, from + pageSize - 1);

    if (error) throw error;
    counts.push(...(data || []));
    if (!data || data.length < pageSize) break;
  }

  const coverage = {};
  const chapterLookup = {};

  // Initialize from canonical syllabus, not from DB presence.
  for (const [subjectId, chapters] of SYLLABUS_MAP) {
    const subject = SYLLABUS_SUBJECTS.get(subjectId);
    coverage[subjectId] = { name: subject?.subject_name || subjectId, total: 0, chapters: {} };
    chapterLookup[subjectId] = {};

    for (const chapter of chapters) {
      coverage[subjectId].chapters[chapter] = 0;
      chapterLookup[subjectId][normalizeChapterName(chapter)] = chapter;
    }
  }

  // Count only DB rows that map to canonical subject/chapter pairs.
  const dbCoveredKeys = new Set();
  for (const row of counts) {
    const subjectId = row.subject;
    if (!TOP_SUBJECT_SET.has(subjectId) || !SYLLABUS_MAP.has(subjectId)) continue;

    const canonicalChapter = chapterLookup[subjectId]?.[normalizeChapterName(row.chapter)];

    if (!canonicalChapter || !isValidTopSyllabusPair(subjectId, canonicalChapter)) continue;

    coverage[subjectId].chapters[canonicalChapter]++;
    coverage[subjectId].total++;
    dbCoveredKeys.add(`${subjectId}::${canonicalChapter}`);
  }

  const gaps = [];
  let totalChapters = 0;
  let missingCount = 0;

  for (const subjectId in coverage) {
    const threshold = getThreshold(subjectId);

    for (const chapter in coverage[subjectId].chapters) {
      totalChapters += 1;
      const count = coverage[subjectId].chapters[chapter];
      if (count === 0) missingCount += 1;

      gaps.push({
        subject_id: subjectId,
        subject: subjectId,
        chapter,
        count,
        question_count: count,
        target: threshold,
        tier: getTier(subjectId),
        gap: threshold - count,
        priority: getPriority(count, threshold),
        type: count === 0 ? 'EMPTY' : count < threshold ? 'LOW' : 'AT_TARGET',
      });
    }
  }

  const tier1Gaps = gaps.filter((g) => TOP_SUBJECT_SET.has(g.subject_id));
  const tier2Gaps = [];
  const tier3Gaps = [];

  console.log(`[analyzer] Found ${gaps.length} syllabus chapters in planner pool:`, {
    tier1_gaps: tier1Gaps.length,
    tier2_gaps: tier2Gaps.length,
    tier3_gaps: tier3Gaps.length,
    syllabus_total: totalChapters,
    db_covered: dbCoveredKeys.size,
    missing_chapters: missingCount,
    thresholds: { top_subjects: GAP_THRESHOLD },
  });

  return { coverage, gaps };
}
