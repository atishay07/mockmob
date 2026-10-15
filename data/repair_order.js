// Repair order by what other students answered (spec tmp/mistake-lab-v4/SPEC.md 4.7, first part). PURE, free, no I/O.
//
// The repair queue puts first the wrong answers on questions most other students got right, then the student's common
// traps, then the rest by question number. "Most got right" is the ledger's own gate (20 or more other students and a
// 95% Wilson low bound above 50% right); a common trap is How others answered's own gate (the student's option has 5
// or more picks, at least half of the wrong picks, and strictly more than any other wrong option). The counts come from
// the Lab's byQuestion reads, so they are the numbers the opened answer shows. Held questions (under re-check or
// corrected) are never ordered by the cohort. Without a read that passes a gate the order is today's: paper order,
// and the hero keeps today's key and line.
import COPY from './mistake_lab.copy.json' with { type: 'json' };
import { wilson } from './prepos_insights.js';
import { LAB_RULES } from './mistake_lab.js';
import { EXCLUDED_REVIEW_STATES } from './attempt_ledger.js';
import { fill } from './across_mocks.js';

export const REPAIR_ORDER_VERSION = 1;
const O = COPY.repairOrder;
const HELD = new Set(EXCLUDED_REVIEW_STATES);
const LETTERS = 'ABCDEFGH';
const letter = (i) => LETTERS[i] || String(i + 1);

/** True when most other students got the question right (20 or more, Wilson low bound above 50%). */
export function mostRight(others) {
  if (!others || !Number.isInteger(others.n) || others.n < LAB_RULES.cohortLabelMin) return false;
  const w = wilson(others.right, others.n);
  return w.low !== null && w.low > LAB_RULES.mostRightLowAbove;
}
/** The common-trap gate of How others answered, for the student's own wrong option. */
export function commonTrap(others, givenIndex) {
  if (!others || !Number.isInteger(givenIndex) || givenIndex === others.keyIndex) return null;
  const counts = Array.isArray(others.counts) ? others.counts.map((c) => Number(c) || 0) : [];
  const c = counts[givenIndex] || 0;
  const w = others.n - others.right;
  const topOther = Math.max(0, ...counts.map((count, i) => ({ i, count })).filter((x) => x.i !== others.keyIndex && x.i !== givenIndex).map((x) => x.count));
  return c >= LAB_RULES.trapMinPicks && c * 2 >= w && c > topOther ? { c, w, L: letter(givenIndex) } : null;
}

/**
 * buildRepairOrder({ lab, attempt, answerReviews }) -> lab.repairOrder (contract_repair_order_v1.json), or null when the
 * paper has no wrong answer. items: every wrong answer that is not held, in repair order, each
 * { qid, number, reason: 'most_right' | 'common_trap' | 'paper', key, line } (key and line only on cohort-led items).
 */
export function buildRepairOrder({ lab, attempt, answerReviews = {} } = {}) {
  const questions = Array.isArray(attempt?.questionsSnapshot) ? attempt.questionsSnapshot : [];
  const details = new Map((attempt?.details || []).map((d) => [d.qid, d]));
  const byQuestion = lab?.byQuestion || {};
  const wrong = questions.map((q, i) => ({ q, number: i + 1, d: details.get(q.id) }))
    .filter((x) => x.d?.isCorrect === false && !HELD.has(answerReviews?.[x.q.id]?.state));
  if (!wrong.length) return null;
  const items = wrong.map(({ q, number, d }) => {
    const others = byQuestion[q.id]?.others || null;
    if (mostRight(others)) return { qid: q.id, number, reason: 'most_right', key: fill(O.key, { n: number }), line: fill(O.mostRight, { r: others.right, n: others.n }), share: others.right / others.n };
    const trap = commonTrap(others, d.givenIndex);
    if (trap) return { qid: q.id, number, reason: 'common_trap', key: fill(O.key, { n: number }), line: fill(O.commonTrap, trap), share: 0 };
    return { qid: q.id, number, reason: 'paper', key: null, line: null, share: 0 };
  });
  const rank = { most_right: 0, common_trap: 1, paper: 2 };
  items.sort((a, b) => rank[a.reason] - rank[b.reason] || b.share - a.share || a.number - b.number);
  const cohortLed = items.some((x) => x.reason !== 'paper');
  return {
    version: REPAIR_ORDER_VERSION,
    state: cohortLed ? 'cohort' : 'paper',
    items: items.map((x) => ({ qid: x.qid, number: x.number, reason: x.reason, key: x.key, line: x.line })),
    qids: items.map((x) => x.qid),
  };
}
