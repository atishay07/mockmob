import { getCuetOverrideConfig, getEnglishNtaChapterPlan, isJobAllowedByOverride, logOverrideConfig } from '../lib/overrideConfig.mjs';
import { getEnglishGenerationMode } from '../lib/englishGenerationMode.mjs';
import { isPublishAllowedByQuality } from '../lib/qualityMode.mjs';

const override = getCuetOverrideConfig({ argv: process.argv.slice(2), env: process.env });
logOverrideConfig(override);
const jobs = [
  { subject_id: 'english', chapter: 'Narrative Passage', status: 'queued', target_count: 4 },
  { subject_id: 'english', chapter: 'Factual Passage', status: 'queued', target_count: 4 },
  { subject_id: 'english', chapter: 'Literary Passage', status: 'queued', target_count: 4 },
  { subject_id: 'english', chapter: 'Reading Comprehension', status: 'queued', target_count: 4 },
  { subject_id: 'english', chapter: 'Para Jumbles', status: 'queued', target_count: 8 },
  { subject_id: 'english', chapter: 'Match the Following', status: 'queued', target_count: 8 },
  { subject_id: 'english', chapter: 'Vocabulary', status: 'queued', target_count: 8 },
  { subject_id: 'physics', chapter: 'Electromagnetic Induction', status: 'queued', target_count: 8 },
  { subject_id: 'sociology', chapter: 'Social Institutions: Continuity and Change', status: 'queued', target_count: 8 },
];

const selectedJobs = jobs.filter((job) => isJobAllowedByOverride(job, override).allowed);
const englishPlan = override.mode === 'nta' && override.subjects.includes('english') ? getEnglishNtaChapterPlan() : [];
const orderedJobs = [...selectedJobs].sort((a, b) => {
  const ia = englishPlan.findIndex((entry) => entry.chapter === a.chapter);
  const ib = englishPlan.findIndex((entry) => entry.chapter === b.chapter);
  if (ia >= 0 || ib >= 0) return (ia < 0 ? 99 : ia) - (ib < 0 ? 99 : ib);
  return String(a.subject_id).localeCompare(String(b.subject_id));
});

const qualityMode = override.quality_mode || 'speed';
const simulatedValidation = qualityMode === 'premium'
  ? { verdict: 'accept', score: 0.91, exam_quality: 0.9, distractor_quality: 0.86, conceptual_depth: 0.78, trap_quality: 'high', cuet_alignment: true, answer_confidence: 0.97, factual_accuracy: true, quality_band: 'A_PLUS' }
  : { verdict: 'accept', score: 0.82, exam_quality: 0.8, distractor_quality: 0.76, conceptual_depth: 0.7, trap_quality: 'medium', cuet_alignment: true, answer_confidence: 0.94, factual_accuracy: true, quality_band: 'A' };

const result = {
  override,
  selected_order: orderedJobs.map((job) => `${job.subject_id}::${job.chapter}`),
  jobs_started: orderedJobs.length,
  jobs_completed: orderedJobs.length,
  generated_candidates: orderedJobs.reduce((sum, job) => sum + Number(job.target_count || 0), 0),
  passage_groups_planned: orderedJobs.filter((job) => job.subject_id === 'english' && getEnglishGenerationMode(job.chapter).requires_passage).length,
  quality_mode: qualityMode,
  would_publish_per_candidate: isPublishAllowedByQuality(simulatedValidation, {}, qualityMode, qualityMode === 'premium' ? 'strict' : 'mini').allowed,
  english_nta_distribution: englishPlan,
};

console.log(JSON.stringify(result, null, 2));
