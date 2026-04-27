import { createClient } from '@supabase/supabase-js';
import { CANONICAL_SYLLABUS } from '../../../data/canonical_syllabus.js';

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// Tier-aware gap thresholds.
// Tier 1 subjects need deep coverage (CUET high-demand); Tier 2/3 need less.
// These thresholds must stay in sync with the tier definitions in planner.mjs.
const TIER1_GAP_THRESHOLD = 150;  // keep generating Tier-1 until 150 q/chapter
const TIER2_GAP_THRESHOLD = 75;   // Tier-2 target: 75 q/chapter
const TIER3_GAP_THRESHOLD = 50;   // Tier-3 target: 50 q/chapter

const SYLLABUS_MAP = new Map(
  CANONICAL_SYLLABUS.map((subject) => [
    subject.subject_id,
    new Set(subject.units.flatMap((unit) => unit.chapters)),
  ])
);

const SYLLABUS_SUBJECTS = new Map(
  CANONICAL_SYLLABUS.map((subject) => [subject.subject_id, subject])
);

function normalizeId(id) {
  return String(id)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_|_$/g, '');
}

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

// Mirror of RAW_SUBJECT_TIERS in planner.mjs - keep in sync.
const TIER1_SUBJECTS = new Set([
  'physics', 'chemistry', 'biology', 'mathematics',
  'accountancy', 'economics', 'business_studies',
  'english', 'history',
  'gat', 'general_test',
].map(normalizeId));

const TIER2_SUBJECTS = new Set([
  'political_science', 'geography', 'psychology', 'sociology',
  'computer_science', 'informatics_practices',
  'physical_education', 'home_science', 'environmental_studies',
  'anthropology',
].map(normalizeId));

function getThreshold(subjectId) {
  const id = normalizeId(subjectId);
  if (TIER1_SUBJECTS.has(id)) return TIER1_GAP_THRESHOLD;
  if (TIER2_SUBJECTS.has(id)) return TIER2_GAP_THRESHOLD;
  return TIER3_GAP_THRESHOLD;
}

function getTier(subjectId) {
  const id = normalizeId(subjectId);
  if (TIER1_SUBJECTS.has(id)) return 1;
  if (TIER2_SUBJECTS.has(id)) return 2;
  return 3;
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

  const counts = [];
  const pageSize = 1000;
  for (let from = 0; ; from += pageSize) {
    const { data, error } = await supabase
      .from('questions')
      .select('subject, chapter')
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
    if (!SYLLABUS_MAP.has(subjectId)) continue;

    const canonicalChapter = chapterLookup[subjectId]?.[normalizeChapterName(row.chapter)];

    if (!canonicalChapter || !SYLLABUS_MAP.get(subjectId).has(canonicalChapter)) continue;

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

  const tier1Gaps = gaps.filter((g) => TIER1_SUBJECTS.has(normalizeId(g.subject_id)));
  const tier2Gaps = gaps.filter((g) => TIER2_SUBJECTS.has(normalizeId(g.subject_id)));
  const tier3Gaps = gaps.filter((g) => !TIER1_SUBJECTS.has(normalizeId(g.subject_id)) && !TIER2_SUBJECTS.has(normalizeId(g.subject_id)));

  console.log(`[analyzer] Found ${gaps.length} syllabus chapters in planner pool:`, {
    tier1_gaps: tier1Gaps.length,
    tier2_gaps: tier2Gaps.length,
    tier3_gaps: tier3Gaps.length,
    syllabus_total: totalChapters,
    db_covered: dbCoveredKeys.size,
    missing_chapters: missingCount,
    thresholds: { tier1: TIER1_GAP_THRESHOLD, tier2: TIER2_GAP_THRESHOLD, tier3: TIER3_GAP_THRESHOLD },
  });

  return { coverage, gaps };
}
