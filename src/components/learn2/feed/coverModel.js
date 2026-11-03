// The words on an Explore cover (docs/brain/learn-1031/audit-1101/A2-explore-covers.md 4.2, BUILD-1101 B7), kept out of the
// component so they are tested on their own (coverModel.test.mjs). Pure functions, no React, no fetch. Every line reads the
// server's fields first (refLine, history, resume, the due-free studentLine, name of packet S3) and falls back to the older
// fields (ref, partTitle, unitTitle, studentLine with due) so a cover reads right before and after S3.
import { KIND_LABELS } from '../../keycards/kinds.js';
import { WORDS, chapterShort, withMinutes } from '../../../../data/learn/words.js';

const plural = (n, one, many = `${one}s`) => `${Number(n).toLocaleString('en-IN')} ${n === 1 ? one : many}`;
// R3 ruling W: question mistakes are "open mistakes" everywhere (the server's feed lines still say "old"), and a time is " · N min".
const openWords = (t) => String(t || '').replace(/\bold (mistakes?)\b/gi, 'open $1');

/**
 * The cover's label (R4 ruling N): "Chapter 5", the chapter's place among the student's playable chapters in roadmap order. The
 * NCERT number ("Part 1, Ch 2") is never a chapter label: three chapters share "Ch 2". Null when the server sent no `place`, so a
 * cover then draws no label at all (never "Ch N").
 */
export const refLineOf = (c = {}) => chapterShort(c.place) || null;

/** Whether the student has any history in this subject: the server's `history`, else any cover that is not "New to you". */
export function hasHistory(data = {}) {
  if (typeof data.history === 'boolean') return data.history;
  return (data.covers || []).some((c) => (c.studentLine && c.studentLine !== 'New to you') || c.resume || c.mistakes > 0 || c.kept > 0);
}

/** Free with its 20 minutes composed as 10 (the only place the server marks `capped`). */
export const isFreePlan = (data = {}) => (data.covers || []).some((c) => c.counts?.[20]?.capped);

const BOOK_ORDER = /^(chapter 1 of your book|first in the syllabus)$/i;
const lowerFirst = (s) => (s ? s.charAt(0).toLowerCase() + s.slice(1) : s);

/**
 * The lead cover's line: { prefix, text }. "Suggested:" only when the reason comes from the student's own history; book order
 * reads "Start here: first in the syllabus" (A2 4.6; never an unearned suggestion). R7 W (LK59): the word is "Suggested", the one
 * word the product marks its pick with (Today's Up next, Learn's Up next), where it was "For you".
 */
export function leadLine(c = {}, { history = true } = {}) {
  if (!c.forYou) return null;
  const reason = String(c.reason || '').trim();
  if (!history || BOOK_ORDER.test(reason) || !reason) return { prefix: 'Start here:', text: 'first in the syllabus' };
  return { prefix: 'Suggested:', text: openWords(lowerFirst(reason)) };
}

// R2 ruling 2: the only verdict word on a chapter is "Needs work". These never show on a cover: they told a teen nothing apart.
const QUIET_VERDICTS = /^(getting there|holding|too few answers|fading|not started|thin)$/i;

/**
 * Another cover's one line: resume, else old mistakes, else "Needs work" (the only verdict word, R2 ruling 2), else "New to you"
 * for a chapter never opened; a studied chapter with nothing to say has no line. Due counts never show (a feed serves no due
 * card). Null when the student has no history in the subject (every line would say "New to you").
 */
export function studentLineOf(c = {}, { history = true } = {}) {
  if (!history) return null;
  if (c.resume && c.resume.of) return `You stopped at ${c.resume.done} of ${c.resume.of}`;
  const raw = String(c.studentLine || '').trim();
  const parts = raw.split(/,\s*/).filter((p) => p && !/^\d[\d,]*\s+due$/i.test(p) && !QUIET_VERDICTS.test(p));
  const line = openWords(parts.join(', ')).replace(/^(\d[\d,]*\s+open mistakes?)$/i, '$1 to fix');
  if (line) return line;
  if (c.mistakes > 0) return `${plural(c.mistakes, 'open mistake')} to fix`;
  if (c.state?.key === 'needs_work') return 'Needs work';
  if (c.state?.key && c.state.key !== 'none') return null;
  if (QUIET_VERDICTS.test(raw) && !/^not started$/i.test(raw)) return null;
  return 'New to you';
}

/** The counts for the picked length (falls back to 10). */
export const countsOf = (c = {}, minutes = 10) => c.counts?.[minutes] || c.counts?.[10] || { cards: 0, questions: 0, minutes };

/**
 * The mix line (a first visit: "Cards and questions"): "16 Key cards, 5 questions", "36 Key cards", "8 questions", "16 Key cards, all it has today"; empty on
 * resume (the key carries the time). Free never gets "all it has today" (its five open cards are Free's rule, not the chapter's size).
 */
export function mixLineOf(c = {}, minutes = 10, { free = false, history = true } = {}) {
  if (c.resume && c.resume.of) return '';
  const n = countsOf(c, minutes);
  // A first visit (no history in the subject): what a feed holds in plain words, since "Key card" means nothing yet (phone-clarity 18).
  if (!history) return n.cards && n.questions ? 'Cards and questions' : n.cards ? 'Cards, one at a time' : n.questions ? 'Questions, one at a time' : '';
  const parts = [n.cards ? plural(n.cards, 'Key card') : null, n.questions ? plural(n.questions, 'question') : null].filter(Boolean);
  if (!parts.length) return '';
  const short = !free && !n.capped && Number(n.minutes) < Number(minutes);
  return `${parts.join(', ')}${short ? ", that's all for today" : ''}`;
}

/**
 * The key's words (R3 ruling W): "Start · 10 min", "Continue · 4 min" (also at Free's daily limit: the feed resumes its own run, M3), or at
 * Free's daily limit, for a chapter with no feed to resume, "Questions on this chapter".
 */
export function keyLabelOf(c = {}, minutes = 10, { freeDone = false } = {}) {
  if (c.resume && c.resume.of) return withMinutes(WORDS.continue, c.resume.minutesLeft || 1);
  if (freeDone) return 'Questions on this chapter';
  return withMinutes('Start', countsOf(c, minutes).minutes || minutes);
}

/** A fill-in-the-blank card front: a run of 2 or more underscores or dashes, or "[...]", standing for the missing word. */
export const isCloze = (text = '') => /_{2,}|\[\s*(?:\.{2,}|…)\s*\]|[-–]{4,}/.test(String(text || ''));

/** The longest front a cover sets in display type (five lines at 15 px is the last tier, hookTier). */
export const HOOK_MAX = 105;

/** Whether a card front can be a cover's line: not a cloze, and short enough for the display type. */
export const isReadableHook = (front = '') => {
  const t = String(front || '').trim();
  return t.length > 0 && t.length <= HOOK_MAX && !isCloze(t);
};

/** The hook's size tier by length (A2 4.3): up to 24, 48, 80, 105 characters, then longer (five lines at 15 px). */
export function hookTier(text = '') {
  const n = String(text || '').length;
  return n <= 24 ? 's' : n <= 48 ? 'm' : n <= 80 ? 'l' : n <= 105 ? 'xl' : 'xxl';
}

/**
 * What the cover's media shows: { kind: 'card', text } (the feed's opening card), { kind: 'locked', label } (a card Free cannot
 * open: its kind and "Pro card", never null), or { kind: 'questions', text, note } when the feed opens on a question (the hook is null):
 * "Your cards here are in Revise." when the chapter's cards are kept or due, else "No Key cards here yet."
 */
export function mediaOf(c = {}, minutes = 10) {
  // R4 owner-eye#10: the line on a cover is a card a student can read cold, never a fill-in-the-blank. The server may send its
  // candidates (`hooks`, in the order the feed serves them) beside the one `hook`; the first short, non-cloze front wins.
  const own = countsOf(c, minutes).hook || c.hook;
  const lengthHooks = countsOf(c, minutes).hooks;
  const hooks = Array.isArray(lengthHooks) ? lengthHooks : Array.isArray(c.hooks) ? c.hooks : [];
  const candidates = [...hooks, own].filter(Boolean);
  const readable = candidates.find((h) => h.front && isReadableHook(h.front));
  // R6 Web D: the hook's own kind rides along (when the server sends it) for the cover's kind tab.
  if (readable) return { kind: 'card', text: String(readable.front), ...(readable.kind ? { cardKind: String(readable.kind) } : {}) };
  const h = own;
  // Only a cloze or a long card is left: say what the feed holds instead of an unfinished sentence.
  if (h && h.front) {
    const n = countsOf(c, minutes);
    return { kind: 'cards', text: n.cards ? plural(n.cards, 'Key card') : 'Key cards', note: n.questions ? `and ${plural(n.questions, 'question')}` : 'one at a time' };
  }
  if (h && h.locked) return { kind: 'locked', label: kindLabel(h.kind) };
  const q = countsOf(c, minutes).questions || countsOf(c, 10).questions || 0;
  // A chapter with a kept or due card still has cards: they wait in Revise, so the line says that (never "No Key cards here yet").
  const inRevise = Number(c.kept) > 0 || Number(c.due) > 0;
  return { kind: 'questions', text: q ? plural(q, 'question') : 'Questions', note: inRevise ? 'Your cards here are in Revise.' : 'No Key cards here yet.' };
}

/** Whether a cover's key opens the chapter's own questions on the page (Free at the day's limit, no feed of its own to pick up). */
export const opensQuestions = (c = {}, { freeDone = false } = {}) => Boolean(freeDone) && !(c.resume && c.resume.of);

export const kindLabel = (k) => KIND_LABELS[String(k || '').toLowerCase()] || 'Key card';

/** "accountancy.admission-of-partner" -> "admission-of-partner"; "Admission of Partner" -> "admission-of-partner". */
export const slugOf = (s) => String(s || '').toLowerCase().replace(/^[a-z_]+\./, '').replace(/&/g, ' and ').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');

/**
 * The syllabus chapter name (the Explore Chapter filter's value) for a cover: the server's `name`, else the syllabus chapter
 * whose slug matches the cover's key or title. Null when none matches.
 */
export function chapterNameOf(c = {}, names = []) {
  if (c.name) return c.name;
  const want = new Set([slugOf(c.key), slugOf(c.title)]);
  return names.find((n) => want.has(slugOf(n))) || null;
}

/** Feed lengths: the stored choice, else 10. */
export const LENGTHS = [5, 10, 20];
export const readLength = (raw) => { const n = Number(raw); return LENGTHS.includes(n) ? n : 10; };

/**
 * A feed started from a cover (BUILD-1101 B7 item 4): the cover's tap leaves { chapterKey, forYou, position, at } in
 * sessionStorage under this key; the feed, starting that chapter within a minute, sends { source: 'explore_cover', forYou,
 * position } with its start (startRun options) and removes the key. readCoverStart does both checks.
 */
export const COVER_START_KEY = 'learn2:coverStart';
export function readCoverStart(chapterKey, { now = Date.now(), storage = globalThis.sessionStorage } = {}) {
  try {
    const raw = storage?.getItem(COVER_START_KEY);
    if (!raw) return null;
    storage.removeItem(COVER_START_KEY);
    const v = JSON.parse(raw);
    if (!v || v.chapterKey !== chapterKey || !(now - Number(v.at) < 60000)) return null;
    return { source: 'explore_cover', forYou: Boolean(v.forYou), position: Math.max(0, Math.min(500, Number(v.position) || 0)) };
  } catch { return null; }
}
