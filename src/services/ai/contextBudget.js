// A size cap for the context the server builds for Ask Mobi (the STUDENT_CONTEXT_JSON block in the prompt).
//
// No 'server-only' and no alias imports on purpose: the mentor chat route calls it, data/tests/ai_context_budget.test.mjs tests it.
//
// Why: the model is billed for every input byte of every call, and the guard's reservation assumes one token per byte.
// Before this cap the built context could reach about 30 KB for a student with a long record (AI-COST-PER-USER-2026-10-17).
// The cap is about 12 KB of JSON. The parts that answer the question are never touched: recordInsights, questionContext,
// studyLesson, the plan's primary step and the plan type. Everything else is dropped, least relevant first, one step at a
// time, and only until the context fits. A dotted entry trims inside one part (sharedPlan, collegeStanding).
export const MAX_CONTEXT_BYTES = 12 * 1024;

const bytesOf = (value) => Buffer.byteLength(JSON.stringify(value), 'utf8');

// Removes one nested path, copying each object on the way so the caller's context is never changed. True when removed.
function removePath(root, parts) {
  let at = root;
  for (let i = 0; i < parts.length - 1; i += 1) {
    const child = at[parts[i]];
    if (!child || typeof child !== 'object' || Array.isArray(child)) return false;
    at[parts[i]] = { ...child };
    at = at[parts[i]];
  }
  const last = parts[parts.length - 1];
  if (!(last in at)) return false;
  delete at[last];
  return true;
}

// Least relevant first. Each step removes one thing. Entries with a dot trim inside one part (sharedPlan, collegeStanding).
export const CONTEXT_DROP_ORDER = Object.freeze([
  '_raw', 'generatedAt', 'targetCourses', 'admissionCompassSummary', 'aiConfidence', 'limits', 'dailyUsage',
  'normalCreditBalance', 'recommendedDeterministicActions', 'revisionPriority', 'savedQuestionSummary', 'skippedQuestionSummary',
  'timeBehavior', 'sharedPlan.study', 'sharedPlan.sequence', 'sharedPlan.alternatives',
  // The student's colleges and where their practice stands against them (C-dec 3, 20 Oct 2026) are worth more than the
  // older summaries: only their least useful parts (subjects still thin, per-paper detail) go before those summaries,
  // and the colleges themselves are the last thing dropped.
  'collegeStanding.thin', 'collegeStanding.band.papers', 'lastMockSummary', 'recentMockSummary',
  'mistakeDNA', 'weaknessSummary', 'selectedSubjects', 'aiCredits', 'collegeStanding.closeFastest', 'collegeStanding', 'targetColleges',
]);

/**
 * @returns {{ context: object, bytes: number, originalBytes: number, dropped: string[], fits: boolean }}
 * `fits` is false only when the protected parts alone are over the cap (they are still sent whole).
 */
export function capContextBytes(context, maxBytes = MAX_CONTEXT_BYTES) {
  const originalBytes = bytesOf(context ?? {});
  if (!context || typeof context !== 'object' || originalBytes <= maxBytes) return { context, bytes: originalBytes, originalBytes, dropped: [], fits: true };
  const next = { ...context };
  const dropped = [];
  let bytes = originalBytes;
  for (const path of CONTEXT_DROP_ORDER) {
    if (bytes <= maxBytes) break;
    if (!removePath(next, path.split('.'))) continue;
    dropped.push(path);
    bytes = bytesOf(next);
  }
  return { context: next, bytes, originalBytes, dropped, fits: bytes <= maxBytes };
}
