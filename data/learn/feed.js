// Learn v2: the Explore feed's own rules (docs/brain/learn-1031/FEED-2.md, sections 4 to 6, with BUILD-1101 1.2, 1.4, R12 and
// R16). PURE: no I/O, no clock. The item order and the feed's card pool are the composer's (compose.js, kind 'feed'); this file
// adds what only the feed has:
//   checkpoints   one interstitial screen after item 8, 16, ... only when 4 or more items follow it (R3.4)
//   the number    on a checkpoint: "5 of 6 right" once a question is answered, else "6 cards seen, 2 kept"
//   covers        the Explore covers row (R12): every playable chapter, For you first with its reason, then book order from
//                 the chapter after it, wrapping
//   cover line    "10 minutes, 16 Key cards and 5 questions"
//   end lines     the feed end's rows: questions right, fixed old mistakes, or "Old mistakes: 1 still open" (R16)
//   order check   the shape the feed promises: a card first, about two cards per question, no two questions back to back
// Free's one Learn session a day is data/learn/allowance.js (LK15).
import { FREE_SESSION_DONE } from './allowance.js';

export const FEED_RULES = Object.freeze({
  checkpointEvery: 8,
  checkpointMinAfter: 4, // a checkpoint needs 4 or more items after it
  restDays: 3,
  cardShare: 0.35,
  lengths: Object.freeze([5, 10, 20]),
  maxCovers: null, // R12: no cap, every playable chapter has a cover
  freeFeedsPerDay: 1, // kept for older importers: LK15 is one Learn session a day (allowance.js)
});

/** The line under a feed when Free's day is used. Kept under its old name for older importers (LK15, allowance.js). */
export const FREE_FEED_DONE = FREE_SESSION_DONE;
export const CHECKPOINT_LINE = 'Keep going, or stop here. What you kept is already in Revise.';

const plural = (n, one, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

/**
 * The screens of a feed in order: every item, with a checkpoint after each `every` items when at least
 * FEED_RULES.checkpointMinAfter items follow it. A checkpoint never closes the feed (the end screen does that).
 * Returns [{ type: 'item', item, n } | { type: 'checkpoint', id, after }] where `n` is the item's 1-based place.
 */
export function feedSlots(items = [], every = FEED_RULES.checkpointEvery) {
  const out = [];
  const list = items || [];
  list.forEach((item, i) => {
    out.push({ type: 'item', item, n: i + 1 });
    const n = i + 1;
    if (every > 0 && n % every === 0 && list.length - n >= FEED_RULES.checkpointMinAfter) out.push({ type: 'checkpoint', id: `cp-${n}`, after: n });
  });
  return out;
}

/**
 * A checkpoint's large number, from what the student did up to it.
 *   answered, right   questions answered so far and how many were right
 *   seen, kept        cards that went by and cards kept
 */
export function checkpointNumber({ answered = 0, right = 0, seen = 0, kept = 0 } = {}) {
  if (answered > 0) return `${right} of ${answered} right`;
  return `${plural(seen, 'card')} seen, ${kept} kept`;
}

/** Feeds a student started on one India day, from their start times (ms) and the day of `now`. */
export function feedsOnDay(starts = [], now, istDay) {
  const day = istDay(now);
  return (starts || []).filter((t) => istDay(t) === day).length;
}

/**
 * Free's daily feed, kept for older importers (the server rule is allowance.js freeSession). `startedToday` counts feeds
 * already started today.
 */
export function freeFeed({ isPro = false, startedToday = 0, perDay = FEED_RULES.freeFeedsPerDay } = {}) {
  if (isPro) return { canStart: true, endLine: null, left: null };
  const left = Math.max(0, perDay - startedToday);
  return { canStart: left > 0, endLine: left > 0 ? null : FREE_FEED_DONE, left };
}

/**
 * The covers row's order (R12). chapters, in book order: [{ key, title, order, chapterNo, cards, questions, mistakes,
 * lastActivityAt, hasNew, openFeed }] where `cards` are the cards the student may open, `mistakes` the eligible old mistakes
 * (R10.1), `hasNew` the chapter has open cards the student does not hold, `openFeed` today's unfinished feed is here.
 * A chapter with nothing to play (no cards and no questions) is left out. For you, the first that applies:
 *   1. today's unfinished feed                                 "Pick up where you stopped"
 *   2. the most eligible old mistakes                           "2 old mistakes to fix"
 *   3. the chapter after the latest Learn activity, with new    "Next after Goodwill"
 *   4. the first chapter with cards                             "Chapter 1 of your book" (null when it has no number)
 * Then book order from the chapter after it, wrapping. Returns the chapters with { forYou, reason } added.
 */
export function coverOrder(chapters = [], max = FEED_RULES.maxCovers) {
  const list = (chapters || []).filter((c) => (c.cards || 0) + (c.questions || 0) > 0).sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
  if (!list.length) return [];
  let pick = null;
  let reason = null;
  const open = list.find((c) => c.openFeed);
  if (open) { pick = open; reason = 'Pick up where you stopped'; }
  if (!pick) {
    const most = list.reduce((best, c) => ((c.mistakes || 0) > (best?.mistakes || 0) ? c : best), null);
    if (most) { pick = most; reason = `${plural(most.mistakes, 'old mistake')} to fix`; }
  }
  if (!pick) {
    const latest = list.filter((c) => Number.isFinite(c.lastActivityAt)).sort((a, b) => b.lastActivityAt - a.lastActivityAt)[0];
    if (latest) {
      const at = list.indexOf(latest);
      const after = [...list.slice(at + 1), ...list.slice(0, at)].find((c) => c.hasNew);
      if (after) { pick = after; reason = `Next after ${latest.title}`; }
    }
  }
  if (!pick) {
    pick = list.find((c) => (c.cards || 0) > 0) || list[0];
    reason = pick.chapterNo ? `Chapter ${pick.chapterNo} of your book` : null;
  }
  const at = list.indexOf(pick);
  const ordered = [pick, ...list.slice(at + 1), ...list.slice(0, at)].map((c) => ({ ...c, forYou: c === pick, reason: c === pick ? reason : null }));
  return Number.isFinite(max) && max > 0 ? ordered.slice(0, max) : ordered;
}

/** "10 minutes, 16 Key cards and 5 questions" (either part left out at 0). */
export function coverLine(minutes, { cards = 0, questions = 0 } = {}) {
  const parts = [cards ? `${cards} Key ${cards === 1 ? 'card' : 'cards'}` : null, questions ? plural(questions, 'question') : null].filter(Boolean);
  return `${minutes} ${minutes === 1 ? 'minute' : 'minutes'}${parts.length ? `, ${parts.join(' and ')}` : ''}`;
}

/**
 * The feed end's rows (FEED-2 section 5, R16): "Questions: 4 of 6 right"; old mistakes either "Fixed: 2 old mistakes" (all),
 * "Fixed: 1 of 2 old mistakes", or, when none was fixed, "Old mistakes: 1 still open" (never "Fixed: 0 of 1").
 */
export function feedEndLines({ answered = 0, right = 0, fixed = 0, mistakes = 0 } = {}) {
  const lines = [];
  if (answered) lines.push({ label: 'Questions', text: `${right} of ${answered} right` });
  if (mistakes) {
    if (!fixed) lines.push({ label: 'Old mistakes', text: `${mistakes} still open` });
    else if (fixed === mistakes) lines.push({ label: 'Fixed', text: plural(fixed, 'old mistake') });
    else lines.push({ label: 'Fixed', text: `${fixed} of ${plural(mistakes, 'old mistake')}` });
  }
  return lines;
}

/** The kept line of a feed end: "6 kept. They are first in Revise." (no return day: none is scheduled yet), null at 0. */
export const keptLine = (count) => (count > 0 ? `${count} kept. They are first in Revise.` : null);

/**
 * Problems with a feed's order, [] when it keeps the feed's shape. Items: { type: 'card' } | { type: 'question' }.
 *   first      the first item is a card
 *   adjacent   two questions back to back while cards were left to put between them
 *   ratio      more than 3.5 or fewer than 1 card per question, when the feed has both
 */
export function feedOrderProblems(items = []) {
  const list = items || [];
  const problems = [];
  if (list.length && list[0].type !== 'card' && list.some((x) => x.type === 'card')) problems.push({ rule: 'first', at: 0 });
  list.forEach((x, i) => {
    if (i === 0 || x.type !== 'question' || list[i - 1].type !== 'question') return;
    if (list.slice(i + 1).some((y) => y.type === 'card')) problems.push({ rule: 'adjacent', at: i });
  });
  const cards = list.filter((x) => x.type === 'card').length;
  const questions = list.filter((x) => x.type === 'question').length;
  if (cards && questions) {
    const r = cards / questions;
    if (r > 3.5 || r < 1) problems.push({ rule: 'ratio', ratio: Math.round(r * 100) / 100 });
  }
  return problems;
}
