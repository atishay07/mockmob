// "From your record" lines under a Mistake Repair. PURE, free, no model: every line is a finished
// sentence built from the student's stored records (spec tmp/repair-v3/SPEC.md A.6), so the website and
// the app say exactly the same thing. A line appears only when its gate passes; there is never a
// placeholder, and no line names a cause ("you rushed" is never written).
import { normalizeOptionComparable } from './option_compare.js';
import { plainOptionTexts } from './option_text.js';
import { MIN_CHAPTER_SAMPLE } from './prepos_insights.js';
import { correctIndex } from './recovery.js';
import {
  buildLedger, recordFor, paperFor, paperDwell, answerChangesByQuestion, istDayMonth, formatSeconds,
  UNMAPPED_CHAPTER, MIN_TIMED_MS, when, chapterOf,
} from './attempt_ledger.js';

const LETTERS = 'ABCDEFGH';
const letter = (i) => LETTERS[i] || String(i + 1);

// Record-line gates, in one place for tests and docs.
export const INSIGHT_RULES = Object.freeze({
  minTimedMs: MIN_TIMED_MS, // this question, and each question counted toward the median
  minTimedQuestions: 10, // questions in the paper with a dwell of 2 s or more
  minChapterAnswered: MIN_CHAPTER_SAMPLE, // 4
  minChapterPapers: 2,
});

export const INSIGHT_COPY = Object.freeze({
  changedFromKey: (first, final) => `Your first answer here was ${first}, the key. You changed it to ${final}.`,
  changed: (first, final) => `You first chose ${first} here, then changed to ${final}.`,
  time: (spent, median, timed) => `${spent} on this question. Your median in this paper was ${median} over ${timed} timed questions.`,
  repeatSame: (where, date) => `You chose the same option when you missed this in ${where} on ${date}.`,
  chapter: (chapter, right, answered, papers) => `${chapter} so far: ${right} right of ${answered} answered across ${papers} papers, this one included.`,
});

const median = (values) => {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
};

const optionText = (q, i) => {
  const texts = plainOptionTexts(q?.options);
  const raw = texts[i];
  return typeof raw === 'string' ? raw : raw == null ? '' : String(raw?.text ?? raw);
};

/** The newest earlier miss of this question (completed before this attempt) where the same option text was chosen. */
function repeatSameLine(attempt, allAttempts, missedBefore, qid, q, givenIndex) {
  const cur = when(attempt);
  const entries = (Array.isArray(missedBefore?.[qid]) ? missedBefore[qid] : [])
    .filter((m) => m && typeof m.attemptId === 'string' && Number.isFinite(Number(m.completedAt)) && Number(m.completedAt) < cur)
    .sort((a, b) => Number(b.completedAt) - Number(a.completedAt));
  const newest = entries[0];
  if (!newest) return null;
  const earlier = (allAttempts || []).find((a) => a && a.id === newest.attemptId);
  const detail = (earlier?.details || []).find((d) => d.qid === qid);
  if (!earlier || !Number.isInteger(detail?.givenIndex)) return null;
  const earlierQ = (earlier.questionsSnapshot || []).find((x) => x.id === qid);
  const before = normalizeOptionComparable(optionText(earlierQ, detail.givenIndex));
  const now = normalizeOptionComparable(optionText(q, givenIndex));
  if (!before || before !== now) return null;
  const source = String(newest.source || '').trim();
  const where = /^Mock \d+$/.test(source) ? source : 'a practice set';
  return INSIGHT_COPY.repeatSame(where, istDayMonth(Number(newest.completedAt)));
}

/**
 * For every answer with isCorrect === false: { lines: [{ kind, text }], evidence }.
 * `ledger` is the shared attempt ledger (built here when not passed), so the chapter line agrees with
 * the SWOT. `missedBefore` is the route's map of earlier wrong answers to the same question.
 */
export function buildMistakeInsights({ attempt, allAttempts = [], ledger = null, missedBefore = {}, answerReviews = {} } = {}) {
  if (!attempt) return {};
  const book = ledger || buildLedger(attempt, allAttempts, { answerReviews });
  const snapshot = new Map((attempt.questionsSnapshot || []).map((q) => [q.id, q]));
  const changes = answerChangesByQuestion(attempt);
  const dwell = paperDwell(attempt);
  const timedSeconds = [];
  if (dwell) for (const ms of dwell.values()) if (ms >= INSIGHT_RULES.minTimedMs) timedSeconds.push(Math.round(ms / 1000));
  const timedEnough = timedSeconds.length >= INSIGHT_RULES.minTimedQuestions;
  const medianSeconds = timedEnough ? Math.round(median(timedSeconds)) : null;

  const out = {};
  for (const d of attempt.details || []) {
    if (d?.isCorrect !== false) continue;
    const q = snapshot.get(d.qid);
    const given = Number.isInteger(d.givenIndex) ? d.givenIndex : null;
    const k = q ? correctIndex(q) : -1;
    const key = Number.isInteger(k) && k >= 0 ? k : null;
    const lines = [];
    const evidence = { firstIndex: null, finalIndex: given, seconds: null, medianSeconds: null, timed: null, chapter: null };

    // 1. An answer change: the first pick is the `before` of the first change entry.
    const first = changes.get(d.qid)?.[0];
    if (first && Number.isInteger(first.before) && given !== null) {
      evidence.firstIndex = first.before;
      if (first.before !== given) {
        lines.push({ kind: 'change', text: key !== null && first.before === key
          ? INSIGHT_COPY.changedFromKey(letter(first.before), letter(given))
          : INSIGHT_COPY.changed(letter(first.before), letter(given)) });
      }
    }

    // 2. Time on this question against the paper's median.
    const ms = dwell?.get(d.qid);
    if (Number.isFinite(ms)) evidence.seconds = Math.round(ms / 1000);
    if (timedEnough) { evidence.medianSeconds = medianSeconds; evidence.timed = timedSeconds.length; }
    if (timedEnough && Number.isFinite(ms) && ms >= INSIGHT_RULES.minTimedMs) {
      lines.push({ kind: 'time', text: INSIGHT_COPY.time(formatSeconds(ms / 1000), formatSeconds(medianSeconds), timedSeconds.length) });
    }

    // 3. The same option chosen when this question was missed before.
    if (q && given !== null) {
      const text = repeatSameLine(attempt, allAttempts, missedBefore, d.qid, q, given);
      if (text) lines.push({ kind: 'repeat_same', text });
    }

    // 4. The chapter record (ledger L), only when this paper counts in it.
    const chapter = chapterOf(q);
    if (chapter !== UNMAPPED_CHAPTER) {
      const rec = recordFor(book, chapter);
      evidence.chapter = { right: rec.right, answered: rec.answered, papers: rec.papers };
      const inPaper = paperFor(book, chapter).answered > 0;
      if (inPaper && rec.answered >= INSIGHT_RULES.minChapterAnswered && rec.papers >= INSIGHT_RULES.minChapterPapers) {
        lines.push({ kind: 'chapter', text: INSIGHT_COPY.chapter(chapter, rec.right, rec.answered, rec.papers) });
      }
    }

    // A question under re-check or corrected is left out of every read: its stored key may be the old one, so a line
    // such as "Your first answer here was D, the key" could be false. It keeps its evidence and shows no line.
    out[d.qid] = { lines: book.excluded?.has(d.qid) ? [] : lines, evidence };
  }
  return out;
}
