// Learn v2: where the student is in a subject, and the one offer Learn home leads with (R2-SPEC rulings 1 to 3, LK27, LK10, LK24;
// usefulness.md items 1, 2, 4, 5, 7). PURE: no I/O and no clock of its own; the service (src/lib/server/learn.js) hands it the
// chapters it already computed from one snapshot.
//
// The spine:
//   position   the chapter the student is in. A student stays in a chapter until its open cards have been seen once: the chapter
//              of the latest Learn activity (a rated, kept or added card, a card moved past in an Explore feed, an unfinished run)
//              while it still has STAY_UNSEEN or more unseen open cards; then the next chapter in book order that has unseen
//              cards; with no Learn activity, the chapter a level check picked, else the first chapter that has cards.
//   mode       pickup    an unfinished run in this subject (under 24 hours)           "Pick up <chapter>"      "Continue · 6 min"
//              freeDone  Free, today's one session used by a run that is not open     FREE_DONE_HEADLINE + FREE_DONE_LINE  "See Pro"
//                        (R3 ruling F: the same block as the feed's refusal; Or rows: Continue, Revise N due cards, single questions)
//              new       nothing seen and no question tried in this subject           "Start learning <subject>"  "Start chapter 1 · 10 min"
//              today     returning, otherwise                                         "Today's 10 minutes in <subject>"  "Start · 10 min"
//   today      due cards from any chapter of the subject, at most 40 percent of the time (oldest due first), then the position
//              chapter's new cards and questions; the server adds one open mistake. The key's run is a mix on the position chapter
//              whose cardIds are those due cards (src/lib/server/learn.js start()).
//   or rows    at most two quiet rows under the offer, each drawn only when it holds something (R3 ruling R3: Revise N due cards,
//              then the open mistakes, then "Skip what you already know" while the subject has no Learn activity, then the feed).
// R3 ruling C2: a subject's chapter count is its playable chapters, those with cards; a chapter with no cards is not a position and
// not a number in "Chapter 1 of 14".
// Never a zero: a count that is 0 is left out of every line (ruling 1). Never "mastered", never a %, never marks (ruling 12).
import { budgetSeconds, LEARN_RULES } from './compose.js';
import { SECONDS } from './seconds.js';
import { STAY_UNSEEN, fixMinutes, levelMinutes } from './suggest.js';
import { WORDS, fixMistakes, reviseDue as reviseDueLabel, withMinutes, wholeMinutes } from './words.js';
import { FREE_DONE_HEADLINE, FREE_DONE_LINE } from './allowance.js';

export const ROADMAP_MODES = Object.freeze(['pickup', 'freeDone', 'new', 'today']);
export const ROADMAP_RULES = Object.freeze({
  stayUnseen: STAY_UNSEEN, // a chapter with this many unseen open cards or more keeps the student (the end screen's rule too)
  dueShare: 0.4, // due cards take at most this share of today's minutes
  minutes: 10,
  maxOr: 2,
});

const plural = (n, one, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;
const num = (v) => (Number.isFinite(Number(v)) ? Number(v) : 0);
const time = (v) => { if (v === null || v === undefined) return null; const t = typeof v === 'number' ? v : Date.parse(v); return Number.isFinite(t) ? t : null; };
/** A chapter is playable (counted, positioned, drawn on the roadmap) when it has cards (R3 ruling C2). */
export const hasCards = (c) => num(c?.of) > 0 || num(c?.cards) > 0;
const playable = hasCards;

/** "31 of 46 cards seen · 4 of 10 questions tried"; a part that is 0 says the total instead ("46 cards"), never "0 of". */
export function coverageLine(row, { isPro = true } = {}) {
  if (!row) return '';
  const of = num(row.of);
  const seen = Math.min(num(row.seen), of);
  const qs = num(row.questions);
  const tried = Math.min(num(row.tried), qs);
  const parts = [];
  const cardWord = isPro ? 'card' : 'free card';
  if (of > 0) parts.push(seen > 0 ? `${seen} of ${plural(of, cardWord)} seen` : plural(of, cardWord));
  if (qs > 0) parts.push(tried > 0 ? `${tried} of ${plural(qs, 'question')} tried` : plural(qs, 'question'));
  return parts.join(' · ');
}

/** The share of a chapter's open cards seen, 0 to 1, for the 3 px bar. Coverage, never mastery. */
export const coverageShare = (row) => (num(row?.of) > 0 ? Math.min(1, num(row.seen) / num(row.of)) : 0);

/** The one verdict word a roadmap row may carry: "Needs work", only when the chapter state is weak above its evidence floor. */
export const verdictOf = (stateKey) => (stateKey === 'needs_work' ? 'Needs work' : null);

/** The chapter the student is in (see the header). `chapters` are in book order. Returns the chapter or null. */
export function positionOf(chapters, { levelPick = null } = {}) {
  const list = (chapters || []).filter(playable);
  if (!list.length) return null;
  let latest = -1;
  let at = -Infinity;
  list.forEach((c, i) => { const t = time(c.learnAt); if (t !== null && t > at) { at = t; latest = i; } });
  const unseen = (c) => num(c.unseen);
  if (latest >= 0) {
    const here = list[latest];
    if (unseen(here) >= ROADMAP_RULES.stayUnseen) return here;
    return list.slice(latest + 1).find((c) => unseen(c) > 0) || list.find((c) => unseen(c) > 0) || here;
  }
  if (levelPick) { const picked = list.find((c) => c.key === levelPick); if (picked) return picked; }
  return list.find((c) => num(c.of) > 0) || list[0];
}

/**
 * Today's due cards: oldest due first, as many as fit in 40 percent of the minutes (at least one when any is due).
 * `due`: [{ id, dueAt, seconds? }]. Returns { ids, seconds }.
 */
export function todayDue(due, minutes = ROADMAP_RULES.minutes) {
  const cap = budgetSeconds(minutes) * ROADMAP_RULES.dueShare;
  const list = [...(due || [])].filter((d) => d?.id).sort((a, b) => (time(a.dueAt) ?? 0) - (time(b.dueAt) ?? 0) || String(a.id).localeCompare(String(b.id)));
  const ids = [];
  let seconds = 0;
  for (const d of list) {
    const s = num(d.seconds) > 0 ? num(d.seconds) : SECONDS.card.due;
    if (ids.length && seconds + s > cap + 1e-6) break;
    ids.push(d.id);
    seconds += s;
    if (ids.length >= LEARN_RULES.maxCardIds) break;
  }
  return { ids, seconds };
}

/**
 * input:
 *   subject     { id, name }
 *   chapters    in book order (only the student's part): { key, title, of (open cards), cards, seen, unseen, questions, tried,
 *               learnAt, mistakes, mistakeSeconds?, state? }
 *   run         null | { id, chapterKey, title, done, of, minutesLeft, kind, leaveOut }   (an unfinished run in this subject)
 *   due         [{ id, chapterKey, dueAt, seconds? }]  the subject's due open cards
 *   freeDone    Free with today's session used by a run that is not the open one
 *   freeRun     null | { id, chapterKey, minutesLeft, kind }  today's own unfinished run of a kind `run` does not carry (a feed): its Continue row
 *   reviseDue   null | { count, minutes }  the shelves' due count for this subject (C1: the one source); else the due list's own
 *   levelPick   the chapter key a level check picked (or null)
 *   level       { questions, chapterKey }  the questions a level check would ask
 *   minutes     the offer's length (10)
 * Returns { mode, headline, line, sub, progress, key, quiet, position, chapter, or }.
 *   key / quiet / or[i]: { label, run? | href?, go? } where run is { chapterKey, minutes, kind, leaveOut, cardIds?, resume? }.
 */
export function roadmap({ subject, chapters = [], run = null, due = [], freeDone = false, freeRun = null, reviseDue = null, levelPick = null, level = null, minutes = ROADMAP_RULES.minutes, isPro = true } = {}) {
  const name = subject?.name || 'this subject';
  const list = (chapters || []).filter(playable);
  const pos = positionOf(list, { levelPick });
  const index = pos ? list.indexOf(pos) + 1 : 0;
  const where = pos ? { chapterKey: pos.key, index, of: list.length } : null;
  const chapter = pos ? { key: pos.key, title: pos.title, seen: num(pos.seen), of: num(pos.of), unseen: num(pos.unseen) } : null;
  const isNew = !list.some((c) => num(c.seen) > 0 || num(c.tried) > 0 || time(c.learnAt) !== null);
  const feedRow = pos && num(pos.of) + num(pos.questions) > 0
    ? { kind: 'feed', label: 'Play this chapter as a feed', line: 'One card or question at a time', href: `/explore/run?${new URLSearchParams({ chapter: pos.key, min: String(minutes) })}`, go: 'feed' }
    : null;
  const fixRow = (() => {
    const c = [...list].filter((r) => num(r.mistakes) > 0).sort((a, b) => num(b.mistakes) - num(a.mistakes))[0];
    if (!c) return null;
    const n = num(c.mistakes);
    const m = fixMinutes(n, c.mistakeSeconds);
    return {
      kind: 'fix', label: fixMistakes(n, m), line: c.title,
      run: { chapterKey: c.key, minutes: m, leaveOut: ['questions', 'cards', 'lesson'], kind: 'mix' },
    };
  })();
  const base = { position: where, chapter, progress: null, quiet: null, sub: null };
  const or = (...rows) => rows.filter(Boolean).slice(0, ROADMAP_RULES.maxOr);
  // "Revise 9 due cards · 3 min": every due card of the subject, oldest first (a 'cards' run is never counted against Free's session).
  const dueSorted = [...(due || [])].filter((d) => d?.id).sort((a, b) => (time(a.dueAt) ?? 0) - (time(b.dueAt) ?? 0) || String(a.id).localeCompare(String(b.id))).slice(0, LEARN_RULES.maxCardIds);
  const dueCount = Math.max(0, Math.floor(num(reviseDue?.count ?? due?.length)));
  const dueMinutes = wholeMinutes(reviseDue?.minutes || (dueSorted.reduce((s, d) => s + (num(d.seconds) > 0 ? num(d.seconds) : SECONDS.card.due), 0) / 60));
  const reviseRow = dueCount > 0 && dueSorted.length
    ? { kind: 'revise', label: reviseDueLabel(dueCount, dueMinutes), run: { chapterKey: dueSorted[0].chapterKey || pos?.key || null, minutes: dueMinutes, kind: 'cards', leaveOut: [], cardIds: dueSorted.map((d) => d.id) } }
    : null;

  if (run && num(run.of) > num(run.done)) {
    const left = Math.max(1, num(run.minutesLeft) || 1);
    const done = Math.max(0, num(run.done));
    return {
      ...base, mode: 'pickup',
      headline: `Pick up ${run.title}`,
      line: done > 0 ? `${done} of ${num(run.of)} done` : `${plural(num(run.of), 'step')} lined up`,
      progress: done > 0 ? { done, of: num(run.of) } : null,
      key: { label: withMinutes(WORDS.continue, left), run: { chapterKey: run.chapterKey, minutes: left, kind: run.kind || 'mix', leaveOut: run.leaveOut || [], resume: run.id } },
      // Free after the day's session: a fix run is a counted chapter run (Key cards only), so only the Revise row is offered.
      or: freeDone ? or(reviseRow) : or(reviseRow, fixRow),
    };
  }
  if (freeDone) {
    // R3 ruling F: the feed refusal's block, word for word. Or rows in ruling F's order, only those that apply.
    const left = freeRun ? Math.max(1, num(freeRun.minutesLeft) || 1) : 0;
    const continueRow = freeRun && freeRun.id && freeRun.chapterKey
      ? { kind: 'continue', label: withMinutes(WORDS.continue, left), run: { chapterKey: freeRun.chapterKey, minutes: left, kind: freeRun.kind || 'mix', leaveOut: [], resume: freeRun.id } }
      : null;
    return {
      ...base, mode: 'freeDone',
      headline: FREE_DONE_HEADLINE,
      line: FREE_DONE_LINE,
      key: { label: WORDS.seePro, href: '/pricing', go: 'pro' },
      quiet: null,
      or: or(continueRow, reviseRow, { kind: 'singles', label: WORDS.singles, href: '/explore', go: 'explore' }),
    };
  }
  if (!pos) return null;
  const startRun = (cardIds = []) => ({ chapterKey: pos.key, minutes, kind: 'mix', leaveOut: [], ...(cardIds.length ? { cardIds } : {}) });
  if (isNew) {
    const n = Math.min(LEARN_RULES.levelQuestions, num(level?.questions));
    const levelRow = n > 0 && !levelPick
      ? { kind: 'level', label: WORDS.skipKnown, line: `${plural(n, 'question')} · about ${levelMinutes(n)} min`, run: { chapterKey: level?.chapterKey || pos.key, minutes: n, kind: 'level', leaveOut: [] } }
      : null;
    return {
      ...base, mode: 'new',
      headline: `Start learning ${name}`,
      line: `Chapter ${index} of ${list.length} · ${pos.title}`,
      key: { label: `Start chapter ${index} · ${minutes} min`, run: startRun() },
      or: or(reviseRow, levelRow, feedRow),
    };
  }
  const today = todayDue(due, minutes);
  const unseen = num(pos.unseen);
  const sub = today.ids.length
    ? `${plural(today.ids.length, 'due card')} first, then ${unseen > 0 ? 'new ones here' : 'this chapter'}`
    : unseen > 0 ? `${unseen} new ${unseen === 1 ? 'card' : 'cards'} left here` : null;
  return {
    ...base, mode: 'today',
    headline: `Today's ${minutes} minutes in ${name}`,
    line: `Chapter ${index} of ${list.length} · ${pos.title}`,
    sub,
    key: { label: `Start · ${minutes} min`, run: startRun(today.ids) },
    due: { count: today.ids.length },
    or: or(reviseRow, fixRow, feedRow),
  };
}

/** Every line the offer draws, for the "no zero is ever a lead" check: headline, line, sub, key and row labels. */
export const offerLines = (r) => (r ? [r.headline, r.line, r.sub, r.key?.label, r.quiet?.label, ...(r.or || []).flatMap((o) => [o.label, o.line])].filter(Boolean) : []);
/** True when a line leads with or states a zero count ("0 due", "0 of 2", "0 kept"). */
export const hasZeroCount = (text) => /(^|[^\d.,:])0\s+(of|due|kept|cards?|questions?|mistakes?|in|new|left|seen|missed)\b/i.test(String(text || ''));
