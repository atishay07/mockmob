// Learn v2: the three suggestions on Learn home (DESIGN-SPEC.md A7, B section 3.1 "States"). PURE.
// Always exactly three, of three different kinds, each with one line of evidence and an action that starts at once
// (a run, or a place to go). Never a recap of a chapter the student has not studied.
//
// Kinds: pickup (an unfinished run), due (due cards in a chapter), fix (open mistakes), next (next chapter in book order),
// start (a new student's first chapter), level (Find your level), recap (a studied chapter's Must-know lines), search.
import { LEARN_RULES } from './compose.js';

export const SUGGESTION_KINDS = Object.freeze(['pickup', 'due', 'fix', 'next', 'start', 'level', 'recap', 'search']);

const plural = (n, one, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;
const minutesWord = (n) => plural(n, 'minute');
const runnable = (c) => (c.cards || 0) > 0 || (c.questions || 0) > 0;

/** Minutes a cards-only run needs for `n` cards (15 s each, with the 10 percent), at least 1. */
export const cardRunMinutes = (n) => Math.max(1, Math.ceil((n * LEARN_RULES.cardSeconds * LEARN_RULES.feedback) / 60));
/** The smallest standard length whose mix retries all `n` open mistakes when Questions is left out. */
export const fixMinutes = (n) => (n <= 2 ? 5 : n <= 4 ? 10 : 20);
/** A recap of `n` Must-know cards: 10 s each with the 10 percent, rounded up. */
export const recapMinutes = (n) => Math.max(1, Math.ceil((n * LEARN_RULES.recapSeconds * LEARN_RULES.feedback) / 60));

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
 *   chapters    rows in book order: { key, title, chapterNo, book, cards, mustKnow, due, mistakes, questions, studied,
 *               mistakeWhere?, mistakeWhen? }
 *   run         null | { id, chapterKey, title, done, of, minutesLeft, kind, minutes, leaveOut }
 *   level       { questions } questions in the student's first chapters (Find your level)
 *   minutes     the student's usual length (default 10)
 *   isPro
 * Returns [Suggestion x3]: { kind, title, headline, chapterTitle, evidence, chapterKey, action: { label, run?, href?, go? } }.
 * `title` is the whole line ("3 cards due in Accounting Ratios"); `headline` and `chapterTitle` are its two parts, for a
 * card that sets the chapter on its own line (B 3.1: "3 cards due" / "Accounting Ratios").
 */
export function suggestions({ subject, isNew = false, chapters = [], run = null, level = { questions: 0 }, minutes = 10 } = {}) {
  const name = subject?.name || 'this subject';
  const rows = (chapters || []).filter(runnable);
  const out = [];
  const used = new Set();
  const usedChapters = new Set();
  const add = (s) => {
    if (!s || used.has(s.kind) || out.length >= 3) return;
    used.add(s.kind);
    if (s.chapterKey) usedChapters.add(s.chapterKey);
    out.push(s);
  };
  const mixRun = (c, m = minutes, leaveOut = []) => ({ chapterKey: c.key, minutes: m, leaveOut, kind: 'mix' });
  const prefer = (list, score) => [...list].sort((a, b) => score(b) - score(a)
    || (usedChapters.has(a.key) ? 1 : 0) - (usedChapters.has(b.key) ? 1 : 0))[0] || null;

  const make = {
    pickup() {
      if (!run || !(run.of > run.done)) return null;
      const left = Math.max(1, run.minutesLeft || 1);
      return {
        kind: 'pickup', chapterKey: run.chapterKey, title: `Pick up ${run.title}`, headline: 'Pick up', chapterTitle: run.title,
        evidence: `You stopped at ${run.done} of ${run.of}. About ${minutesWord(left)} left.`,
        action: { label: `Pick up, ${minutesWord(left)}`, run: { chapterKey: run.chapterKey, minutes: left, leaveOut: run.leaveOut || [], kind: run.kind || 'mix', resume: run.id } },
      };
    },
    due() {
      const c = prefer(rows.filter((r) => r.due > 0), (r) => r.due);
      if (!c) return null;
      const m = cardRunMinutes(c.due);
      return {
        kind: 'due', chapterKey: c.key, title: `${plural(c.due, 'card')} due in ${c.title}`, headline: `${plural(c.due, 'card')} due`, chapterTitle: c.title,
        evidence: `Due today, about ${minutesWord(m)}.`,
        action: { label: 'Revise these', run: { chapterKey: c.key, minutes: m, leaveOut: ['questions', 'mistakes', 'lesson'], kind: 'cards' } },
      };
    },
    fix() {
      const c = prefer(rows.filter((r) => r.mistakes > 0), (r) => r.mistakes);
      if (!c) return null;
      const m = fixMinutes(c.mistakes);
      const from = c.mistakeWhere && c.mistakeWhen ? `From ${c.mistakeWhere} on ${c.mistakeWhen}, with` : 'With';
      return {
        kind: 'fix', chapterKey: c.key, title: `${plural(c.mistakes, 'open mistake')} in ${c.title}`, headline: plural(c.mistakes, 'open mistake'), chapterTitle: c.title,
        evidence: `${from} the lines you needed.`,
        action: { label: `Fix them, ${minutesWord(m)}`, run: mixRun(c, m, ['questions', 'lesson']) },
      };
    },
    next() {
      // The first chapter not studied yet after the last studied one, in book order; else the first not studied.
      let last = -1;
      rows.forEach((r, i) => { if (r.studied) last = i; });
      const after = rows.slice(last + 1).find((r) => !r.studied && !usedChapters.has(r.key)) || rows.find((r) => !r.studied && !usedChapters.has(r.key));
      if (!after) return null;
      const where = after.chapterNo ? `Chapter ${after.chapterNo} of ${after.book || name}. ` : '';
      return {
        kind: 'next', chapterKey: after.key, title: `Next in the book: ${after.title}`, headline: 'Next in the book', chapterTitle: after.title,
        evidence: `${where}${minutes} minutes of its ${contents(after)}.`,
        action: { label: `Start ${minutesWord(minutes)}`, run: mixRun(after) },
      };
    },
    start() {
      const c = rows.find((r) => r.cards > 0) || rows[0];
      if (!c) return null;
      return {
        kind: 'start', chapterKey: c.key, title: `Start with ${c.title}`, headline: 'Start with', chapterTitle: c.title,
        evidence: [bookLine(c, name), `${minutes} minutes of its ${contents(c)}.`].filter(Boolean).join(' '),
        action: { label: `Start ${minutesWord(minutes)}`, run: mixRun(c) },
      };
    },
    level() {
      const n = Math.min(LEARN_RULES.levelQuestions, level?.questions || 0);
      if (n < 1) return null;
      const first = rows.find((r) => r.questions > 0);
      return {
        kind: 'level', chapterKey: first?.key || null, title: 'Find your level', headline: 'Find your level', chapterTitle: null,
        evidence: `${plural(n, 'question')} from your first chapters, about ${minutesWord(n)}.`,
        action: { label: `Start ${minutesWord(n)}`, run: { chapterKey: first?.key || null, minutes: n, leaveOut: [], kind: 'level' } },
      };
    },
    recap() {
      const c = prefer(rows.filter((r) => r.studied && r.mustKnow > 0), (r) => (r.lastActivityAt || 0));
      if (!c) return null;
      const m = recapMinutes(c.mustKnow);
      return {
        kind: 'recap', chapterKey: c.key, title: `Quick recap: ${c.title}`, headline: 'Quick recap', chapterTitle: c.title,
        evidence: `Its ${plural(c.mustKnow, 'Must-know line')}, about ${minutesWord(m)}.`,
        action: { label: 'Start the recap', run: { chapterKey: c.key, minutes: m, leaveOut: [], kind: 'recap' } },
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
    ? ['start', 'level', 'search', 'next']
    : ['pickup', 'next', 'due', 'fix', 'recap', 'level', 'search'];
  if (!isNew) {
    // Returning: 1 = an unfinished run, else the next chapter; 2 = due cards; 3 = open mistakes, else the next chapter.
    add(make.pickup() || make.next());
    add(make.due());
    add(make.fix());
  }
  for (const kind of order) add(make[kind]());
  // Last resort for a one-chapter subject with nothing else to offer: a shorter start of its first chapter.
  if (out.length < 3 && rows.length) {
    const c = rows[0];
    if (!used.has('next')) add({ kind: 'next', chapterKey: c.key, title: `A short start: ${c.title}`, headline: 'A short start', chapterTitle: c.title, evidence: `5 minutes of its ${contents(c)}.`, action: { label: 'Start 5 minutes', run: mixRun(c, 5) } });
    if (!used.has('start')) add({ kind: 'start', chapterKey: c.key, title: `Start with ${c.title}`, headline: 'Start with', chapterTitle: c.title, evidence: `${minutes} minutes of its ${contents(c)}.`, action: { label: `Start ${minutesWord(minutes)}`, run: mixRun(c) } });
  }
  return out.slice(0, 3);
}

// ---------------------------------------------------------------- the session end's next options (B 3.6)

/**
 * The end screen's lead and three options. input:
 *   subject       the subject id (the full mock's link)
 *   chapter       { key, title }   minutes   the run's length
 *   missed        cards rated Missed in the run       fresh   new cards left in the chapter
 *   next          null | { key, title } next chapter in book order
 *   mistakeElsewhere null | { key, title, count }      due   { count } Key cards due in the subject
 *   mustKnow      the chapter's Must-know count (Quick recap)
 */
export function endOptions({ subject = null, chapter, minutes = 10, missed = 0, fresh = 0, next = null, mistakeElsewhere = null, due = { count: 0 }, mustKnow = 0 }) {
  const here = {
    label: 'Another 5 minutes here',
    evidence: [missed ? plural(missed, 'missed card') : null, fresh ? `${fresh} new ${fresh === 1 ? 'one' : 'ones'}` : null].filter(Boolean).join(', ') || `More of ${chapter.title}.`,
    run: { chapterKey: chapter.key, minutes: 5, leaveOut: [], kind: 'mix' },
  };
  const nextOpt = next ? {
    label: `Next: ${next.title}, ${minutesWord(minutes)}`,
    evidence: 'The next chapter in your book.',
    run: { chapterKey: next.key, minutes, leaveOut: [], kind: 'mix' },
  } : null;
  let lead;
  let second;
  if (missed >= 3 || !nextOpt) { lead = here; second = nextOpt; } else { lead = nextOpt; second = here; }
  let third = null;
  if (mistakeElsewhere?.count) {
    const m = fixMinutes(mistakeElsewhere.count);
    third = {
      label: mistakeElsewhere.count === 1 ? 'Fix your last open mistake' : `Fix ${mistakeElsewhere.count} open mistakes`,
      evidence: `${mistakeElsewhere.title}, ${m} min`,
      run: { chapterKey: mistakeElsewhere.key, minutes: m, leaveOut: ['questions', 'lesson'], kind: 'mix' },
    };
  } else if (due?.count) {
    const m = cardRunMinutes(due.count);
    third = { label: `Revise ${plural(due.count, 'due card')}, ${m} min`, evidence: 'Key cards due today across your chapters.', href: '/review/revise?source=keycards', go: 'revise' };
  } else if (mustKnow > 0) {
    const m = recapMinutes(mustKnow);
    third = { label: `Quick recap of this chapter, ${m} min`, evidence: `Its ${plural(mustKnow, 'Must-know line')}, answers showing.`, run: { chapterKey: chapter.key, minutes: m, leaveOut: [], kind: 'recap' } };
  }
  const mock = { label: 'Test it in a full mock', evidence: 'A timed 50-question paper of the whole subject.', href: `/test?${new URLSearchParams({ subject: subject || String(chapter.key).split('.')[0], count: '50', mode: 'full' })}`, go: 'mock' };
  const options = [second, third, mock].filter(Boolean);
  if (options.length < 3 && lead !== here && !options.includes(here)) options.unshift(here);
  return { lead, options: options.slice(0, 3) };
}
