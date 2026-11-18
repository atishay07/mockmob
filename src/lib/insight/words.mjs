// Marks trend's analysis blocks (lane insight, 18 Nov 2026): Your chapters, Your pace and Where your marks go. The words a
// student reads and the small display rules, shared by the page, the preview fixtures and the tests. PURE and light enough
// for the browser: no I/O, no clock of its own. Every number here comes from the product's own constants (data/test_modes.js,
// data/result_next_move.mjs); none is typed into a sentence.
import { TEST_MODES } from '../../../data/test_modes.js';
import { NEXT_MOVE_RULES } from '../../../data/result_next_move.mjs';

const plural = (n, one, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;
const MINUS = '−';

/** "+3", "−2", "0": the page's own signs (RecordView, time_decisions). */
export const signed = (n) => (n > 0 ? `+${n}` : n < 0 ? `${MINUS}${Math.abs(n)}` : '0');

// ---------------------------------------------------------------- Your chapters

/**
 * The state of a chapter as the map says it. The states and their words are chapter state's (data/chapter_state.js
 * STATE_LABELS, the words Learn and Key cards print), except a chapter with no answer at all, which the map calls
 * "Not tried" (the brief's word: the map counts answers, not cards).
 */
export const MAP_LABELS = Object.freeze({ none: 'Not tried', thin: 'Too few answers', weak: 'Needs work', mid: 'Getting there', strong: 'Holding' });
/** The order the count line names the states in: the strongest first, untried last. */
export const STATE_ORDER = Object.freeze(['strong', 'mid', 'weak', 'thin', 'none']);

export const MAP_COPY = Object.freeze({
  title: 'Your chapters',
  sub: 'Every chapter of your subjects, in book order.',
  // chapter_state.js reasonLine's own basis: each question counts once, by its latest answer.
  basis: 'on the latest try at each question',
  practise: `Practise ${NEXT_MOVE_RULES.setSize} on this chapter`,
  keycards: 'Open Key cards',
  close: 'Close',
  lost: 'Marks lost',
  last: 'Last practised',
});

/** "8 of 15 chapters tried". */
export const triedLine = (tried, total) => `${tried} of ${total} chapters tried`;

/** "7 of 12 right": counts only, never a percentage. */
export const rightLine = (right, n) => `${right} of ${n} right`;

/** One state counted in words: "6 holding", "1 needs work", "2 need work", "1 with too few answers", "3 not tried". */
export function countWords(state, n) {
  if (state === 'strong') return `${n} holding`;
  if (state === 'mid') return `${n} getting there`;
  if (state === 'weak') return `${n} ${n === 1 ? 'needs' : 'need'} work`;
  if (state === 'thin') return `${n} with too few answers`;
  if (state === 'none') return `${n} not tried`;
  return null;
}

/** The line under a subject's grid: only the states that are there, strongest first. Null when nothing is counted. */
export function countLine(counts = {}) {
  const parts = STATE_ORDER.filter((s) => Number(counts[s]) > 0).map((s) => countWords(s, Number(counts[s])));
  return parts.length ? parts.join(', ') : null;
}

/** "Marks lost" in a chapter: "24 marks in 3 papers", "None in 2 papers". Null when no paper asked the chapter. */
export function lostLine(lost, papers) {
  if (!(Number(papers) > 0)) return null;
  return `${Number(lost) > 0 ? plural(Number(lost), 'mark') : 'None'} in ${plural(Number(papers), 'paper')}`;
}

/**
 * Practice with the chapter and the set chosen: the very link Your papers' chapter row opens (ReviewChapters.jsx: subject,
 * mode, count, chapter, in that order), the chapter by the name its questions carry.
 */
export function practiseHref(subject, chapterName) {
  return `/dashboard?${new URLSearchParams({ subject: String(subject || ''), mode: 'quick', count: String(NEXT_MOVE_RULES.setSize), chapter: String(chapterName || '') })}`;
}

/** "16 Nov": a date with no clock, as the page's other dates (TrendScrub, the record's range line). */
export function dayLabel(at) {
  const t = typeof at === 'number' ? at : Date.parse(at);
  if (!Number.isFinite(t)) return null;
  return new Date(t).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
}

/**
 * The words a tile is read out with: the name it shows, the book's full name when that differs, then its state
 * ("Goodwill Valuation, Goodwill: Nature and Valuation. Getting there"). The visible name always leads (label in name).
 */
export function tileName(chapter) {
  const name = String(chapter?.name || chapter?.title || '');
  const title = String(chapter?.title || '');
  return `${name}${title && title !== name ? `, ${title}` : ''}. ${chapter?.label || ''}`.trim();
}

/** The book's way of printing a title ("Retirement/Death of a Partner" is "Retirement and Death of a Partner"), as Today's. */
export const bookTitle = (title) => String(title || '').replace(/\s*\/\s*/g, ' and ').replace(/\s+/g, ' ').trim();

/** True when no chapter of any subject has an answer: the map then draws each subject's head only (a quiet line each). */
export const mapIsEmpty = (map) => !map?.subjects?.some((s) => s.tried > 0);

// ---------------------------------------------------------------- Your pace

/** CUET's own time a question: NTA mode is the CUET simulation (60 minutes for 50 questions, data/test_modes.js). */
export const CUET_PACE_SEC = Math.round(TEST_MODES.nta.fixedDurationSec / TEST_MODES.nta.fixedCount);

/** Seconds as a clock: 58 -> "0:58", 72 -> "1:12", 125 -> "2:05". */
export function clock(seconds) {
  const s = Math.max(0, Math.round(Number(seconds) || 0));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

/** A paper's median against CUET's pace, in words. The same whole second is "on pace". */
export function paceWord(medianSec, paceSec = CUET_PACE_SEC) {
  const m = Math.round(medianSec);
  const p = Math.round(paceSec);
  return m < p ? 'under pace' : m > p ? 'over pace' : 'on pace';
}

export const PACE_COPY = Object.freeze({
  title: 'Your pace',
  sub: (paceSec = CUET_PACE_SEC) => `CUET gives you ${clock(paceSec)} a question.`,
  none: 'Sit one timed mock and your pace shows here.',
  // No Pro sentence here: Free does not get this block; the record's own "Changed answers and pace" row says it is Pro's.
});

/** The scale the pace bars share: the larger of the slowest median and CUET's pace, with room past it, in whole 15 s. */
export function paceScale(rows = [], paceSec = CUET_PACE_SEC) {
  const top = Math.max(paceSec, ...rows.map((r) => Number(r.medianSec) || 0));
  return Math.ceil((top * 1.15) / 15) * 15;
}

// ---------------------------------------------------------------- Where your marks go

/** CUET's marking, as the server scores every paper (data/test_modes.js nta.marking). */
export const MARKING = TEST_MODES.nta.marking;
/** What one wrong answer and one blank cost against a right answer: 5 not earned plus the 1 penalty, and 5. */
export const LOST = Object.freeze({ wrong: MARKING.right - MARKING.wrong, blank: MARKING.right - MARKING.blank });

export const MARKS_COPY = Object.freeze({
  title: 'Where your marks go',
  sub: (papers) => `Across your ${plural(papers, 'paper')} on record.`,
  total: 'marks not earned',
  wrong: 'Wrong answers',
  blank: 'Left blank',
  wrongCount: (n) => plural(n, 'answer'),
  blankCount: (n) => plural(n, 'question'),
  marks: (n) => plural(n, 'mark'),
  // The ledger's own marking line, from the constants.
  rule: `+${MARKING.right} per right, ${signed(MARKING.wrong)} per wrong`,
  // RecordView's own words when replays exist and nothing was changed.
  noChanges: 'No changed answers recorded.',
});

/** "Changed answers: +3 marks across 7 changes", and the replayed papers when they are fewer than the papers on record. */
export function changesLine(changes, papers) {
  if (!changes || !(changes.papers > 0)) return null;
  if (!changes.count) return MARKS_COPY.noChanges;
  const head = `Changed answers: ${signed(changes.net)} ${Math.abs(changes.net) === 1 ? 'mark' : 'marks'} across ${plural(changes.count, 'change')}`;
  return changes.papers < papers ? `${head}, in ${plural(changes.papers, 'replayed session')}.` : `${head}.`;
}

/** The failed read of a block: the product's plain words (ErrorState's default title). */
export const FAILED = 'This did not load.';
export const TRY_AGAIN = 'Try again';
