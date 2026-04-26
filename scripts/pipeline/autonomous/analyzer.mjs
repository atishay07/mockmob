import { createClient } from '@supabase/supabase-js';
import { SUBJECTS } from '../../../data/subjects.js';

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// ── Tier-aware gap thresholds ─────────────────────────────────────────────────
// Tier 1 subjects need deep coverage (CUET high-demand); Tier 2/3 need less.
// These thresholds must stay in sync with the tier definitions in planner.mjs.
const TIER1_GAP_THRESHOLD = 150;  // keep generating Tier-1 until 150 q/chapter
const TIER2_GAP_THRESHOLD = 75;   // Tier-2 target: 75 q/chapter
const TIER3_GAP_THRESHOLD = 50;   // Tier-3 target: 50 q/chapter (original default)

function normalizeId(id) {
  return String(id)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_|_$/g, '');
}

// Mirror of RAW_SUBJECT_TIERS in planner.mjs — keep in sync.
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

/**
 * Priority score for a gap — lower number = higher urgency.
 * Scales relative to the tier's own threshold so all tiers are compared fairly.
 */
function getPriority(count, threshold) {
  if (count === 0) return 1;                           // empty — critical
  if (count < threshold * 0.1) return 2;              // <10 % filled
  if (count < threshold * 0.25) return 3;             // <25 % filled
  if (count < threshold * 0.5) return 4;              // <50 % filled
  return 5;                                            // 50–99 % filled
}

/**
 * COVERAGE ANALYZER
 * Scans the database to identify gaps in question coverage.
 * Gap thresholds are tier-aware: Tier 1 targets 150 q/chapter, Tier 2 targets
 * 75 q/chapter, Tier 3 targets 50 q/chapter.
 */
export async function analyzeCoverage() {
  console.log('🧐 Analyzing database coverage...');

  // 1. Get counts from DB
  const { data: counts, error } = await supabase
    .from('questions')
    .select('subject, chapter')
    .eq('is_deleted', false);

  if (error) throw error;

  const coverage = {};

  // Initialize with zeros for all subjects/chapters
  for (const s of SUBJECTS) {
    coverage[s.id] = { name: s.name, total: 0, chapters: {} };
    for (const c of s.chapters) {
      coverage[s.id].chapters[c] = 0;
    }
  }

  // Populate counts
  for (const row of (counts || [])) {
    if (coverage[row.subject] && coverage[row.subject].chapters[row.chapter] !== undefined) {
      coverage[row.subject].chapters[row.chapter]++;
      coverage[row.subject].total++;
    }
  }

  // 2. Identify gaps (tier-aware thresholds)
  const gaps = [];
  for (const sid in coverage) {
    const threshold = getThreshold(sid);
    for (const cid in coverage[sid].chapters) {
      const count = coverage[sid].chapters[cid];
      if (count < threshold) {
        gaps.push({
          subject_id: sid,
          chapter: cid,
          count,
          priority: getPriority(count, threshold),
          type: count === 0 ? 'EMPTY' : 'LOW',
        });
      }
    }
  }

  // Debug: log tier-split breakdown so operators can verify thresholds are working
  const tier1Gaps = gaps.filter((g) => TIER1_SUBJECTS.has(normalizeId(g.subject_id)));
  const tier2Gaps = gaps.filter((g) => TIER2_SUBJECTS.has(normalizeId(g.subject_id)));
  const tier3Gaps = gaps.filter((g) => !TIER1_SUBJECTS.has(normalizeId(g.subject_id)) && !TIER2_SUBJECTS.has(normalizeId(g.subject_id)));

  console.log(`[analyzer] Found ${gaps.length} chapters with low coverage:`, {
    tier1_gaps: tier1Gaps.length,
    tier2_gaps: tier2Gaps.length,
    tier3_gaps: tier3Gaps.length,
    thresholds: { tier1: TIER1_GAP_THRESHOLD, tier2: TIER2_GAP_THRESHOLD, tier3: TIER3_GAP_THRESHOLD },
  });

  return { coverage, gaps };
}
