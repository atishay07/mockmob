// The words on an Explore cover (docs/brain/learn-1031/audit-1101/A2-explore-covers.md 4.2, BUILD-1101 B7), kept out of the
// component so they are tested on their own (coverModel.test.mjs). Pure functions, no React, no fetch. Every line reads the
// server's fields first (refLine, history, resume, the due-free studentLine, name of packet S3) and falls back to the older
// fields (ref, partTitle, unitTitle, studentLine with due) so a cover reads right before and after S3.
import { KIND_LABELS } from '../../keycards/kinds.js';

const plural = (n, one, many = `${one}s`) => `${Number(n).toLocaleString('en-IN')} ${n === 1 ? one : many}`;
const minutesText = (n) => plural(n, 'minute');

/** "Part 1, Ch 2", "Microeconomics, Ch 2", "Indian Economic Development, Ch 5", "Verbal Ability", or null. */
export function refLineOf(c = {}) {
  if (c.refLine) return c.refLine;
  const ref = c.ref || null;
  const part = String(c.partTitle || '').trim();
  const m = /\bPart\s+(\d+)\b/i.exec(part);
  if (ref && m) return `Part ${m[1]}, ${ref}`;
  if (ref && part) return `${part.replace(/^Introductory\s+/i, '')}, ${ref}`;
  if (ref) return ref;
  return c.unitTitle || null;
}

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
 * The lead cover's line: { prefix, text }. "For you:" only when the reason comes from the student's own history; book order
 * reads "Start here: first in the syllabus" (A2 4.6; never an unearned "For you").
 */
export function leadLine(c = {}, { history = true } = {}) {
  if (!c.forYou) return null;
  const reason = String(c.reason || '').trim();
  if (!history || BOOK_ORDER.test(reason) || !reason) return { prefix: 'Start here:', text: 'first in the syllabus' };
  return { prefix: 'For you:', text: lowerFirst(reason) };
}

/**
 * Another cover's one line: resume, else old mistakes, else the state label, else "New to you". Due counts never show (a feed
 * serves no due card). Null when the student has no history in the subject (every line would say "New to you").
 */
export function studentLineOf(c = {}, { history = true } = {}) {
  if (!history) return null;
  if (c.resume && c.resume.of) return `You stopped at ${c.resume.done} of ${c.resume.of}`;
  const raw = String(c.studentLine || '').trim();
  const parts = raw.split(/,\s*/).filter((p) => p && !/^\d[\d,]*\s+due$/i.test(p));
  const line = parts.join(', ').replace(/^(\d[\d,]*\s+old mistakes?)$/i, '$1 to fix');
  if (line) return line;
  if (c.mistakes > 0) return `${plural(c.mistakes, 'old mistake')} to fix`;
  if (c.state?.label && c.state.key !== 'none' && c.state.label !== 'Not started') return c.state.label;
  return 'New to you';
}

/** The counts for the picked length (falls back to 10). */
export const countsOf = (c = {}, minutes = 10) => c.counts?.[minutes] || c.counts?.[10] || { cards: 0, questions: 0, minutes };

/**
 * The mix line: "16 Key cards, 5 questions", "36 Key cards", "8 questions", "16 Key cards, all it has today", or on resume
 * "About 4 minutes left". Free never gets "all it has today" (its five open cards are Free's rule, not the chapter's size).
 */
export function mixLineOf(c = {}, minutes = 10, { free = false } = {}) {
  if (c.resume && c.resume.of) return `About ${minutesText(Math.max(1, Math.round(c.resume.minutesLeft || 1)))} left`;
  const n = countsOf(c, minutes);
  const parts = [n.cards ? plural(n.cards, 'Key card') : null, n.questions ? plural(n.questions, 'question') : null].filter(Boolean);
  if (!parts.length) return '';
  const short = !free && !n.capped && Number(n.minutes) < Number(minutes);
  return `${parts.join(', ')}${short ? ', all it has today' : ''}`;
}

/** The key's words: "Play 10 minutes", "Pick up, 4 minutes", or at Free's daily limit "Questions on this chapter". */
export function keyLabelOf(c = {}, minutes = 10, { freeDone = false } = {}) {
  if (freeDone) return 'Questions on this chapter';
  if (c.resume && c.resume.of) return `Pick up, ${minutesText(Math.max(1, Math.round(c.resume.minutesLeft || 1)))}`;
  return `Play ${minutesText(countsOf(c, minutes).minutes || minutes)}`;
}

/** The hook's size tier by length (A2 4.3): up to 24, 48, 80, 105 characters, then longer (five lines at 15 px). */
export function hookTier(text = '') {
  const n = String(text || '').length;
  return n <= 24 ? 's' : n <= 48 ? 'm' : n <= 80 ? 'l' : n <= 105 ? 'xl' : 'xxl';
}

/**
 * What the cover's media shows: { kind: 'card', text } (the feed's opening card), { kind: 'locked', label } (a card Free cannot
 * open: its kind and "Pro card", never null), or { kind: 'questions', text, note } for a chapter with no cards.
 */
export function mediaOf(c = {}, minutes = 10) {
  const h = c.hook;
  if (h && h.front) return { kind: 'card', text: String(h.front) };
  if (h && h.locked) return { kind: 'locked', label: kindLabel(h.kind) };
  const q = countsOf(c, minutes).questions || countsOf(c, 10).questions || 0;
  return { kind: 'questions', text: q ? plural(q, 'question') : 'Questions', note: 'No Key cards here yet.' };
}

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
