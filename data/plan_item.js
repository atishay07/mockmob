// The plan item a practice set was started from (spec D.5-4). The result page's "Do these next" rows carry an id
// (p1, p2, p3) that is only meaningful with the paper they were built for, so a set started from a row records the
// pair: selection_meta.planItem = { attemptId, itemId, chapters }. "A set on this chapter on 16 Oct: 7 right of 10"
// can then name the very set that followed that row, not just any set that happened to land on the chapter.
// The values come from the client, so the shape is checked here and nothing else is stored: a pair that fails the
// check is left out and the set starts as an ordinary one. It is the student's own record, read back only by the
// student's own result page, so it needs no ownership read at the start.
export const PLAN_ITEM_PARAMS = Object.freeze({ attemptId: 'planAttemptId', itemId: 'planItemId' });

const ATTEMPT_ID = /^[A-Za-z0-9][A-Za-z0-9_-]{5,119}$/;
const ITEM_ID = /^p[1-9]$/; // data/mock_swot.js numbers its rows p1, p2, p3 (SWOT_RULES.plan.max)

/** The two ids if both are well formed, else null. */
export function readPlanItemRef(input) {
  const attemptId = input?.[PLAN_ITEM_PARAMS.attemptId];
  const itemId = input?.[PLAN_ITEM_PARAMS.itemId];
  if (typeof attemptId !== 'string' || typeof itemId !== 'string') return null;
  return ATTEMPT_ID.test(attemptId) && ITEM_ID.test(itemId) ? { attemptId, itemId } : null;
}

/**
 * The selection_meta part for a session about to start: { planItem } or {}. Only an ordinary quick set records it
 * (the plan rows are quick sets), with the chapters the server validated and kept for the session.
 */
export function planItemMetadata(input, { mode, chapters = [] } = {}) {
  if (mode !== 'quick') return {};
  const ref = readPlanItemRef(input);
  return ref ? { planItem: { ...ref, chapters: [...chapters] } } : {};
}
