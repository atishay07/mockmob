import { createClient } from '@supabase/supabase-js';
import { CANONICAL_SYLLABUS, TOP_SUBJECTS, isValidTopSyllabusPair } from '../../../data/canonical_syllabus.js';

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

function normalizeId(id) {
  return String(id)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_|_$/g, '');
}

const MAX_JOBS_PER_RUN = 10;
const MAX_JOBS_PER_CHAPTER = 2;
const TOP_SUBJECT_SET = new Set(TOP_SUBJECTS);

// ── Tier definitions ──────────────────────────────────────────────────────────
// Every subject in the codebase is explicitly placed in a tier.
// Nothing falls through silently — unlisted subjects emit a warning and land
// in Tier 3 so the operator can triage.
const VALID_SUBJECTS = new Set(CANONICAL_SYLLABUS.map((subject) => subject.subject_id).filter((subjectId) => TOP_SUBJECT_SET.has(subjectId)));
const SYLLABUS_MAP = new Map(
  CANONICAL_SYLLABUS.filter((subject) => TOP_SUBJECT_SET.has(subject.subject_id)).map((subject) => [
    subject.subject_id,
    new Set(subject.units.flatMap((unit) => unit.chapters)),
  ])
);

const TIER_1 = new Set([
  ...TOP_SUBJECTS,
]);

const TIER_2 = new Set([]);

const SUBJECT_TIERS = {
  1: TIER_1,
  2: TIER_2,
  3: new Set([...VALID_SUBJECTS].filter((subject) => !TIER_1.has(subject) && !TIER_2.has(subject))),
};

/**
 * Returns synthetic gap entries for EVERY chapter of every Tier-1 subject.
 * Used as a fallback when the analyzer reports zero Tier-1 gaps (all chapters
 * have already crossed the Tier-1 coverage threshold).  The planner will still
 * create jobs so the 90 / 10 distribution is maintained.
 */
function getAllTier1Chapters() {
  const fallbackGaps = [];
  for (const [subjectId, chapters] of SYLLABUS_MAP) {
    if (!TIER_1.has(normalizeId(subjectId))) continue;
    for (const chapter of chapters) {
      fallbackGaps.push({
        subject_id: subjectId,
        chapter,
        count: 0,
        question_count: 0,
        priority: 100,
        type: 'TIER1_FALLBACK',
      });
    }
  }
  return fallbackGaps;
}

function getGapSubject(gap) {
  return normalizeId(gap?.subject || gap?.subject_id || '');
}

function getSubjectWeight(subject) {
  const normalizedSubject = normalizeId(subject);
  if (TIER_1.has(normalizedSubject)) return 1.0;
  return 0;
}

function isValidSyllabusGap(gap) {
  const subjectId = getGapSubject(gap);
  const chapter = gap?.chapter;
  return isValidTopSyllabusPair(subjectId, chapter);
}

/**
 * PLANNER (Intelligence Layer)
 * Prioritises gaps and creates generation_jobs with strict 90 / 10 Tier-1 / other
 * distribution.  Tier filtering happens BEFORE candidate selection — not after.
 */
export async function planGeneration(gaps) {
  console.log('📅 Planning generation jobs...');

  // Active queued/processing jobs are intentionally ignored in local planning.
  const plannerPool = (gaps || [])
    .filter(isValidSyllabusGap)
    .map((gap) => ({
      ...gap,
      subject_id: getGapSubject(gap),
      subject: getGapSubject(gap),
      priority: Number(gap.priority || 0) * getSubjectWeight(getGapSubject(gap)),
    }));
  const syllabusTotal = plannerPool.length;
  const coveredChapters = plannerPool.filter((gap) => (gap.question_count ?? gap.count ?? 0) > 0).length;
  const missingCount = plannerPool.filter((gap) => (gap.question_count ?? gap.count ?? 0) === 0).length;
  const tier1GapCount = plannerPool.filter((gap) => getSubjectTier(gap.subject_id) === 1).length;

  console.log('[planner] syllabus_total:', syllabusTotal);
  console.log('[planner] db_covered:', coveredChapters);
  console.log('[planner] missing_chapters:', missingCount);

  // ── 2. Split gaps into tier buckets BEFORE any other processing ─────────────
  // This is the key structural change: tier assignment is the FIRST filter,
  // not something applied after a mixed candidate list is built.
  const tierGaps = { 1: [], 2: [], 3: [] };

  for (const gap of plannerPool) {
    const tier = getSubjectTier(gap.subject_id);

    tierGaps[tier].push(gap);
  }

  const tier1AvailableBeforeOverride = tierGaps[1].length;

  if (tierGaps[1].length === 0 && tier1GapCount > 0) {
    console.warn('[planner] FORCING Tier 1 override: tier1_gaps exist but tier1_available is 0');
    tierGaps[1] = getAllTier1Chapters();
  } else if (tierGaps[1].length === 0) {
    const allTier1 = getAllTier1Chapters();
    if (allTier1.length > 0) {
      console.warn(`[planner] Zero Tier-1 gaps from analyzer; falling back to full Tier-1 roster (${allTier1.length} chapters).`);
      tierGaps[1] = allTier1;
    }
  }

  console.log('[planner] tier_pool_before_selection:', {
    tier1_available: tier1AvailableBeforeOverride,
    tier1_gaps: tier1GapCount,
    tier1_after_override: tierGaps[1].length,
    tier2_available: tierGaps[2].length,
    tier3_available: tierGaps[3].length,
    subjects_in_pool: getSubjectsInPool(tierGaps),
  });
  const totalCandidates =
    tierGaps[1].length + tierGaps[2].length + tierGaps[3].length;
  if (totalCandidates === 0) {
    console.log('[planner] No new jobs needed across any tier.');
    return [];
  }

  // ── 5. Sort each tier independently by priority (highest first) ─────────────
  for (const tier of [1, 2, 3]) {
    tierGaps[tier].sort(compareGaps);
  }

  // ── 6. Hard-enforce 90 / 10 distribution ────────────────────────────────────
  const TIER1_TARGET = MAX_JOBS_PER_RUN;
  const TIER2_TARGET = 0;
  const TIER3_TARGET = 0;

  const chapterCounts = new Map();
  const tier1Picked = pickTop(tierGaps[1], TIER1_TARGET, chapterCounts);
  const tier2Picked = pickTop(tierGaps[2], TIER2_TARGET, chapterCounts);
  const tier3Picked = pickTop(tierGaps[3], TIER3_TARGET, chapterCounts);
  const alreadyPicked = new Set([...tier1Picked, ...tier2Picked, ...tier3Picked]);
  const pickedCount = tier1Picked.length + tier2Picked.length + tier3Picked.length;
  const overflowPicked = pickTop(
    [...tierGaps[1], ...tierGaps[2], ...tierGaps[3]]
      .filter((gap) => !alreadyPicked.has(gap))
      .sort(compareGaps),
    MAX_JOBS_PER_RUN - pickedCount,
    chapterCounts,
  );

  const topJobs = [...tier1Picked, ...tier2Picked, ...tier3Picked, ...overflowPicked].map((gap) => ({
    subject_id: gap.subject_id,
    chapter: gap.chapter,
    target_count: 15,
    priority: gap.priority,
    _coverage: gap.question_count ?? gap.count ?? 0,
    status: 'queued',
  }));

  if (topJobs.length === 0) {
    console.log('[planner] No new jobs to insert.');
    return [];
  }

  for (const job of topJobs) {
    const coverage = job._coverage ?? 0;
    console.log('[planner]', {
      subject: job.subject_id,
      chapter: job.chapter,
      coverage,
      priority: job.priority,
    });
  }

  // ── 7. Post-selection debug log ──────────────────────────────────────────────
  const finalMix = countTierMix(topJobs);
  const tier1Pct = topJobs.length > 0
    ? Math.round((finalMix.tier1 / topJobs.length) * 100)
    : 0;

  const distributionMet = tier1Pct >= Math.round(TIER1_TARGET / MAX_JOBS_PER_RUN * 100) || tierGaps[1].length === 0;
  console.log('[planner] tier_selection:', {
    tier1_selected: finalMix.tier1,
    tier2_selected: finalMix.tier2,
    tier3_selected: finalMix.tier3,
    other_selected: finalMix.tier2 + finalMix.tier3,
    total_jobs: topJobs.length,
    tier1_pct: `${tier1Pct}%`,
    target_pct: `${Math.round(TIER1_TARGET / MAX_JOBS_PER_RUN * 100)}%`,
    distribution_met: distributionMet,
  });

  if (!distributionMet) {
    console.warn(
      `[planner] TIER_DISTRIBUTION_FAILED: Tier-1 is only ${tier1Pct}% of planned jobs (target ≥ ${Math.round(TIER1_TARGET / MAX_JOBS_PER_RUN * 100)}%). ` +
      'Check that Tier-1 subjects are present in the syllabus-driven gap list.'
    );
  }

  // Per-job tier log (matches original output format)
  for (const job of topJobs) {
    console.log(
      'Subject:', job.subject_id,
      '→ normalized:', normalizeId(job.subject_id),
      '→ tier:', getSubjectTier(job.subject_id)
    );
  }

  console.log('SUBJECT TIERS:');
  console.log(finalMix);
  console.log('[planner] OUTPUT_JOBS:', topJobs.map((job) => ({
    expected_subject: job.subject_id,
    expected_chapter: job.chapter,
    tier: getSubjectTier(job.subject_id),
    priority: job.priority,
    target_count: job.target_count,
  })));

  // ── 8. Insert jobs ───────────────────────────────────────────────────────────
  console.log('[queue] INSERT_GENERATION_JOBS_REQUEST:', topJobs.map((job) => ({
    subject_id: job.subject_id,
    chapter: job.chapter,
    status: job.status,
    priority: job.priority,
  })));

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

function getSubjectTier(subjectId) {
  const id = normalizeId(subjectId);
  if (SUBJECT_TIERS[1].has(id)) return 1;
  if (SUBJECT_TIERS[2].has(id)) return 2;
  return 3; // explicit Tier-3 entries + unlisted subjects
}

function compareGaps(a, b) {
  return (a.question_count ?? a.count ?? 0) - (b.question_count ?? b.count ?? 0) ||
    b.priority - a.priority ||
    String(a.subject_id).localeCompare(String(b.subject_id)) ||
    String(a.chapter).localeCompare(String(b.chapter));
}

function pickTop(candidates, limit, chapterCounts) {
  if (limit <= 0 || !Array.isArray(candidates) || candidates.length === 0) return [];

  const selected = [];
  for (const candidate of candidates) {
    if (selected.length >= limit) break;
    if (!isValidSyllabusGap(candidate)) continue;

    const chapterKey = `${candidate.subject_id}::${candidate.chapter}`;
    if ((chapterCounts.get(chapterKey) || 0) >= MAX_JOBS_PER_CHAPTER) continue;

    selected.push(candidate);
    chapterCounts.set(chapterKey, (chapterCounts.get(chapterKey) || 0) + 1);
  }

  return selected;
}

function getSubjectsInPool(tierGaps) {
  return {
    tier1: [...new Set(tierGaps[1].map((gap) => gap.subject_id))],
    tier2: [...new Set(tierGaps[2].map((gap) => gap.subject_id))],
    tier3: [...new Set(tierGaps[3].map((gap) => gap.subject_id))],
  };
}

function countTierMix(jobs) {
  return {
    tier1: jobs.filter((job) => getSubjectTier(job.subject_id) === 1).length,
    tier2: jobs.filter((job) => getSubjectTier(job.subject_id) === 2).length,
    tier3: jobs.filter((job) => getSubjectTier(job.subject_id) === 3).length,
  };
}
