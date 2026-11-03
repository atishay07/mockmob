// Pure rules of the Learn v2 chapter page (A4-chapter-run.md 3.2.1, 3.2.4 to 3.2.6, BUILD-1101 B2 and B7). No React here, so
// node --test can hold them (chapterModel.test.mjs). R3: its words come from data/learn/words.js (ruling W).
import { WORDS, chapterPlace, fixMistakes, wholeMinutes, withMinutes } from '../../../../data/learn/words.js';

const plural = (n, one, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

/** R3 ruling W: due Key cards are never a bare "46 due"; the server's "Revise first: 46 due" reads "Revise first: 46 due cards". */
export const dueWords = (text) => String(text || '').replace(/\b(\d[\d,]*) due\b(?! cards?)/g, (m, n) => `${n} due ${Number(n.replace(/,/g, '')) === 1 ? 'card' : 'cards'}`);

/** "Part 1, Partnership Accounts" reads "Part 1" beside the chapter ref ("Part 1, Ch 1"); a part without a number keeps its name. */
export const partShort = (title) => (title ? (String(title).match(/^Part \d+/)?.[0] || String(title)) : null);

/**
 * The eyebrow and the ref line (3.2.1): the unit only when it does not repeat the title's start; the ref is the chapter's place in
 * the roadmap, "Chapter 5 of 14" (R4 ruling N). The NCERT number ("Part 1, Ch 2") is never the label: three chapters share "Ch 2".
 * It stays in the payload for source lines. With no `place` from the server the page draws no ref (never "Ch N").
 */
export function headLines(chapter) {
  if (!chapter) return { eyebrow: null, ref: null };
  const unit = chapter.unitTitle && chapter.unitTitle !== chapter.title ? String(chapter.unitTitle) : null;
  const echoes = unit && String(chapter.title || '').toLowerCase().startsWith(unit.toLowerCase());
  return { eyebrow: unit && !echoes ? unit : null, ref: chapterPlace(chapter.place) || null };
}

/** A pile's minutes in words: "about 4 min"; a lesson's exact "7 min". */
export function pileMinutes(pile) {
  const m = Number(pile?.minutes) || 0;
  if (pile?.id === 'lesson') return `${Math.max(1, m)} min`;
  return m >= 1 ? `about ${m} min` : 'under a minute';
}

/**
 * How one pile is drawn (3.2.4): `state` in | left | held, the line under it, the "of 3" on the paper, its spoken label,
 * and the server's note ("Revise first: 46 due"). A held pile (Free, Key cards only today) is not a button.
 */
export function pileView(pile, { minutes = null } = {}) {
  const label = pile?.label || '';
  const state = pile?.held ? 'held' : pile?.left ? 'left' : 'in';
  if (state === 'held') return { state, line: 'Back tomorrow', of: null, note: null, aria: `${label}, back tomorrow` };
  if (state === 'left') return { state, line: 'Tap to put back', of: null, note: null, aria: `${label}, left out. Tap to put it back` };
  const of = pile?.id === 'mistakes' && Number(pile?.of) > Number(pile?.count) ? Number(pile.of) : null;
  // R4 owner-eye#9: a mistakes pile that holds fewer than the chapter has says why ("2 fit in 10 min"), so its "2 of 3" never
  // reads as a different number from the "Fix 3 open mistakes" row under it.
  const line = of && minutes ? `${Number(pile.count)} fit in ${wholeMinutes(minutes)} min` : pileMinutes(pile);
  const note = pile?.note ? dueWords(pile.note) : null;
  return { state, line, of, note, aria: `${label}: ${pile?.count}${of ? ` of ${of}` : ''}, ${line}.${note ? ` ${note}.` : ''} Tap to leave it out` };
}

/**
 * LK37: "What's in this run" has one live line over its switches: what is lined up and how long it takes, "21 steps · about 10 min".
 * It counts only piles that are in (not left out, not held back on Free), so it moves with every switch. '' while nothing is lined up.
 */
export function runSummary(data, piles = []) {
  const steps = (piles || []).filter((p) => !p.left && !p.held).reduce((n, p) => n + (Number(p.count) || 0), 0);
  const m = Math.round(Number(data?.realMinutes) || 0);
  if (!steps) return '';
  return m >= 1 ? `${plural(steps, 'step')} · about ${m} min` : plural(steps, 'step');
}

// R2 ruling 9: the first-visit line under Start is gone (the run's own first card says how it works). Kept as a name only so
// older callers and tests read that it is never shown.
export const FIRST_VISIT_LINE = 'Cards and questions, one at a time. Stop whenever you like; what you do is saved.';
export const ONLY_CARDS_LINE = "Only Key cards here for now. This chapter's questions are still being checked.";
export const ONLY_QUESTIONS_LINE = "Only questions here for now. This chapter's Key cards are not ready yet.";
export const RATINGS_USED_LINE = "You've used today's 10 free card ratings. Cards in this run show their answers but won't be added to Revise.";

/**
 * The one quiet line under the Start key, by priority (3.2.5): Free's Key-cards-only day, Free's 10-minute cap (only when more
 * was chosen), a short chapter, Free's ratings used, one kind only; else null. The old "Ratings join Revise" note and, since R2
 * ruling 9, the first-visit line are never shown.
 */
export function chapterQuietLine(data) {
  if (!data) return null;
  if (data.freeSession?.used && data.free?.text) return data.free.text;
  if (data.capped?.text) return data.capped.text;
  if (data.shrink?.text && !data.added) return dueWords(data.shrink.text);
  if (/ratings are used/i.test(String(data.free?.text || ''))) return RATINGS_USED_LINE;
  const shelf = data.shelf;
  if (shelf) {
    const cards = Number(shelf.cards?.count) || 0;
    const questions = Number(shelf.questions?.total) || 0;
    if (cards && !questions) return ONLY_CARDS_LINE;
    if (!cards && questions) return ONLY_QUESTIONS_LINE;
  }
  return null;
}

/**
 * "Everything in this chapter" (3.2.6): only rows that lead somewhere, with plain lines. What is missing is never announced
 * (R2 ruling 9: "No lesson yet. No open mistakes." is gone; `missing` stays null). Free's taste is said here only
 * ("46 cards. 5 open on Free."). `mistakeMinutes(n)` gives the minutes n mistakes take.
 */
export function shelfView(data, { mistakeMinutes = (n) => n } = {}) {
  const shelf = data?.shelf || {};
  const isPro = !shelf.print?.locked;
  const used = Boolean(data?.freeSession?.used);
  const rows = [];
  const missing = []; // what is not there; collected for reading, never drawn (R2 ruling 9)
  const cards = Number(shelf.cards?.count) || 0;
  if (cards) {
    const open = shelf.cards?.open;
    const inRevise = Number(shelf.cards?.inRevise) || 0;
    const line = !isPro && open != null && open < cards ? `${plural(cards, 'card')}. ${open} open on Free.`
      : inRevise ? `All ${cards}, ${inRevise} in Revise` : `All ${cards}, by section`;
    rows.push({ id: 'cards', title: 'Key cards', line, link: true });
  } else missing.push('Key cards are not ready yet.');
  const questions = Number(shelf.questions?.total) || 0;
  if (questions) {
    rows.push({ id: 'questions', title: 'Questions only', line: used ? `${plural(questions, 'question')}, back tomorrow` : `${plural(questions, 'question')} in this chapter`, link: !used });
  } else missing.push('Questions are still being checked.');
  if (shelf.lesson) {
    const m = Number(shelf.lesson.minutes) || null;
    rows.push({ id: 'lesson', title: shelf.lesson.title || 'Lesson', line: `${m ? withMinutes('Lesson', m) : 'Lesson'}, ${shelf.lesson.read ? 'read' : 'not read yet'}`, link: true });
  } else missing.push('No lesson yet.');
  const mistakes = Number(shelf.mistakes?.open) || 0;
  if (mistakes) {
    rows.push({ id: 'mistakes', title: 'Your mistakes', line: used ? `${plural(mistakes, 'open mistake')}, back tomorrow` : fixMistakes(mistakes, mistakeMinutes(mistakes)), link: !used });
  } else missing.push('No open mistakes.');
  const must = Number(shelf.print?.mustKnow) || 0;
  if (must) rows.push({ id: 'print', title: 'Print sheet', line: shelf.print.locked ? 'Part of Pro' : `${plural(must, 'Must-know line')}, with your name`, locked: Boolean(shelf.print.locked), link: Boolean(shelf.print.locked), action: shelf.print.locked ? null : 'print' });
  // The rows in the order a student reaches for them: cards, questions, mistakes, the lesson, the print sheet.
  const order = ['cards', 'questions', 'mistakes', 'lesson', 'print'];
  rows.sort((a, b) => order.indexOf(a.id) - order.indexOf(b.id));
  return { rows, missing: null };
}

/**
 * The chapter's verdict beside its ref (R2 ruling 2): only "Needs work", and only when the server says the chapter is weak above
 * its evidence floor (state key needs_work). Not started, Too few answers, Getting there, Holding and Fading are never shown.
 */
export const chapterVerdict = (state) => (state?.key === 'needs_work' ? (state.label || 'Needs work') : null);

/**
 * The quick recap as a quiet key: "Quick recap · 1 min" (the server's minutes). Null when the chapter has no Must-know line, and
 * (R3 X6) until the student has seen at least 1 card in this chapter: a recap of what they have not met is not a recap.
 */
export const recapLabel = (recap, { seen = true } = {}) => (recap?.count && seen ? withMinutes(WORDS.quickRecap, recap.minutes) : null);

/** Whether the student has seen at least 1 card of this chapter: the dry run's `cardsSeen`, else (an older server) "not a first visit". */
export const hasSeenCards = (data) => (!data ? false : Number.isFinite(data.cardsSeen) ? data.cardsSeen > 0 : !data.firstVisit);

/**
 * The Start key (R3 ruling W: " · N min" after a label). The server's "Start 10 minutes" becomes "Start · 10 min"; with a run to
 * continue the new-run key is "Start fresh · 10 min". Any other server label ("Start the 7-minute lesson") is kept as it is.
 */
export function startKeyLabel(serverLabel, minutes, { fresh = false } = {}) {
  const m = /^Start (\d+) minutes?$/.exec(String(serverLabel || ''));
  const n = m ? Number(m[1]) : (serverLabel ? null : minutes);
  if (n !== null) return withMinutes(fresh ? 'Start fresh' : 'Start', n);
  return fresh ? String(serverLabel).replace(/^Start /, 'Start fresh: ') : String(serverLabel);
}

/** The key that continues today's unfinished run: "Continue · 6 min" (R3 ruling W). */
export const continueLabel = (resume) => withMinutes(WORDS.continue, resume?.minutesLeft || 1);

/** The pile tip's storage key: once per student, so a new account on the same device sees it again. */
export const coachKeyFor = (userId) => `mm:learn2:coach:piles:${userId || 'anon'}`;

/** The title's size step by length, so a long title keeps to 2 lines at 390 (R2 ruling 9: 32 px, at most 2 lines). */
export const titleSize = (title) => { const n = String(title || '').length; return n <= 24 ? 'm' : n <= 40 ? 'l' : 'xl'; };

/**
 * "First up" (R2 ruling 9): up to 3 real card fronts from the dry run's `firstUp`, cleaned; [] when there is nothing to show
 * (the cards pile left out, or none open), so the row is not drawn.
 */
export function firstUpCards(data) {
  const list = Array.isArray(data?.firstUp) ? data.firstUp : [];
  return list.filter((c) => c && String(c.front || '').trim()).slice(0, 3).map((c) => ({ id: c.id, front: String(c.front).trim(), mustKnow: Boolean(c.mustKnow) }));
}

/** A start or dry run that failed because the chapter is not in the book list (404 CHAPTER_NOT_FOUND). */
export const isChapterMissing = (error) => Boolean(error) && (error.kind === 'chapter_not_found' || error.code === 'CHAPTER_NOT_FOUND' || (error.status === 404 && error.code !== 'LEARN_OFF'));

/** A link with one more query flag (`fresh=1`, `next=1`) that the run page reads; null leaves the href as it is. */
export function withFlag(href, key, value) {
  if (!href || value === null || value === undefined || value === '' || value === false) return href;
  const [path, hash = ''] = String(href).split('#');
  const sep = path.includes('?') ? '&' : '?';
  return `${path}${sep}${encodeURIComponent(key)}=${encodeURIComponent(String(value))}${hash ? `#${hash}` : ''}`;
}
