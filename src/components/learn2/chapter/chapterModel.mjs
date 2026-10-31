// Pure rules of the Learn v2 chapter page (A4-chapter-run.md 3.2.1, 3.2.4 to 3.2.6, BUILD-1101 B2 and B7). No React here, so
// node --test can hold them (chapterModel.test.mjs).

const plural = (n, one, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

/** "Part 1, Partnership Accounts" reads "Part 1" beside the chapter ref ("Part 1, Ch 1"); a part without a number keeps its name. */
export const partShort = (title) => (title ? (String(title).match(/^Part \d+/)?.[0] || String(title)) : null);

/**
 * The eyebrow and the ref line (3.2.1): the unit only when it does not repeat the title's start; the ref "Part 1, Ch 1".
 */
export function headLines(chapter) {
  if (!chapter) return { eyebrow: null, ref: null };
  const unit = chapter.unitTitle && chapter.unitTitle !== chapter.title ? String(chapter.unitTitle) : null;
  const echoes = unit && String(chapter.title || '').toLowerCase().startsWith(unit.toLowerCase());
  const ref = [partShort(chapter.partTitle), chapter.ref].filter(Boolean).join(', ') || null;
  return { eyebrow: unit && !echoes ? unit : null, ref };
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
export function pileView(pile) {
  const label = pile?.label || '';
  const state = pile?.held ? 'held' : pile?.left ? 'left' : 'in';
  if (state === 'held') return { state, line: 'Back tomorrow', of: null, note: null, aria: `${label}, back tomorrow` };
  if (state === 'left') return { state, line: 'Tap to put back', of: null, note: null, aria: `${label}, left out. Tap to put it back` };
  const line = pileMinutes(pile);
  const of = pile?.id === 'mistakes' && Number(pile?.of) > Number(pile?.count) ? Number(pile.of) : null;
  const note = pile?.note || null;
  return { state, line, of, note, aria: `${label}: ${pile?.count}${of ? ` of ${of}` : ''}, ${line}.${note ? ` ${note}.` : ''} Tap to leave it out` };
}

export const FIRST_VISIT_LINE = 'Cards and questions, one at a time. Stop whenever you like; what you do is saved.';
export const ONLY_CARDS_LINE = "Only Key cards here for now. This chapter's questions are still being checked.";
export const ONLY_QUESTIONS_LINE = "Only questions here for now. This chapter's Key cards are not ready yet.";
export const RATINGS_USED_LINE = "You've used today's 10 free card ratings. Cards in this run show their answers but won't be added to Revise.";
const OLD_NOTE_FIRST = 'Ratings join Revise, so cards come back when they are due.';

/**
 * The one quiet line under the Start key, by priority (3.2.5): Free's Key-cards-only day, Free's 10-minute cap (only when more
 * was chosen), a short chapter, Free's ratings used, one kind only, a first visit; else null. The old "Ratings join Revise"
 * note is never shown.
 */
export function chapterQuietLine(data) {
  if (!data) return null;
  if (data.freeSession?.used && data.free?.text) return data.free.text;
  if (data.capped?.text) return data.capped.text;
  if (data.shrink?.text && !data.added) return data.shrink.text;
  if (/ratings are used/i.test(String(data.free?.text || ''))) return RATINGS_USED_LINE;
  const shelf = data.shelf;
  if (shelf) {
    const cards = Number(shelf.cards?.count) || 0;
    const questions = Number(shelf.questions?.total) || 0;
    if (cards && !questions) return ONLY_CARDS_LINE;
    if (!cards && questions) return ONLY_QUESTIONS_LINE;
  }
  if (data.firstVisit === true || (data.firstVisit === undefined && data.note === OLD_NOTE_FIRST)) return FIRST_VISIT_LINE;
  return null;
}

/**
 * "Everything in this chapter" (3.2.6): only rows that lead somewhere, with plain lines; what is missing becomes one quiet
 * line. Free's taste is said here only ("Free opens 5"). `mistakeMinutes(n)` gives the minutes n mistakes take.
 */
export function shelfView(data, { mistakeMinutes = (n) => n } = {}) {
  const shelf = data?.shelf || {};
  const isPro = !shelf.print?.locked;
  const used = Boolean(data?.freeSession?.used);
  const rows = [];
  const missing = [];
  const cards = Number(shelf.cards?.count) || 0;
  if (cards) {
    const open = shelf.cards?.open;
    const inRevise = Number(shelf.cards?.inRevise) || 0;
    const line = !isPro && open != null && open < cards ? `${plural(cards, 'card')}, Free opens ${open}`
      : inRevise ? `All ${cards}, ${inRevise} in Revise` : `All ${cards}, by section`;
    rows.push({ id: 'cards', title: 'Key cards', line, link: true });
  } else missing.push('Key cards are not ready yet.');
  const questions = Number(shelf.questions?.total) || 0;
  if (questions) {
    rows.push({ id: 'questions', title: 'Questions only', line: used ? `${plural(questions, 'question')}, back tomorrow` : `${plural(questions, 'question')} in this chapter`, link: !used });
  } else missing.push('Questions are still being checked.');
  if (shelf.lesson) {
    const m = Number(shelf.lesson.minutes) || null;
    rows.push({ id: 'lesson', title: shelf.lesson.title || 'Lesson', line: `${m ? `${m}-minute lesson` : 'Lesson'}, ${shelf.lesson.read ? 'read' : 'not read yet'}`, link: true });
  } else missing.push('No lesson yet.');
  const mistakes = Number(shelf.mistakes?.open) || 0;
  if (mistakes) {
    rows.push({ id: 'mistakes', title: 'Your mistakes', line: used ? `${mistakes} open, back tomorrow` : `${mistakes} open. Fix them in about ${Math.max(1, mistakeMinutes(mistakes))} min`, link: !used });
  } else missing.push('No open mistakes.');
  const must = Number(shelf.print?.mustKnow) || 0;
  if (must) rows.push({ id: 'print', title: 'Print sheet', line: shelf.print.locked ? 'Part of Pro' : `${plural(must, 'Must-know line')}, with your name`, locked: Boolean(shelf.print.locked), link: Boolean(shelf.print.locked), action: shelf.print.locked ? null : 'print' });
  // The rows in the order a student reaches for them: cards, questions, mistakes, the lesson, the print sheet.
  const order = ['cards', 'questions', 'mistakes', 'lesson', 'print'];
  rows.sort((a, b) => order.indexOf(a.id) - order.indexOf(b.id));
  return { rows, missing: missing.length ? missing.join(' ') : null };
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
