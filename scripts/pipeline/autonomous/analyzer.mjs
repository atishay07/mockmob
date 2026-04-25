import { createClient } from '@supabase/supabase-js';
import { SUBJECTS } from '../../../data/subjects.js';

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

/**
 * COVERAGE ANALYZER
 * Scans the database to identify gaps in question coverage.
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

  // 2. Identify Gaps
  const gaps = [];
  for (const sid in coverage) {
    for (const cid in coverage[sid].chapters) {
      const count = coverage[sid].chapters[cid];
      if (count < 50) { // Gap threshold
        gaps.push({
          subject_id: sid,
          chapter: cid,
          count,
          priority: count < 10 ? 1 : 5, // Higher priority for near-empty chapters
          type: count === 0 ? 'EMPTY' : 'LOW'
        });
      }
    }
  }

  console.log(`Found ${gaps.length} chapters with low coverage.`);
  return { coverage, gaps };
}
