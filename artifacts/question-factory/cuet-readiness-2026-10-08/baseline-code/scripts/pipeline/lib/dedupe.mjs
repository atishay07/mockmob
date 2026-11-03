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
 * Bigram (adjacent token-pair) Jaccard similarity.
 * Catches structural duplicates that survive unigram comparison — e.g. questions
 * that rearrange clause order but keep the same pairings of key terms.
 * Returns 0 when either string has fewer than 2 tokens (no bigrams to compare).
 */
function getBigramSimilarity(str1, str2) {
  const t1 = normalizeForDedup(str1).split(/\s+/).filter(Boolean);
  const t2 = normalizeForDedup(str2).split(/\s+/).filter(Boolean);
  if (t1.length < 2 || t2.length < 2) return 0;

  const bigrams = (tokens) => {
    const bg = new Set();
    for (let i = 0; i < tokens.length - 1; i += 1) bg.add(`${tokens[i]}|${tokens[i + 1]}`);
    return bg;
  };

  const bg1 = bigrams(t1);
  const bg2 = bigrams(t2);
  const intersection = new Set([...bg1].filter((x) => bg2.has(x)));
  const union = new Set([...bg1, ...bg2]);
  return union.size === 0 ? 0 : intersection.size / union.size;
}

/**
 * Deterministic duplicate check — hash + Jaccard + sorted-token + bigram. No LLM.
 * Synchronous; safe to call in a tight loop.
 *
 * Thresholds (all tunable via options):
 *   hash          — exact match after normalization
 *   jaccard       0.92 — unigram set overlap (raised from 0.80 to cut false positives)
 *   sortedToken   0.93 — order-invariant unigram overlap
 *   bigram        0.85 — adjacent-pair overlap
 *
 * Compound condition for similarity checks:
 *   Two questions are only flagged as duplicates when:
 *     (a) their CORRECT ANSWERS match  — different answers → different facts → not a duplicate
 *     (b) their CONCEPTS match (when both expose concept_pattern)
 *     (c) similarity exceeds the threshold
 *   This prevents rejecting questions that share a topic but test different sub-facts.
 */
export function isDuplicate(
  newQuestion,
  existingQuestions,
  options = { jaccardThreshold: 0.80, sortedTokenThreshold: 0.90, bigramThreshold: 0.70 },
) {
  const newHash = computeHash(newQuestion.body, newQuestion.correct_answer);
  const newAnswer  = String(newQuestion.correct_answer  || '').trim().toUpperCase();
  const newConcept = String(newQuestion.concept_pattern || '').trim().toLowerCase();

  for (const existing of existingQuestions) {
    // 1. Hash: exact normalized body+answer — always a duplicate
    const existingHash = computeHash(existing.body, existing.correct_answer);
    if (newHash === existingHash) return { duplicate: true, type: 'hash' };

    // 2–4. Similarity gates require a shared ANSWER anchor.
    //   A question whose correct answer differs tests a different fact and
    //   CANNOT be a duplicate, even when phrasing is superficially similar.
    const existingAnswer = String(existing.correct_answer || '').trim().toUpperCase();
    if (!newAnswer || !existingAnswer || newAnswer !== existingAnswer) continue;

    // Concept gate: when both questions expose their concept tag, skip the
    // similarity check if the concepts differ — same topic, different sub-concept
    // is intentionally diverse generation, not duplication.
    const existingConcept = String(existing.concept_pattern || '').trim().toLowerCase();
    if (newConcept && existingConcept && newConcept !== existingConcept) continue;

    const jaccard = getSimilarity(newQuestion.body, existing.body);
    if (jaccard >= options.jaccardThreshold) return { duplicate: true, type: 'jaccard', score: jaccard };

    const sortedSim = getSortedTokenSimilarity(newQuestion.body, existing.body);
    if (sortedSim >= options.sortedTokenThreshold) {
      return { duplicate: true, type: 'sorted_tokens', score: sortedSim };
    }

    const bigramSim = getBigramSimilarity(newQuestion.body, existing.body);
    if (bigramSim >= options.bigramThreshold) {
      return { duplicate: true, type: 'bigram', score: bigramSim };
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
  options = { jaccardThreshold: 0.80, sortedTokenThreshold: 0.90, bigramThreshold: 0.70 },
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

/**
 * Deduplicates newQuestions against a pre-existing pool (e.g. questions already
 * in the DB for this subject+chapter) AND against each other in one pass.
 * Returns { unique: Question[], removed: number }.
 * Zero API calls — runs entirely in process.
 */
export function deduplicateAgainst(
  newQuestions,
  existingQuestions,
  options = { jaccardThreshold: 0.80, sortedTokenThreshold: 0.90, bigramThreshold: 0.70 },
) {
  // Seed the seen-set with existing questions so new ones are compared against them
  const seen = [...existingQuestions];
  const unique = [];
  let removed = 0;

  for (const question of newQuestions) {
    const result = isDuplicate(question, seen, options);
    if (result.duplicate) {
      removed += 1;
    } else {
      unique.push(question);
      seen.push(question); // also dedup within the new batch itself
    }
  }

  return { unique, removed };
}
