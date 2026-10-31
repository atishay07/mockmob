// Learn v2: the Explore feed's own rules (docs/brain/learn-1031/FEED-2.md, sections 4 to 6). PURE: no I/O, no clock.
// The item order itself is the composer's (compose.js, kind 'feed', A3); this file adds what only the feed has:
//   checkpoints   one interstitial screen after every 8 items (never after the last one, never two in a row)
//   the number    on a checkpoint: "5 of 6 right" once a question is answered, else "6 cards seen, 2 kept"
//   Free          one feed a day; the end of the day's feed says so in place of "Another 10 minutes" (no modal, LK15),
//                 and a second feed asked for that day does not start
//   covers        the Explore covers row: the suggested chapter first (due cards or open mistakes), then book order
//   cover line    "10 minutes, 16 Key cards and 5 questions"
//   order check   the shape the feed promises: a card first, about two cards per question, no two questions back to back

export const FEED_RULES = Object.freeze({
  checkpointEvery: 8,
  freeFeedsPerDay: 1,
  lengths: Object.freeze([5, 10, 20]),
  maxCovers: 8,
});

export const FREE_FEED_DONE = 'Your free feed for today is done. Pro has as many as you like.';
export const CHECKPOINT_LINE = 'Keep going, or stop here and save what you kept.';

const plural = (n, one, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

/**
 * The screens of a feed in order: every item, with a checkpoint after each `every` items. A checkpoint never closes the
 * feed (the end screen does that), so none follows the last item.
 * Returns [{ type: 'item', item, n } | { type: 'checkpoint', id, after }] where `n` is the item's 1-based place.
 */
export function feedSlots(items = [], every = FEED_RULES.checkpointEvery) {
  const out = [];
  const list = items || [];
  list.forEach((item, i) => {
    out.push({ type: 'item', item, n: i + 1 });
    const n = i + 1;
    if (every > 0 && n % every === 0 && n < list.length) out.push({ type: 'checkpoint', id: `cp-${n}`, after: n });
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
 * Free's daily feed. `startedToday` counts feeds already started today (before the one asked for, or including the one that
 * is ending, at the end screen).
 *   canStart   a new feed may start now
 *   endLine    at the end of a feed: the line that replaces "Another 10 minutes" (null on Pro or with feeds left)
 */
export function freeFeed({ isPro = false, startedToday = 0, perDay = FEED_RULES.freeFeedsPerDay } = {}) {
  if (isPro) return { canStart: true, endLine: null, left: null };
  const left = Math.max(0, perDay - startedToday);
  return { canStart: left > 0, endLine: left > 0 ? null : FREE_FEED_DONE, left };
}

/**
 * The covers row's order: the student's suggested chapter first (the most due cards plus open mistakes; ties in book
 * order), marked forYou; the rest in book order. A chapter with nothing to play (no cards and no questions) is left out.
 * chapters: [{ key, title, order, cards, questions, due, mistakes }]
 */
export function coverOrder(chapters = [], max = FEED_RULES.maxCovers) {
  const playable = (chapters || []).filter((c) => (c.cards || 0) + (c.questions || 0) > 0).sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
  if (!playable.length) return [];
  const weight = (c) => (c.due || 0) + (c.mistakes || 0);
  let pick = playable.reduce((best, c) => (weight(c) > weight(best) ? c : best), playable[0]);
  // A new student (nothing due, no mistakes): the first chapter in book order that has Key cards.
  if (!weight(pick)) pick = playable.find((c) => c.cards > 0) || playable[0];
  const rest = playable.filter((c) => c !== pick);
  return [{ ...pick, forYou: true }, ...rest.map((c) => ({ ...c, forYou: false }))].slice(0, Math.max(1, max));
}

/** "10 minutes, 16 Key cards and 5 questions" (either part left out at 0). */
export function coverLine(minutes, { cards = 0, questions = 0 } = {}) {
  const parts = [cards ? `${cards} Key ${cards === 1 ? 'card' : 'cards'}` : null, questions ? plural(questions, 'question') : null].filter(Boolean);
  return `${minutes} ${minutes === 1 ? 'minute' : 'minutes'}${parts.length ? `, ${parts.join(' and ')}` : ''}`;
}

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
