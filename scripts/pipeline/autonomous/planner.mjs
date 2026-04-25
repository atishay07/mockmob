import { createClient } from '@supabase/supabase-js';

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
const RAW_SUBJECT_TIERS = {
  1: new Set([
    'accountancy', 'economics', 'business_studies', 'mathematics', 'english',
    'general_test', 'physics', 'chemistry', 'biology', 'history',
  ]),
  2: new Set([
    'political_science', 'geography', 'psychology', 'sociology', 'computer_science',
    'informatics_practices', 'physical_education', 'home_science', 'environmental_studies',
  ]),
  3: new Set([
    'fine_arts', 'performing_arts', 'theatre', 'mass_media', 'agriculture',
    'engineering_graphics', 'legal_studies', 'entrepreneurship', 'teaching_aptitude', 'tourism',
    'fashion_studies', 'design', 'music', 'dance', 'hindi', 'sanskrit', 'urdu', 'punjabi',
    'bengali', 'marathi', 'tamil', 'telugu', 'kannada', 'malayalam', 'gujarati', 'odia',
  ]),
};
const SUBJECT_TIERS = Object.fromEntries(
  Object.entries(RAW_SUBJECT_TIERS).map(([tier, values]) => [
    tier,
    new Set([...values].map((value) => normalizeId(value))),
  ])
);

/**
 * PLANNER (Intelligence Layer)
 * Prioritizes gaps and creates generation_jobs.
 */
export async function planGeneration(gaps) {
  console.log('📅 Planning generation jobs...');

  // 1. Fetch all currently active jobs in one go to avoid N+1 queries
  const { data: activeJobs, error: fetchErr } = await supabase
    .from('generation_jobs')
    .select('subject_id, chapter')
    .in('status', ['queued', 'processing']);

  if (fetchErr) throw fetchErr;

  const activeJobKeys = new Set((activeJobs || []).map(j => `${j.subject_id}|${j.chapter}`));
  const jobsToCreate = [];

  for (const gap of gaps) {
    // Safety check: Avoid saturated chapters
    if (gap.count >= MAX_PER_CHAPTER_TOTAL) continue;

    // Check if a job is already queued for this chapter (using the pre-fetched set)
    if (activeJobKeys.has(`${gap.subject_id}|${gap.chapter}`)) continue;

    // Plan a job to fill the gap
    jobsToCreate.push({
      subject_id: gap.subject_id,
      chapter: gap.chapter,
      target_count: 10,
      priority: gap.priority,
      status: 'queued'
    });
  }

  if (jobsToCreate.length === 0) {
    console.log('No new jobs needed.');
    return [];
  }

  // Insert top priority jobs with stronger subject-tier batching.
  const rankedJobs = jobsToCreate.sort((a, b) => b.priority - a.priority);
  const tierBuckets = { 1: [], 2: [], 3: [] };

  for (const job of rankedJobs) {
    const tier = getSubjectTier(job.subject_id);
    console.log("Subject:", job.subject_id, "→ normalized:", normalizeId(job.subject_id), "→ tier:", tier);
    tierBuckets[tier].push(job);
  }

  const topJobs = [];
  const tierTargets = { 1: 8, 2: 1, 3: 1 };

  while (topJobs.length < MAX_JOBS_PER_RUN && tierBuckets[1].length > 0) {
    topJobs.push(tierBuckets[1].shift());
  }

  if (topJobs.length < MAX_JOBS_PER_RUN) {
    while (topJobs.length < MAX_JOBS_PER_RUN && topJobs.filter((job) => getSubjectTier(job.subject_id) === 2).length < tierTargets[2] && tierBuckets[2].length > 0) {
      topJobs.push(tierBuckets[2].shift());
    }
  }

  if (topJobs.length < MAX_JOBS_PER_RUN && tierBuckets[1].length === 0) {
    while (topJobs.length < MAX_JOBS_PER_RUN && topJobs.filter((job) => getSubjectTier(job.subject_id) === 3).length < tierTargets[3] && tierBuckets[3].length > 0) {
      topJobs.push(tierBuckets[3].shift());
    }
  }

  for (const tier of [1, 2, 3]) {
    while (topJobs.length < MAX_JOBS_PER_RUN && tierBuckets[tier].length > 0) {
      topJobs.push(tierBuckets[tier].shift());
    }
  }

  console.log('SUBJECT TIERS:');
  console.log(countTierMix(topJobs));

  const { data, error } = await supabase
    .from('generation_jobs')
    .insert(topJobs)
    .select('*');

  if (error) {
    console.error('Error creating jobs:', error);
    return [];
  }

  console.log(`Created ${data ? data.length : 0} new generation jobs.`);
  return data || [];
}

function getSubjectTier(subjectId) {
  const id = normalizeId(subjectId);
  if (SUBJECT_TIERS[1].has(id)) return 1;
  if (SUBJECT_TIERS[2].has(id)) return 2;
  return 3;
}

function countTierMix(jobs) {
  return {
    tier1: jobs.filter((job) => getSubjectTier(job.subject_id) === 1).length,
    tier2: jobs.filter((job) => getSubjectTier(job.subject_id) === 2).length,
    tier3: jobs.filter((job) => getSubjectTier(job.subject_id) === 3).length,
  };
}
