// Learn v2: the three suggestions on Learn home (DESIGN-SPEC.md A7, B section 3.1 "States", BUILD-1101 1.8 R9). PURE.
// Always exactly three, of three different kinds, each with one line of evidence and an action that starts at once
// (a run, or a place to go). Never a recap of a chapter the student has not studied. Suggestions do what they say (R9):
//   - no chapter is named twice while another qualifies (R9.1);
//   - 'due' runs hold only the chapter's due cards (R9.2); 'fix' runs hold only its open mistakes (R9.3);
//   - 'next' is the first unstarted chapter in book order after the latest Learn activity (R9.4);
//   - every minutes figure is compose.minutesFor over the items' seconds, the one function of Learn (R9.5);
//   - Free with today's session used: a suggestion that would serve questions says "Key cards only today" (R9.6).
//
// Kinds: pickup (an unfinished run), due (due cards in a chapter), fix (open mistakes), next (next chapter in book order),
// start (a new student's first chapter), feed (that chapter as a feed: a new student's third, A3 3.10), level (Find your
// level), recap (a studied chapter's Must-know lines), search.
// R3-SPEC ruling W: every key says its thing in the one word of data/learn/words.js, with " · N min" after it.
import { LEARN_RULES, minutesFor } from './compose.js';
import { SECONDS } from './seconds.js';
import { FREE_END_LINE, isCounted } from './allowance.js';
import { WORDS, fixMistakes, reviseDue, withMinutes, wholeMinutes } from './words.js';

export const SUGGESTION_KINDS = Object.freeze(['pickup', 'due', 'fix', 'next', 'start', 'feed', 'level', 'recap', 'search']);
export const CARDS_ONLY_TODAY = 'Key cards only today.';
/** A chapter with this many unseen open cards keeps the student (data/learn/roadmap.js ROADMAP_RULES.stayUnseen is the same rule). */
export const STAY_UNSEEN = 3;

const plural = (n, one, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;
const minutesWord = (n) => plural(n, 'minute');
const runnable = (c) => (c.cards || 0) > 0 || (c.questions || 0) > 0;
const known = (s) => Number.isFinite(Number(s)) && Number(s) > 0;

/** Minutes of a run of `n` due cards (12 s each; `seconds` when the caller summed the cards' own seconds). */
export const cardRunMinutes = (n, seconds = null) => minutesFor(known(seconds) ? Number(seconds) : n * SECONDS.card.due);
/** Minutes of a run that retries `n` open mistakes and nothing else (60 s each; `seconds` when known). */
export const fixMinutes = (n, seconds = null) => minutesFor(known(seconds) ? Number(seconds) : n * SECONDS.mistake);
/** Minutes of a recap of `n` Must-know cards (10 s each; `seconds` when the caller summed the cards' own seconds). */
export const recapMinutes = (n, seconds = null) => minutesFor(known(seconds) ? Number(seconds) : n * SECONDS.card.recap);
/** Minutes of a level run ("Skip what you already know") of `n` questions (55 s each: "6 questions, about 6 minutes"). */
export const levelMinutes = (n) => minutesFor(n * SECONDS.level);

function bookLine(c, subjectName) {
  if (!c.chapterNo) return null;
  const book = c.book && !String(c.book).startsWith(subjectName) ? c.book : subjectName;
  return `Chapter ${c.chapterNo} of your ${book} book.`;
}

function contents(c) {
  if (c.cards > 0 && c.questions > 0) return 'Key cards and questions';
  if (c.cards > 0) return 'Key cards';
  return 'questions';
}

/**
 * input:
 *   subject     { id, name, cards }  (cards: the subject's Key cards count)
 *   isNew       nothing studied or answered in this subject yet
 *   chapters    rows in book order: { key, title, chapterNo, book, cards, mustKnow, due, dueIds?, dueSeconds?, mistakes,
 *               mistakeSeconds?, recapSeconds?, questions, studied, state? ('none' = Not started), lastActivityAt?,
 *               mistakeWhere?, mistakeWhen? } (mistakes: the eligible ones, R10.1)
 *   run         null | { id, chapterKey, title, done, of, minutesLeft, kind, minutes, leaveOut }
 *   level       { questions } questions in the student's first chapters (Skip what you already know)
 *   minutes     the student's usual length (default 10)
 *   isPro, sessionUsed   Free with today's Learn session used (R9.6); sessionRunId: the run holding it (its pick-up is free)
 * Returns [Suggestion x3]: { kind, title, headline, chapterTitle, evidence, chapterKey, action: { label, run?, href?, go? } }.
 * `title` is the whole line ("3 cards due in Accounting Ratios"); `headline` and `chapterTitle` are its two parts, for a
 * card that sets the chapter on its own line (B 3.1: "3 cards due" / "Accounting Ratios").
 */
export function suggestions({ subject, isNew = false, chapters = [], run = null, level = { questions: 0 }, minutes = 10, isPro = true, sessionUsed = false, sessionRunId = null } = {}) {
  const name = subject?.name || 'this subject';
  const rows = (chapters || []).filter(runnable);
  const out = [];
  const used = new Set();
  const usedChapters = new Set();
  const cardsOnly = !isPro && Boolean(sessionUsed);
  const finish = (s) => {
    const { place, ...sugg } = s;
    // R9.6: a counted run (mix or feed) after Free's session is composed as Key cards only; the evidence says so.
    const r = sugg.action?.run;
    if (cardsOnly && r && isCounted(r.kind) && !(sugg.kind === 'pickup' && r.resume && r.resume === sessionRunId)) {
      sugg.evidence = place ? `${CARDS_ONLY_TODAY} ${place}` : CARDS_ONLY_TODAY;
    }
    return sugg;
  };
  const add = (s) => {
    if (!s || used.has(s.kind) || out.length >= 3) return;
    used.add(s.kind);
    if (s.chapterKey) usedChapters.add(s.chapterKey);
    out.push(finish(s));
  };
  const mixRun = (c, m = minutes, leaveOut = []) => ({ chapterKey: c.key, minutes: m, leaveOut, kind: 'mix' });
  // R9.1: a chapter no other suggestion names first; then the score.
  const prefer = (list, score) => [...list].sort((a, b) => (usedChapters.has(a.key) ? 1 : 0) - (usedChapters.has(b.key) ? 1 : 0)
    || score(b) - score(a))[0] || null;
  const notStarted = (r) => (r.state ? r.state === 'none' : !r.studied);

  const make = {
    pickup() {
      if (!run || !(run.of > run.done)) return null;
      const left = Math.max(1, run.minutesLeft || 1);
      return {
        kind: 'pickup', chapterKey: run.chapterKey, title: `Pick up ${run.title}`, headline: 'Pick up', chapterTitle: run.title,
        evidence: `You stopped at ${run.done} of ${run.of}. About ${minutesWord(left)} left.`,
        action: { label: withMinutes(WORDS.continue, left), run: { chapterKey: run.chapterKey, minutes: left, leaveOut: run.leaveOut || [], kind: run.kind || 'mix', resume: run.id } },
      };
    },
    due() {
      const c = prefer(rows.filter((r) => r.due > 0), (r) => r.due);
      if (!c) return null;
      // R9.2: only the chapter's due cards; no new card is added to a due run.
      const m = cardRunMinutes(c.due, c.dueSeconds);
      const ids = Array.isArray(c.dueIds) ? c.dueIds.slice(0, LEARN_RULES.maxCardIds) : null;
      return {
        kind: 'due', chapterKey: c.key, title: `${plural(c.due, 'card')} due in ${c.title}`, headline: `${plural(c.due, 'card')} due`, chapterTitle: c.title,
        evidence: `Due today, about ${minutesWord(m)}.`,
        action: { label: reviseDue(c.due, m), run: { chapterKey: c.key, minutes: m, leaveOut: ['questions', 'mistakes', 'lesson'], kind: 'cards', ...(ids?.length ? { cardIds: ids } : {}) } },
      };
    },
    fix() {
      const c = prefer(rows.filter((r) => r.mistakes > 0), (r) => r.mistakes);
      if (!c) return null;
      // R9.3: only the open mistakes, each with its line on the answer.
      const m = fixMinutes(c.mistakes, c.mistakeSeconds);
      // M7: one short line a phone shows whole ("From Mock 3 on 16 Oct."), never cut.
      const evidence = c.mistakeWhere && c.mistakeWhen ? `From ${c.mistakeWhere} on ${c.mistakeWhen}.` : 'With the lines you needed.';
      return {
        kind: 'fix', chapterKey: c.key, title: `${plural(c.mistakes, 'open mistake')} in ${c.title}`, headline: plural(c.mistakes, 'open mistake'), chapterTitle: c.title,
        evidence,
        // `fresh` (server-security#3): a NEW mistakes-only run, never a resume of a stopped run of the chapter.
        action: { label: fixMistakes(c.mistakes, m), run: { ...mixRun(c, m, ['questions', 'cards', 'lesson']), fresh: true } },
      };
    },
    next() {
      // R9.4: the first unstarted chapter in book order after the chapter of the latest Learn activity; none after it, the
      // first unstarted one in book order.
      let latest = -1;
      let at = -Infinity;
      rows.forEach((r, i) => { const t = Number(r.lastActivityAt); if (r.lastActivityAt !== null && r.lastActivityAt !== undefined && Number.isFinite(t) && t > at) { at = t; latest = i; } });
      const fresh = (r) => notStarted(r) && !usedChapters.has(r.key);
      const after = rows.slice(latest + 1).find(fresh) || rows.find(fresh);
      if (!after) return null;
      const where = after.chapterNo ? `Chapter ${after.chapterNo} of ${after.book || name}.` : null;
      return {
        kind: 'next', chapterKey: after.key, title: `Next in the book: ${after.title}`, headline: 'Next in the book', chapterTitle: after.title,
        evidence: `${where ? `${where} ` : ''}${minutes} minutes of its ${contents(after)}.`, place: where,
        action: { label: withMinutes('Start', minutes), run: mixRun(after) },
      };
    },
    start() {
      const c = rows.find((r) => r.cards > 0) || rows[0];
      if (!c) return null;
      const where = bookLine(c, name);
      return {
        kind: 'start', chapterKey: c.key, title: `Start with ${c.title}`, headline: 'Start with', chapterTitle: c.title,
        evidence: [where, `${minutes} minutes of its ${contents(c)}.`].filter(Boolean).join(' '), place: where,
        action: { label: withMinutes('Start', minutes), run: mixRun(c) },
      };
    },
    feed() {
      // A3 3.10: a new student's third suggestion (in place of the search one): the first chapter as a feed, 10 minutes.
      const c = rows.find((r) => r.cards > 0) || rows[0];
      if (!c) return null;
      return {
        kind: 'feed', chapterKey: c.key, title: c.chapterNo ? `Chapter ${c.chapterNo} as a feed` : `${c.title} as a feed`, headline: 'As a feed', chapterTitle: c.title,
        evidence: 'One card or question at a time, 10 minutes.',
        action: { label: 'Open the feed', href: `/explore/run?${new URLSearchParams({ chapter: c.key, min: '10' })}`, go: 'feed' },
      };
    },
    level() {
      const n = Math.min(LEARN_RULES.levelQuestions, level?.questions || 0);
      if (n < 1) return null;
      const first = rows.find((r) => r.questions > 0);
      const m = levelMinutes(n);
      return {
        kind: 'level', chapterKey: first?.key || null, title: WORDS.skipKnown, headline: WORDS.skipKnown, chapterTitle: null,
        evidence: `${plural(n, 'question')} · about ${wholeMinutes(m)} min`,
        action: { label: withMinutes('Start', m), run: { chapterKey: first?.key || null, minutes: n, leaveOut: [], kind: 'level' } },
      };
    },
    recap() {
      const c = prefer(rows.filter((r) => r.studied && r.mustKnow > 0), (r) => (r.lastActivityAt || 0));
      if (!c) return null;
      const m = recapMinutes(c.mustKnow, c.recapSeconds);
      return {
        kind: 'recap', chapterKey: c.key, title: `Quick recap: ${c.title}`, headline: 'Quick recap', chapterTitle: c.title,
        evidence: `Its ${plural(c.mustKnow, 'Must-know line')}, about ${minutesWord(m)}.`,
        action: { label: withMinutes(WORDS.quickRecap, m), run: { chapterKey: c.key, minutes: m, leaveOut: [], kind: 'recap' } },
      };
    },
    search() {
      const n = subject?.cards || 0;
      return {
        kind: 'search', chapterKey: null, title: n ? 'Search any card' : 'Search chapters', headline: n ? 'Search any card' : 'Search chapters', chapterTitle: null,
        evidence: n ? `${n} ${name} cards, by term or line.` : `Every ${name} chapter and lesson, by name.`,
        action: { label: n ? 'Search cards' : 'Search', href: `/learn/find?subject=${encodeURIComponent(subject?.id || '')}`, go: 'find' },
      };
    },
  };

  const order = isNew
    ? ['start', 'level', 'feed', 'search', 'next']
    : ['pickup', 'next', 'due', 'fix', 'recap', 'level', 'search'];
  if (!isNew) {
    // Returning: 1 = an unfinished run, else the next chapter; 2 = due cards; 3 = open mistakes.
    add(make.pickup() || make.next());
    add(make.due());
    add(make.fix());
  }
  for (const kind of order) add(make[kind]());
  // R9.1: two suggestions on one chapter while another qualifies: make the movable one again with that chapter taken.
  for (let i = 0; i < out.length; i += 1) {
    for (let j = i + 1; j < out.length; j += 1) {
      const key = out[i].chapterKey;
      if (!key || key !== out[j].chapterKey) continue;
      for (const k of [i, j]) {
        if (!['due', 'fix', 'recap'].includes(out[k].kind)) continue;
        const alt = make[out[k].kind]();
        if (alt && alt.chapterKey && alt.chapterKey !== key) { out[k] = finish(alt); usedChapters.add(alt.chapterKey); break; }
      }
    }
  }
  // Last resort for a one-chapter subject with nothing else to offer: a shorter start of its first chapter.
  if (out.length < 3 && rows.length) {
    const c = rows[0];
    if (!used.has('next')) add({ kind: 'next', chapterKey: c.key, title: `A short start: ${c.title}`, headline: 'A short start', chapterTitle: c.title, evidence: `5 minutes of its ${contents(c)}.`, action: { label: withMinutes('Start', 5), run: mixRun(c, 5) } });
    if (!used.has('start')) add({ kind: 'start', chapterKey: c.key, title: `Start with ${c.title}`, headline: 'Start with', chapterTitle: c.title, evidence: `${minutes} minutes of its ${contents(c)}.`, action: { label: withMinutes('Start', minutes), run: mixRun(c) } });
  }
  return out.slice(0, 3);
}

// ---------------------------------------------------------------- the session end's keys (B 3.6, R3-SPEC L5, W, F)

/**
 * The end screen's main key (`lead`) and its quiet link (`options[0]`), the same for a run and a feed (R3-SPEC L5). input:
 *   subject       the subject id (the full mock's link)
 *   chapter       { key, title, name? }   minutes   the session's length (run.asked unless shrunk, R4)
 *   kind          the session's kind: 'feed' keeps a feed a feed; anything else plays a chapter run ('mix')
 *   missed        cards whose first rating was Missed      fresh   new cards left in the chapter
 *   here          null | { cards, questions }: the real dry run of the chapter (the key's evidence, R6.2)
 *   next          null | { key, title, place? } next chapter in book order (place: R4 ruling N, carried onto the option)
 *   mistakes      null | { count, seconds? } this chapter's open mistakes ("Fix 3 open mistakes · 3 min", a NEW mistakes-only run)
 *   mustKnow      the chapter's Must-know count (Quick recap)      recapSeconds   its recap's own seconds (optional)
 *   freeSessionUsed  Free with today's session used (ruling F): nothing that serves questions
 *   hadCards      the session served Key cards (Free's main key is then "Quick recap · 1 min", else "See Pro")
 *   unseen        the chapter's open cards not seen yet (R2 ruling 3). Known: more than 0 is "Keep going · 10 min", 0 is
 *                 "Next chapter · 10 min". Unknown: the next chapter leads unless 3 or more cards were missed.
 *   stopped       null | { runId, kind, minutesLeft }: a run stopped part way (C2-1). The main key is "Continue · N min" and
 *                 resumes that run by its id; the quiet link is the fix key (a new run, `fresh`), never a resume.
 *   isPro         R4 server-security#1: on Free, a stopped counted run (a mix or a feed) is the day's pending session holder even
 *                 before its first answer claims it, so its end offers no fix key: the fix run's first answer would claim the day
 *                 and the Continue key would then be refused.
 * R2 ruling 5: one main key and at most one quiet link, so `options` holds one option at most: this chapter's open mistakes
 * when there are any, else the other of Keep going and Next chapter (other keys of the subject live on Learn home).
 * Every option carries `kind` ('continue' | 'here' | 'next' | 'fix' | 'recap' | 'pro'), `label` (the key's
 * exact words), `title` (the same words, for older readers), `minutes` (null when not a timed run), and `run` or `href`.
 * A Free end after the day's session puts FREE_END_LINE on the lead as `line`.
 */
export function endOptions({ subject = null, chapter, minutes = 10, kind = 'mix', missed = 0, here: hereCounts = null, next = null, mistakes = null, mustKnow = 0, recapSeconds = null, freeSessionUsed = false, hadCards = true, unseen = null, stopped = null, isPro = true }) {
  const runKind = kind === 'feed' ? 'feed' : 'mix';
  const m10 = wholeMinutes(minutes);
  const recap = mustKnow > 0 ? (() => {
    const m = recapMinutes(mustKnow, recapSeconds);
    const label = withMinutes(WORDS.quickRecap, m);
    return { kind: 'recap', title: label, minutes: m, label, evidence: `Its ${plural(mustKnow, 'Must-know line')}, answers showing.`, run: { chapterKey: chapter.key, minutes: m, leaveOut: [], kind: 'recap' } };
  })() : null;
  const fix = mistakes?.count ? (() => {
    const m = fixMinutes(mistakes.count, mistakes.seconds);
    const label = fixMistakes(mistakes.count, m);
    // A NEW run of the chapter's open mistakes only (`fresh`), so a stopped run of the chapter is never resumed by it.
    return { kind: 'fix', title: label, minutes: m, label, evidence: chapter.title, run: { chapterKey: chapter.key, minutes: m, leaveOut: ['questions', 'cards', 'lesson'], kind: 'mix', fresh: true } };
  })() : null;
  const seePro = { kind: 'pro', title: WORDS.seePro, minutes: null, label: WORDS.seePro, href: '/pricing', go: 'pro' };

  // A run stopped part way: Continue resumes it by its id; the fix key starts a new mistakes-only run (never on Free's used day).
  if (stopped?.runId) {
    const m = wholeMinutes(stopped.minutesLeft);
    const label = withMinutes(WORDS.continue, m);
    const lead = { kind: 'continue', title: label, minutes: m, label, evidence: null, run: { chapterKey: chapter.key, minutes: m, leaveOut: [], kind: stopped.kind || runKind, resume: stopped.runId } };
    const pending = !isPro && isCounted(stopped.kind || runKind);
    return { lead, options: fix && !freeSessionUsed && !pending ? [fix] : [] };
  }
  // Free after the day's session (ruling F): one line, then Quick recap when the session had cards, else See Pro; See Pro quiet.
  if (freeSessionUsed) {
    const first = hadCards && recap ? recap : null;
    return first
      ? { lead: { ...first, line: FREE_END_LINE }, options: [seePro] }
      : { lead: { ...seePro, line: FREE_END_LINE }, options: [] };
  }
  const hereParts = hereCounts
    ? [hereCounts.cards ? `${hereCounts.cards} Key ${hereCounts.cards === 1 ? 'card' : 'cards'}` : null, hereCounts.questions ? plural(hereCounts.questions, 'question') : null].filter(Boolean)
    : [];
  const keepLabel = withMinutes(WORDS.keepGoing, m10);
  const keep = {
    kind: 'here', title: keepLabel, minutes: m10, label: keepLabel,
    evidence: hereParts.length ? hereParts.join(' and ')
      : [Number.isFinite(unseen) && unseen > 0 ? `${unseen} new ${unseen === 1 ? 'card' : 'cards'} left here` : null, missed ? plural(missed, 'missed card') : null].filter(Boolean).join(', ') || `More of ${chapter.title}.`,
    // `fresh`: more of the chapter, never a resume of a run of it that is still open today.
    run: { chapterKey: chapter.key, minutes: m10, leaveOut: [], kind: runKind, fresh: true },
  };
  const nextLabel = withMinutes(WORDS.nextChapter, m10);
  const nextOpt = next ? {
    kind: 'next', title: nextLabel, minutes: m10, label: nextLabel, chapterTitle: next.title, evidence: next.title, ...(next.place ? { place: next.place } : {}),
    run: { chapterKey: next.key, minutes: m10, leaveOut: [], kind: runKind },
  } : null;
  // R2 ruling 3 with W: a chapter is finished (every card seen once) before the next one leads.
  const more = Number.isFinite(unseen) ? unseen > 0 : missed >= 3;
  const lead = more || !nextOpt ? keep : nextOpt;
  const other = lead === keep ? nextOpt : keep;
  // The quiet link is options[0]: this chapter's open mistakes when there are any, else the other of Keep going / Next chapter.
  return { lead, options: [fix || other].filter(Boolean) };
}
