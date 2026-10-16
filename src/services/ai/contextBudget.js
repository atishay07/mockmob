// A size cap for the context the server builds for Ask Mobi (the STUDENT_CONTEXT_JSON block in the prompt).
//
// No 'server-only' and no alias imports on purpose: the mentor chat route calls it, data/tests/ai_context_budget.test.mjs tests it.
//
// Why: the model is billed for every input byte of every call, and the guard's reservation assumes one token per byte.
// Before this cap the built context could reach about 30 KB for a student with a long record (AI-COST-PER-USER-2026-10-17).
// The cap is about 12 KB of JSON. The parts that answer the question are never touched: recordInsights, questionContext,
// studyLesson, the plan's primary step and the plan type. Everything else is dropped, least relevant first, one step at a
// time, and only until the context fits.
export const MAX_CONTEXT_BYTES = 12 * 1024;

const bytesOf = (value) => Buffer.byteLength(JSON.stringify(value), 'utf8');

// Least relevant first. Each step removes one thing. Entries with a dot trim inside sharedPlan.
export const CONTEXT_DROP_ORDER = Object.freeze([
  '_raw', 'generatedAt', 'targetCourses', 'targetColleges', 'admissionCompassSummary', 'aiConfidence', 'limits', 'dailyUsage',
  'normalCreditBalance', 'recommendedDeterministicActions', 'revisionPriority', 'savedQuestionSummary', 'skippedQuestionSummary',
  'timeBehavior', 'sharedPlan.study', 'sharedPlan.sequence', 'sharedPlan.alternatives', 'lastMockSummary', 'recentMockSummary',
  'mistakeDNA', 'weaknessSummary', 'selectedSubjects', 'aiCredits',
]);

/**
 * @returns {{ context: object, bytes: number, originalBytes: number, dropped: string[], fits: boolean }}
 * `fits` is false only when the protected parts alone are over the cap (they are still sent whole).
 */
export function capContextBytes(context, maxBytes = MAX_CONTEXT_BYTES) {
  const originalBytes = bytesOf(context ?? {});
  if (!context || typeof context !== 'object' || originalBytes <= maxBytes) return { context, bytes: originalBytes, originalBytes, dropped: [], fits: true };
  const next = { ...context };
  if (next.sharedPlan && typeof next.sharedPlan === 'object') next.sharedPlan = { ...next.sharedPlan };
  const dropped = [];
  let bytes = originalBytes;
  for (const path of CONTEXT_DROP_ORDER) {
    if (bytes <= maxBytes) break;
    const [head, tail] = path.split('.');
    if (tail) { if (next[head] && typeof next[head] === 'object' && tail in next[head]) { delete next[head][tail]; dropped.push(path); } }
    else if (head in next) { delete next[head]; dropped.push(path); }
    else continue;
    bytes = bytesOf(next);
  }
  return { context: next, bytes, originalBytes, dropped, fits: bytes <= maxBytes };
}
