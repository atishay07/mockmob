import { createClient } from '@supabase/supabase-js';
import { SUBJECTS } from '../../../data/subjects.js';

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

const MAX_PER_CHAPTER_TOTAL = 200;
const MAX_JOBS_PER_RUN = 10;

// ── Tier definitions ──────────────────────────────────────────────────────────
// Every subject in the codebase is explicitly placed in a tier.
// Nothing falls through silently — unlisted subjects emit a warning and land
// in Tier 3 so the operator can triage.
const RAW_SUBJECT_TIERS = {
  1: new Set([
    // Core sciences
    'physics', 'chemistry', 'biology', 'mathematics',
    // Commerce / economics stream
    'accountancy', 'economics', 'business_studies',
    // High-demand general / language
    'english', 'history',
    // General Aptitude Test (both legacy and current DB ids)
    'gat', 'general_test',
  ]),
  2: new Set([
    'political_science', 'geography', 'psychology', 'sociology',
    'computer_science', 'informatics_practices',
    'physical_education', 'home_science', 'environmental_studies',
    'anthropology',
  ]),
  3: new Set([
    // Vocational / applied
    'fine_arts', 'performing_arts', 'theatre', 'mass_media', 'agriculture',
    'engineering_graphics', 'legal_studies', 'entrepreneurship',
    'teaching_aptitude', 'tourism', 'fashion_studies', 'design', 'music', 'dance',
    'knowledge_tradition_india',
    // Regional languages
    'hindi', 'sanskrit', 'urdu', 'punjabi', 'bengali', 'marathi',
    'tamil', 'telugu', 'kannada', 'malayalam', 'gujarati', 'odia', 'assamese',
  ]),
};

const SUBJECT_TIERS = Object.fromEntries(
  Object.entries(RAW_SUBJECT_TIERS).map(([tier, values]) => [
    tier,
    new Set([...values].map(normalizeId)),
  ])
);

// Validate at module load: every Tier-1 subject must be explicitly listed and
// not accidentally duplicated in a lower tier.
(function validateTierIntegrity() {
  const tier1Ids = [...SUBJECT_TIERS[1]];
  for (const id of tier1Ids) {
    if (SUBJECT_TIERS[2].has(id)) {
      console.error(`[planner] TIER_INTEGRITY_ERROR: "${id}" is in BOTH Tier 1 and Tier 2`);
    }
    if (SUBJECT_TIERS[3].has(id)) {
      console.error(`[planner] TIER_INTEGRITY_ERROR: "${id}" is in BOTH Tier 1 and Tier 3`);
    }
  }
})();

/**
 * Returns synthetic gap entries for EVERY chapter of every Tier-1 subject.
 * Used as a fallback when the analyzer reports zero Tier-1 gaps (all chapters
 * have already crossed the Tier-1 coverage threshold).  The planner will still
 * create jobs so the 90 / 10 distribution is maintained.
 */
function getAllTier1Chapters() {
  const fallbackGaps = [];
  for (const subject of SUBJECTS) {
    if (!SUBJECT_TIERS[1].has(normalizeId(subject.id))) continue;
    for (const chapter of subject.chapters || []) {
      fallbackGaps.push({
        subject_id: subject.id,
        chapter,
        count: 0,   // treat as if empty so priority math works
        priority: 5,
        type: 'TIER1_FALLBACK',
      });
    }
  }
  return fallbackGaps;
}

/**
 * PLANNER (Intelligence Layer)
 * Prioritises gaps and creates generation_jobs with strict 90 / 10 Tier-1 / other
 * distribution.  Tier filtering happens BEFORE candidate selection — not after.
 */
export async function planGeneration(gaps) {
  console.log('📅 Planning generation jobs...');

  // Active queued/processing jobs are intentionally ignored in local planning.
  const tier1GapCount = (gaps || []).filter((gap) => getSubjectTier(gap.subject_id) === 1).length;

  // ── 2. Split gaps into tier buckets BEFORE any other processing ─────────────
  // This is the key structural change: tier assignment is the FIRST filter,
  // not something applied after a mixed candidate list is built.
  const tierGaps = { 1: [], 2: [], 3: [] };
  const unmappedSubjects = new Set();

  for (const gap of gaps || []) {
    // Skip saturated chapters
    if (gap.count >= MAX_PER_CHAPTER_TOTAL) continue;
    const tier = getSubjectTier(gap.subject_id);

    // Warn on first encounter of any unlisted subject
    if (tier === 3 && !SUBJECT_TIERS[3].has(normalizeId(gap.subject_id))) {
      unmappedSubjects.add(gap.subject_id);
    }

    tierGaps[tier].push(gap);
  }

  // Warn for any subjects that silently defaulted to Tier 3
  for (const sid of unmappedSubjects) {
    console.warn(
      `[planner] UNMAPPED_SUBJECT: "${sid}" (normalized: "${normalizeId(sid)}") is not in any tier definition — defaulting to Tier 3. Add it explicitly to RAW_SUBJECT_TIERS.`,
    );
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
    tierGaps[tier].sort((a, b) => b.priority - a.priority);
  }

  // ── 6. Hard-enforce 90 / 10 distribution ────────────────────────────────────
  const TIER1_TARGET = Math.floor(MAX_JOBS_PER_RUN * 0.9); // 9
  const OTHER_TARGET = MAX_JOBS_PER_RUN - TIER1_TARGET;    // 1

  const tier1Picked = selectEvenlyAcrossSubjects(tierGaps[1], TIER1_TARGET);
  const tier1Shortfall = TIER1_TARGET - tier1Picked.length;

  if (tier1Shortfall > 0 && tierGaps[1].length > 0) {
    // We had SOME Tier-1 but not enough to fill the quota
    console.warn(
      `[planner] Tier-1 shortfall: wanted ${TIER1_TARGET}, available ${tier1Picked.length}. ` +
      `Filling remaining ${tier1Shortfall} slot(s) from Tier-2/3.`
    );
  }

  // Tier-2 and Tier-3 combined, sorted by priority
  const tier23Combined = [...tierGaps[2], ...tierGaps[3]]
    .sort((a, b) => b.priority - a.priority);

  // Other slots = normal OTHER_TARGET + any Tier-1 shortfall
  const otherAllowed = Math.min(OTHER_TARGET + tier1Shortfall, tier23Combined.length);
  const otherPicked = selectEvenlyAcrossSubjects(
    tier23Combined,
    otherAllowed,
    2,
    countBySubject(tier1Picked),
  );

  // Assemble final job list (Tier-1 first)
  const topJobs = [...tier1Picked, ...otherPicked].map((gap) => ({
    subject_id: gap.subject_id,
    chapter: gap.chapter,
    target_count: 18,
    priority: gap.priority,
    status: 'queued',
  }));

  if (topJobs.length === 0) {
    console.log('[planner] No new jobs to insert.');
    return [];
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
      'Check that Tier-1 subjects are present in the gap list and that subject IDs match RAW_SUBJECT_TIERS.'
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
    .insert(topJobs)
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

function selectEvenlyAcrossSubjects(candidates, limit, maxPerSubject = 2, initialCounts = new Map()) {
  if (limit <= 0 || !Array.isArray(candidates) || candidates.length === 0) return [];

  const groups = new Map();
  for (const candidate of candidates) {
    const subjectId = candidate.subject_id;
    if (!groups.has(subjectId)) groups.set(subjectId, []);
    groups.get(subjectId).push(candidate);
  }

  for (const group of groups.values()) {
    group.sort((a, b) => b.priority - a.priority);
  }

  const subjects = shuffleArray([...groups.keys()]);
  const selected = [];
  const counts = new Map(initialCounts);

  while (selected.length < limit) {
    let pickedThisRound = false;

    for (const subjectId of subjects) {
      if (selected.length >= limit) break;
      if ((counts.get(subjectId) || 0) >= maxPerSubject) continue;

      const group = groups.get(subjectId);
      if (!group || group.length === 0) continue;

      selected.push(group.shift());
      counts.set(subjectId, (counts.get(subjectId) || 0) + 1);
      pickedThisRound = true;
    }

    if (!pickedThisRound) break;
  }

  return selected;
}

function countBySubject(candidates) {
  const counts = new Map();
  for (const candidate of candidates || []) {
    counts.set(candidate.subject_id, (counts.get(candidate.subject_id) || 0) + 1);
  }
  return counts;
}

function shuffleArray(values) {
  const shuffled = [...values];
  for (let i = shuffled.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
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
