// The dashboard end of a "Do these next" row (specs D.5-4, D.5-5). The row's link says which chapters the set takes
// (?chapter=A for one, ?chapters=A,B,C for several), how many questions, and which plan row it came from
// (?planAttemptId=..&planItemId=p1). The dashboard shows the chapters selected, the student may still change
// them, and the row's id is only carried to the session while the set is still what the row asked for.
import { parseChapterList } from './chapter_list.js';
import { PLAN_ITEM_PARAMS, readPlanItemRef } from './plan_item.js';

/** The chapters a link asks for, kept to names that exist for the subject (`names`). */
export function linkedChapters(params, names) {
  const valid = new Set(names || []);
  const many = params.get('chapters');
  const one = params.get('chapter');
  const list = many ? parseChapterList(many, (name) => valid.has(name)) : one ? [one] : [];
  return list.filter((name) => valid.has(name));
}

/** The plan row ids a link carries, or null. */
export function linkedPlanItem(params) {
  return readPlanItemRef({ [PLAN_ITEM_PARAMS.attemptId]: params.get(PLAN_ITEM_PARAMS.attemptId), [PLAN_ITEM_PARAMS.itemId]: params.get(PLAN_ITEM_PARAMS.itemId) });
}

const sameSet = (a, b) => a.length === b.length && a.every((x) => b.includes(x));

/**
 * The plan row ids to hand to the session now, or null. They go only while the set is what the row asked for: the same
 * subject, a quick set, the same size and the same chapters. A student who changes any of them has started a different
 * set, and the plan does not claim it.
 */
export function planItemToForward({ params, subject, chapterNames, selectedChapters, count, modeId }) {
  const ref = linkedPlanItem(params);
  if (!ref || modeId !== 'quick' || params.get('subject') !== subject) return null;
  if (Number(params.get('count')) !== Number(count)) return null;
  return sameSet(linkedChapters(params, chapterNames), selectedChapters || []) ? ref : null;
}
