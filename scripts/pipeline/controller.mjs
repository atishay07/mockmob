import fs from 'fs';
import path from 'path';
import { SUBJECTS } from '../../data/subjects.js';
import { TOP_SUBJECTS, isValidTopSyllabusPair } from '../../data/canonical_syllabus.js';
import { normalizeQuestion, scoreAndModerateQuestion } from './lib/llm.mjs';
import { isDuplicate } from './lib/dedupe.mjs';
import { publishBatch } from './lib/publish.mjs';

// Configuration
const RAW_DATA_DIR = './scripts/pipeline/data/raw';
const REJECTED_DATA_DIR = './scripts/pipeline/data/rejected';
const API_SECRET = process.env.INTERNAL_API_SECRET || 'test-secret';

// Pipeline Limits
const MAX_QUESTIONS_PER_RUN = 200;
const MAX_PER_CHAPTER = 50;
const BATCH_SIZE = 25;

async function runPipeline(subjectId) {
  console.log(`\n🚀 Starting PRODUCTION Ingestion Pipeline for ${subjectId}`);

  if (!TOP_SUBJECTS.includes(subjectId)) {
    console.warn(`[SKIP] ${subjectId} is outside the top-15 CUET generation scope.`);
    return;
  }

  const subject = SUBJECTS.find(s => s.id === subjectId);
  if (!subject) {
    console.error(`Subject ${subjectId} not found in subjects.js`);
    return;
  }

  // 1. Ingestion: Read raw data
  const rawFilePath = path.join(RAW_DATA_DIR, `${subjectId}.txt`);
  if (!fs.existsSync(rawFilePath)) {
    console.error(`Raw data file not found: ${rawFilePath}`);
    return;
  }

  const rawText = fs.readFileSync(rawFilePath, 'utf-8');
  const rawEntries = rawText.split('---').map(e => e.trim()).filter(e => e);

  console.log(`Loaded ${rawEntries.length} raw entries. Running with limit ${MAX_QUESTIONS_PER_RUN}.`);

  const finalQuestions = [];
  const processedHashes = new Set();
  const chapterCounts = {};
  const conceptPatterns = new Set();
  
  // Difficulty counters for distribution (30/40/30)
  const diffTargets = {
    easy: Math.floor(MAX_QUESTIONS_PER_RUN * 0.30),
    medium: Math.floor(MAX_QUESTIONS_PER_RUN * 0.40),
    hard: Math.floor(MAX_QUESTIONS_PER_RUN * 0.30)
  };
  const diffCounts = { easy: 0, medium: 0, hard: 0 };

  // 2. Process each entry
  for (let i = 0; i < Math.min(rawEntries.length, MAX_QUESTIONS_PER_RUN * 2); i++) {
    if (finalQuestions.length >= MAX_QUESTIONS_PER_RUN) break;

    console.log(`\n[${i + 1}/${rawEntries.length}] Processing...`);
    
    // Determine target difficulty for this slot
    let targetDifficulty = 'medium';
    if (diffCounts.easy < diffTargets.easy) targetDifficulty = 'easy';
    else if (diffCounts.hard < diffTargets.hard) targetDifficulty = 'hard';
    else if (diffCounts.medium < diffTargets.medium) targetDifficulty = 'medium';

    // Normalization
    const normalized = await normalizeQuestion(rawEntries[i], subject, targetDifficulty);
    if (!normalized) continue;
    if (!isValidTopSyllabusPair(normalized.subject, normalized.chapter)) {
      console.warn(`[SKIP] Non-canonical top-15 syllabus pair: ${normalized.subject}/${normalized.chapter}`);
      continue;
    }

    // A. Chapter Limit Check
    const chapter = normalized.chapter;
    chapterCounts[chapter] = (chapterCounts[chapter] || 0) + 1;
    if (chapterCounts[chapter] > MAX_PER_CHAPTER) {
      console.warn(`[SKIP] Chapter "${chapter}" limit reached.`);
      continue;
    }

    // B. Deduplication (Semantic + Surface)
    const dedupeResult = await isDuplicate(normalized, finalQuestions);
    if (dedupeResult.duplicate) {
      console.warn(`[DEDUP] ${dedupeResult.type} match found (Score: ${dedupeResult.score || '1.0'}).`);
      logRejection(normalized, rawEntries[i], `DUPLICATE_${dedupeResult.type.toUpperCase()}`, 0);
      continue;
    }

    // C. Concept Diversity Check
    if (normalized.concept_pattern && conceptPatterns.has(normalized.concept_pattern)) {
       console.warn(`[SKIP] Concept pattern "${normalized.concept_pattern}" already tested in this run.`);
       continue;
    }

    // D. Quality Scoring & Moderation
    const moderation = await scoreAndModerateQuestion(normalized, subject);
    if (moderation.decision === 'reject' || moderation.score < 7) {
      console.warn(`[REJECT] Score: ${moderation.score}. Issues: ${moderation.issues.join(', ')}`);
      logRejection(normalized, rawEntries[i], moderation.issues.join(' | '), moderation.score);
      continue;
    }

    // Approved!
    console.log(`[OK] Accepted! Score: ${moderation.score} | Chapter: ${normalized.chapter} | Diff: ${normalized.difficulty}`);
    finalQuestions.push(normalized);
    diffCounts[normalized.difficulty]++;
    if (normalized.concept_pattern) conceptPatterns.add(normalized.concept_pattern);
  }

  // 3. Publishing
  if (finalQuestions.length > 0) {
    console.log(`\n📤 Publishing ${finalQuestions.length} production-grade questions...`);
    const results = await publishBatch(finalQuestions, API_SECRET, BATCH_SIZE);
    
    console.log('\n' + '='.repeat(40));
    console.log('✨ PIPELINE RUN SUMMARY');
    console.log('='.repeat(40));
    console.log(`Accepted:   ${results.accepted}`);
    console.log(`Rejected:   ${results.rejected}`);
    console.log(`Total Run:  ${finalQuestions.length}`);
    console.log('\nDifficulty Distribution:');
    console.log(`- Easy:   ${diffCounts.easy} (Target: ${diffTargets.easy})`);
    console.log(`- Medium: ${diffCounts.medium} (Target: ${diffTargets.medium})`);
    console.log(`- Hard:   ${diffCounts.hard} (Target: ${diffTargets.hard})`);
    console.log('='.repeat(40));
  } else {
    console.log('\n❌ No questions met the production quality bar in this run.');
  }
}

/**
 * Logs rejected questions for manual review.
 */
function logRejection(question, originalInput, reason, score) {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const filename = `reject_${timestamp}_${Math.random().toString(36).substring(7)}.json`;
  const filePath = path.join(REJECTED_DATA_DIR, filename);
  
  const logData = {
    timestamp,
    reason,
    score,
    normalized_attempt: question,
    original_input: originalInput
  };
  
  fs.writeFileSync(filePath, JSON.stringify(logData, null, 2));
}

// CLI Support
const subjectId = process.argv[2];
if (subjectId) {
  runPipeline(subjectId);
} else {
  console.log('Usage: node scripts/pipeline/controller.mjs <subject_id>');
}
