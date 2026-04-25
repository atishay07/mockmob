import crypto from 'crypto';

const STOP_WORDS = new Set([
  'a', 'an', 'the', 'is', 'are', 'was', 'were', 'be', 'been', 'being',
  'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'could',
  'should', 'may', 'might', 'shall', 'can', 'to', 'of', 'in', 'for',
  'on', 'with', 'at', 'by', 'from', 'as', 'into', 'through', 'during',
  'before', 'after', 'above', 'below', 'between', 'each', 'other',
  'some', 'such', 'than', 'that', 'this', 'these', 'those', 'its',
  'it', 'if', 'or', 'and', 'but', 'not', 'no', 'so', 'up', 'out',
  'about', 'who', 'which', 'what', 'when', 'where', 'how', 'all',
  'both', 'more', 'most', 'also', 'just', 'then', 'than',
]);

/**
 * Lowercase, strip punctuation, remove stopwords, collapse whitespace.
 * Used for all similarity comparisons so normalization is consistent.
 */
function normalizeForDedup(text) {
  return String(text || '')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter((token) => token.length > 0 && !STOP_WORDS.has(token))
    .join(' ')
    .trim();
}

/**
 * Hash based on normalized body + answer.
 * Catches exact or near-exact wording duplicates regardless of punctuation.
 */
export function computeHash(body, correctAnswer) {
  const normalized = normalizeForDedup(body) + '|' + String(correctAnswer || '').trim().toUpperCase();
  return crypto.createHash('sha256').update(normalized).digest('hex');
}

/**
 * Jaccard similarity on normalized token sets.
 */
export function getSimilarity(str1, str2) {
  const t1 = normalizeForDedup(str1).split(/\s+/).filter(Boolean);
  const t2 = normalizeForDedup(str2).split(/\s+/).filter(Boolean);
  if (t1.length === 0 && t2.length === 0) return 1;
  const s1 = new Set(t1);
  const s2 = new Set(t2);
  const intersection = new Set([...s1].filter((x) => s2.has(x)));
  const union = new Set([...s1, ...s2]);
  if (union.size === 0) return 0;
  return intersection.size / union.size;
}

/**
 * Sorted-token similarity: re-orders tokens before comparing.
 * Catches paraphrased duplicates where word order differs but vocabulary is the same.
 */
function getSortedTokenSimilarity(str1, str2) {
  const sorted1 = normalizeForDedup(str1).split(/\s+/).filter(Boolean).sort().join(' ');
  const sorted2 = normalizeForDedup(str2).split(/\s+/).filter(Boolean).sort().join(' ');
  return getSimilarity(sorted1, sorted2);
}

/**
 * Deterministic duplicate check — hash + Jaccard + sorted-token. No LLM.
 * Synchronous; safe to call in a tight loop.
 */
export function isDuplicate(
  newQuestion,
  existingQuestions,
  options = { jaccardThreshold: 0.82, sortedTokenThreshold: 0.88 },
) {
  const newHash = computeHash(newQuestion.body, newQuestion.correct_answer);

  for (const existing of existingQuestions) {
    const existingHash = computeHash(existing.body, existing.correct_answer);
    if (newHash === existingHash) return { duplicate: true, type: 'hash' };

    const jaccard = getSimilarity(newQuestion.body, existing.body);
    if (jaccard >= options.jaccardThreshold) return { duplicate: true, type: 'jaccard', score: jaccard };

    const sortedSim = getSortedTokenSimilarity(newQuestion.body, existing.body);
    if (sortedSim >= options.sortedTokenThreshold) {
      return { duplicate: true, type: 'sorted_tokens', score: sortedSim };
    }
  }

  return { duplicate: false };
}

/**
 * Deduplicates an entire batch before validation.
 * Returns { unique: Question[], removed: number }.
 * Zero API calls — runs entirely in process.
 */
export function deduplicateBatch(
  questions,
  options = { jaccardThreshold: 0.82, sortedTokenThreshold: 0.88 },
) {
  const unique = [];
  let removed = 0;

  for (const question of questions) {
    const result = isDuplicate(question, unique, options);
    if (result.duplicate) {
      removed += 1;
    } else {
      unique.push(question);
    }
  }

  return { unique, removed };
}
