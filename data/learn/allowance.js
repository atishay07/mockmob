// Learn v2: LK15, Free's one Learn session a day (BUILD-1101 1.6, A5 R5, A6 D1 and D2). PURE: the server decides
// `claimedByOther` from the day's learning_allowances row (kind 'learn_session', period '<IST day>:1', reference = run id);
// this file holds the rule and its three lines, so the service, the preview and the tests say the same words.
//
//   counted       'mix' (a chapter run) and 'feed'. Not counted: 'cards' (Revise these, Study these), 'recap', 'level'.
//   length        Free sessions are composed at 10 minutes at most; the 5 | 10 | 20 control stays visible, and the capped
//                 line shows only when the student picked more than 10 (the line is the real limit).
//   the claim     at the first answered question (not at the start), in learn_record_event; Pro has no row and no cap.
//   after it      a new mix is Key cards only (with its line); a new feed is refused with the session line.

export const LEARN_FREE = Object.freeze({ sessionsPerDay: 1, maxMinutes: 10, counted: Object.freeze(['mix', 'feed']) });

// R3-SPEC ruling F: Free after the day's session says one thing everywhere (Learn home, the feed refusal, the ends). True to
// freeSession below: a new feed is refused and a new chapter run is Key cards only; Revise, recap, the level check and
// picking up today's own run stay open; Explore's single questions stay free.
export const FREE_DONE_HEADLINE = "That was today's free session.";
export const FREE_DONE_LINE = 'Questions come back tomorrow. Your Key cards stay open.';
export const FREE_SESSION_DONE = 'Your free Learn session for today is done. Explore questions stay free. Pro has as many as you like.';
export const FREE_CAPPED = 'Free sessions are up to 10 minutes. Pro has any length.';
export const FREE_CARDS_ONLY = 'Your free Learn session today is used, so this one is Key cards only. Questions come back tomorrow.';

/** True for the kinds that count as Free's one session ('mix' and 'feed'). */
export const isCounted = (kind) => LEARN_FREE.counted.includes(kind);

/**
 * The Free rule for one start or dry run.
 *   isPro            Pro: nothing applies
 *   claimedByOther   today's session row exists and references another run
 *   kind             the run kind asked for
 *   minutes          the length asked for
 * Returns { minutes, capped, cardsOnly, refuse, line }:
 *   minutes     the length to compose (Free and counted: at most 10)
 *   capped      null | { asked, text: FREE_CAPPED } (only when more than 10 was asked)
 *   cardsOnly   a mix after the claim: compose Key cards only (questions and mistakes left out)
 *   refuse      a feed after the claim: answer 402 FREE_SESSION_USED
 *   line        the line to show with it (FREE_CARDS_ONLY, FREE_SESSION_DONE) or null
 */
export function freeSession({ isPro = false, claimedByOther = false, kind = 'mix', minutes = 10 } = {}) {
  const m = Number(minutes) || 0;
  if (isPro || !isCounted(kind)) return { minutes: m, capped: null, cardsOnly: false, refuse: false, line: null };
  const capped = m > LEARN_FREE.maxMinutes ? { asked: m, text: FREE_CAPPED } : null;
  const out = { minutes: Math.min(m, LEARN_FREE.maxMinutes), capped, cardsOnly: false, refuse: false, line: null };
  if (claimedByOther) {
    if (kind === 'feed') return { ...out, refuse: true, line: FREE_SESSION_DONE };
    return { ...out, cardsOnly: true, line: FREE_CARDS_ONLY };
  }
  return out;
}
