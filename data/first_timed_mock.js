// The first timed mock: when to say it, and the words (16 Oct 2026).
// PURE, free, no model, no I/O, no React. The Mistake Lab's time lines (how long each question took, the slow
// finding, answer changes and when they were made, the cohort's times) all need a paper whose clock the device
// recorded. Only a timed mock (Full mock or NTA mode) gives the Lab that, so a student with none is shown one honest
// line and one key, in three places: Today, the end of a practice result, and the Lab's own empty block on Radar.
//
// "Has a timed paper" means exactly what Across your mocks counts (data/across_mocks.js): a Full or NTA paper scored
// on the server whose device record could be read (paperTrace state 'ready'). The server counts them
// (src/lib/server/timedMock.js) and sends the facts; this file decides from the facts.
//
// Rules:
//   * Unknown is never zero. Facts that did not load (or are not whole numbers) show nothing.
//   * Gone as soon as the student has one timed paper (timedMocks >= 1). No count of anything else changes that.
//   * Never on a timed mock's own result: that page already says what its own clock could not show.
//   * Today waits for a first saved session: a student with none starts with practice, not with a 60-minute paper.
//   * No streak, no deadline, no price pressure. The key opens the practice setup with the mock chosen; that page
//     states its price before anything starts.
//   * The paper's minutes and question count are the shortest timed paper's own, read from data/test_modes.js.
import { TEST_MODES } from './test_modes.js';

/** The modes that are timed mocks: fixed length and question count (Full mock, NTA mode). */
export const TIMED_MOCK_MODES = Object.freeze(
  Object.values(TEST_MODES).filter((m) => m.fixedDurationSec > 0 && m.fixedCount > 0).map((m) => m.id),
);

/** Where the line can appear. */
export const FIRST_TIMED_SURFACES = Object.freeze(['today', 'result', 'radar']);

/**
 * The shortest timed paper: { mode, minutes, questions }, or null when no mode has a fixed length. On a tie the
 * earlier mode wins (Full mock, which a free account can start; NTA mode needs Pro).
 */
export function shortestTimedPaper(modes = TEST_MODES) {
  const timed = Object.values(modes || {}).filter((m) => m && m.fixedDurationSec > 0 && m.fixedCount > 0);
  if (!timed.length) return null;
  const best = timed.reduce((a, b) => (b.fixedDurationSec < a.fixedDurationSec || (b.fixedDurationSec === a.fixedDurationSec && b.fixedCount < a.fixedCount) ? b : a));
  return { mode: best.id, minutes: Math.round(best.fixedDurationSec / 60), questions: best.fixedCount };
}

const whole = (n) => Number.isInteger(n) && n >= 0;
const plural = (n, one, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

export const FIRST_TIMED_COPY = Object.freeze({
  unlocks: 'unlocks how long you spend on each question and where changed answers cost marks.',
  first: (unlocks) => `Your first timed mock ${unlocks}`,
  again: (unlocks) => `Your earlier mock was saved without a clock record. Your next timed mock ${unlocks}`,
  paper: (paper) => `A full mock is ${plural(paper.questions, 'question')} in ${plural(paper.minutes, 'minute')}.`,
  key: 'Set up a full mock',
});

/** The practice setup with the mock chosen (and the subject, when the student's record names one). */
export function firstTimedMockHref(subject = null, paper = shortestTimedPaper()) {
  const mode = paper?.mode || 'full';
  const s = typeof subject === 'string' && /^[a-z0-9_]{1,40}$/.test(subject) ? subject : null;
  return `/dashboard?${s ? `subject=${encodeURIComponent(s)}&` : ''}mode=${mode}`;
}

/**
 * The prompt for one surface, or null.
 *   facts   { sessions, mocks, timedMocks, subject } from GET /api/me/timed-mock: saved sessions, saved Full or NTA
 *           mocks, those with a readable clock record, and the subject of the newest session
 *   surface 'today' | 'result' | 'radar'
 *   resultMode  on 'result', the mode of the paper on screen
 * Returns { surface, variant: 'first' | 'again', paper, line, key: { label, href } }.
 */
export function firstTimedMockPrompt(facts, { surface, resultMode = null, modes = TEST_MODES } = {}) {
  if (!FIRST_TIMED_SURFACES.includes(surface)) return null;
  if (!facts || typeof facts !== 'object') return null;
  const { sessions, mocks, timedMocks } = facts;
  if (!whole(sessions) || !whole(mocks) || !whole(timedMocks)) return null;
  if (timedMocks > 0) return null;
  if (surface === 'today' && sessions === 0) return null;
  if (surface === 'result' && TIMED_MOCK_MODES.includes(resultMode)) return null;
  const paper = shortestTimedPaper(modes);
  if (!paper) return null;
  const variant = mocks > 0 ? 'again' : 'first';
  const C = FIRST_TIMED_COPY;
  const line = `${(variant === 'again' ? C.again : C.first)(C.unlocks)} ${C.paper(paper)}`;
  return { surface, variant, paper, line, key: { label: C.key, href: firstTimedMockHref(facts.subject, paper) } };
}
