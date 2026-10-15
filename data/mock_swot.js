// The post-mock SWOT and "Do these next" plan. PURE, deterministic, free: no model and no credit
// (spec tmp/repair-v3/SPEC.md B.1 to B.4). Every string is a finished sentence built from stored
// records, every count carries its denominator, and nothing is a forecast or a cause.
import { wilson } from './prepos_insights.js';
import { attemptScoring } from './attempt_scoring.js';
import { getCanonicalChapters, isValidTopSyllabusPair } from './canonical_syllabus.js';
import { getSubjectById } from './subjects.js';
import { TEST_MODES } from './test_modes.js';
import { paperTrace } from './paper_trace.js';
import { GAP } from './session_recovery.js';
import {
  buildLedger, comparableMocks, chapterCounts, paperRows, recordFor, earlierFor, paperFor,
  paperDwell, telemetryRecorded, openedQuestions, answerChangesByQuestion, istDayMonth, plural, questionList,
  isMock, modeOf, when, UNMAPPED_CHAPTER,
} from './attempt_ledger.js';
import { buildMistakeInsights } from './mistake_insights.js';
import { buildMistakeLab } from './mistake_lab.js';
import { buildLabLoop } from './lab_loop.js';

export const SWOT_VERSION = 1;

// Every threshold of the SWOT, in one frozen place for tests and docs.
export const SWOT_RULES = Object.freeze({
  minAnswered: 10,
  caps: Object.freeze({ strength: 2, weakness: 3, opportunity: 2, threat: 2 }),
  chapterPrecedence: Object.freeze(['repeat_loss', 'weak_chapter', 'chapter_slipped', 'weak_chapter_paper', 'close_chapter', 'strong_chapter']),
  strongChapter: Object.freeze({ recordAnswered: 8, recordPapers: 2, recordLowAtLeast: 65, paperN: 2, paperWrongAtMost: 1 }),
  accurate: Object.freeze({ answered: 20, ratio: 0.8 }),
  changesHelped: Object.freeze({ changes: 2, net: 5 }),
  weakChapter: Object.freeze({ recordAnswered: 6, recordPapers: 2, recordHighBelow: 65, paperLost: 6 }),
  weakChapterPaper: Object.freeze({ paperN: 3, ratioAtMost: 0.4, paperLost: 11 }),
  changesHurt: Object.freeze({ rightToWrong: 2 }),
  quickWrong: Object.freeze({ timedWrong: 4, underMs: 20000, ratio: 0.5 }),
  closeChapter: Object.freeze({ recordAnswered: 8, recordPapers: 2, pctFrom: 50, pctBelow: 75, paperLost: 5 }),
  blanks: Object.freeze({ blanks: 3 }),
  untried: Object.freeze({ earlierPapers: 3, chapters: 3, named: 3 }),
  repeatLoss: Object.freeze({ mocks: 3, lostEach: 6 }),
  chapterSlipped: Object.freeze({ earlierAnswered: 8, earlierPapers: 2, earlierLowAtLeast: 60, paperAnswered: 3, paperWrong: 2, drop: 30 }),
  notOpened: Object.freeze({ unopened: 3 }),
  // Marked for review (recovery.marks, kept since the capture of 15 Oct): a paper is read from 3 marked questions.
  // The item sits where its own numbers put it: any marked blank is an opportunity; with none blank, 3 or more
  // answered and two thirds right is a strength, and 3 or more wrong and more wrong than right a weakness.
  markedReview: Object.freeze({ marked: 3, strengthShare: 2 / 3, weaknessWrong: 3 }),
  repeatMisses: Object.freeze({ questions: 2 }),
  plan: Object.freeze({ max: 3, chapterCount: 10, timedCount: 20, mixedCount: 10 }),
  later: Object.freeze({ minQuestions: 5 }),
  // Items about this paper's behaviour that the Mistake Lab's ledger already shows, by the ledger group that shows
  // them (data/mistake_lab.js). With the ledger on the page they leave the quadrants; "Do these next" is unchanged.
  ledgerCovers: Object.freeze({
    changes_hurt: Object.freeze(['changed_from_right']),
    not_opened: Object.freeze(['never_opened']),
    quick_wrong: Object.freeze(['quick_wrong']),
    blanks: Object.freeze(['never_opened', 'other_blank', 'blank']),
  }),
});

// Items that compare with earlier papers. None is shown on a first paper in the subject.
const HISTORY_KINDS = new Set(['repeat_loss', 'repeat_misses', 'chapter_slipped', 'weak_chapter', 'close_chapter', 'strong_chapter', 'untried']);

const QUADRANTS = Object.freeze([
  { id: 'strength', label: 'Strengths' },
  { id: 'weakness', label: 'Weaknesses' },
  { id: 'opportunity', label: 'Opportunities' },
  { id: 'threat', label: 'Threats' },
]);

export const SWOT_COPY = Object.freeze({
  checksPending: 'This read appears once the answer checks load.',
  tooFew: 'Answer at least 10 questions for a read of this paper.',
  basis: (counted, total, answers, subject, papers) => `From ${counted} of ${total} questions in this paper and ${plural(answers, 'earlier answer')} in ${subject} across ${plural(papers, 'paper')}.`,
  basisFirst: (counted, total, subject) => `From ${counted} of ${total} questions in this paper. There is no earlier ${subject} record to compare yet.`,
  held: (h) => (h === 1 ? '1 question under re-check or corrected is left out of this read.' : `${h} questions under re-check or corrected are left out of this read.`),
  empty: Object.freeze({
    strength: 'Nothing steady enough to name yet.',
    weakness: 'No chapter stands out as weak on this evidence.',
    opportunity: 'Nothing extra to name from this paper.',
    threatRecorded: 'No repeated or timing risk shows in this record.',
    threatNotRecorded: 'Pace is not judged: time per question was not recorded for this paper.',
    inLedger: "This paper's version is in Where your marks went, above.",
  }),
  blanksFourOptions: ' Where you can rule out one of four options, choosing among the other three averages 1 mark a question under +5 for right and -1 for wrong.',
  later: (date, right, of) => `A set on this chapter on ${date}: ${right} right of ${of}.`,
  blanks: (b, n) => `${b} of ${n} questions left blank: ${b * GAP.blank} marks not earned.`,
  markedTitle: Object.freeze({ blank: 'Marked for review, left blank', strength: 'Marked for review, then answered', weakness: 'Marked for review, then wrong' }),
  // "You marked 6 of 50 questions for review and answered 4 of them: 3 right, 1 wrong."
  marked: (m, n, a, r, w) => `You marked ${m} of ${n} questions for review and answered ${a === m ? 'all of them' : a === 0 ? 'none of them' : `${a} of them`}${a ? `: ${r} right, ${w} wrong` : ''}.`,
  markedBlank: (b) => ` ${b === 1 ? '1 stayed blank: 5 marks not earned' : `${b} stayed blank: ${b * GAP.blank} marks not earned`}. On average an answer scores more than a blank when it is right more than 1 time in 6, under +5 for right and −1 for wrong.`,
  markedReason: (b, m) => `${b} of the ${m} questions you marked for review were left blank.`,
  notOpened: (u, n, list) => `${u} of ${n} questions were never opened: ${list}.`,
  notOpenedReason: (u, n, secs) => `${u} of ${n} questions were never opened. Quick sets give ${secs} seconds a question.`,
  repeatMisses: (k, m) => `${k} of the ${m} questions you had missed before were wrong again.`,
  // What was checked: the papers of the record (this one and the earlier ones it counts), not every paper ever.
  untriedTitle: 'Chapters with no recent answers',
  untried: (k, list, papers, subject) => `${k} syllabus chapters have no answers in your last ${papers} ${subject} papers: ${list}.`,
  untriedReason: (papers, subject) => `No answers in this chapter in your last ${papers} ${subject} papers.`,
  mixed: 'No single chapter stands out yet. A mixed set adds to your record.',
  mixedOnly: 'A mixed set adds to your record.',
});

const subjectDisplay = (id) => getSubjectById(id)?.name || String(id || '').replace(/[_-]+/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
const byWeight = (a, b) => b.weight - a.weight || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0);
const pctOf = (right, answered) => (answered ? Math.round((right / answered) * 100) : null);
const recordEvidence = (r) => { const w = wilson(r.right, r.answered); return { right: r.right, answered: r.answered, papers: r.papers, pct: w.pct, low: w.low, high: w.high }; };
const paperEvidence = (p) => ({ n: p.n, right: p.right, wrong: p.wrong, blank: p.blank, answered: p.answered, lost: p.lost });

function shell(state, message = null) {
  return { version: SWOT_VERSION, state, message, basis: null, quadrants: [], plan: [] };
}

function makeItem(kind, quadrant, { chapter = null, title, detail, questions = [], weight = 0, evidence = {}, plan = null }) {
  return { id: chapter ? `${kind}:${chapter}` : kind, kind, quadrant, title, detail, chapter, questions: [...questions].sort((a, b) => a - b), planId: null, weight, evidence, plan };
}

// ---------- Chapter items, named once each in precedence order ----------

function chapterItems({ attempt, allAttempts, ledger }) {
  const R = SWOT_RULES;
  const chapters = [...ledger.paper.keys()].filter((c) => c !== UNMAPPED_CHAPTER).sort();
  const claimed = new Set();
  const items = [];
  const mocks = comparableMocks(attempt, allAttempts, R.repeatLoss.mocks);
  const olderCounts = mocks.slice(1).map((x) => chapterCounts(paperRows(x)));

  const checks = {
    repeat_loss: (c, P) => {
      if (mocks.length < R.repeatLoss.mocks) return null;
      const lostNewestFirst = [P.lost, ...olderCounts.map((m) => m.get(c)?.lost ?? 0)];
      if (lostNewestFirst.some((l) => l < R.repeatLoss.lostEach)) return null;
      const [l1, l2, l3] = [...lostNewestFirst].reverse();
      return makeItem('repeat_loss', 'threat', { chapter: c, title: `${c} in each of your last 3 mocks`,
        detail: `Marks lost here: ${l1}, ${l2} and ${l3}, oldest first.`, questions: P.qs, weight: l1 + l2 + l3,
        evidence: { lost: [l1, l2, l3], attempts: [...mocks].reverse().map((m) => m.id), paper: paperEvidence(P) },
        plan: { reason: 'Marks lost here in each of your last 3 mocks.' } });
    },
    weak_chapter: (c, P, L) => {
      const w = wilson(L.right, L.answered);
      if (!(L.answered >= R.weakChapter.recordAnswered && L.papers >= R.weakChapter.recordPapers && w.high < R.weakChapter.recordHighBelow && P.lost >= R.weakChapter.paperLost)) return null;
      return makeItem('weak_chapter', 'weakness', { chapter: c, title: c,
        detail: `${L.right} right of ${L.answered} across ${L.papers} papers. In this one: ${P.right} of ${P.n} right, ${P.lost} marks lost.`,
        questions: P.qs, weight: P.lost, evidence: { paper: paperEvidence(P), record: recordEvidence(L) },
        plan: { reason: `${P.lost} marks lost here in this paper, and ${L.right} right of ${L.answered} across ${L.papers} papers.` } });
    },
    chapter_slipped: (c, P, L, E) => {
      const w = wilson(E.right, E.answered);
      const S = R.chapterSlipped;
      if (!(E.answered >= S.earlierAnswered && E.papers >= S.earlierPapers && w.low >= S.earlierLowAtLeast
        && P.answered >= S.paperAnswered && P.wrong >= S.paperWrong && pctOf(P.right, P.answered) <= w.pct - S.drop)) return null;
      const line = `${P.right} of ${P.answered} right here, against ${E.right} of ${E.answered} before.`;
      return makeItem('chapter_slipped', 'threat', { chapter: c, title: `${c} slipped in this paper`, detail: line,
        questions: P.qs, weight: P.lost, evidence: { paper: paperEvidence(P), earlier: recordEvidence(E), record: recordEvidence(L) },
        plan: { reason: line } });
    },
    weak_chapter_paper: (c, P, L) => {
      const S = R.weakChapterPaper;
      if (!(P.n >= S.paperN && P.right / P.n <= S.ratioAtMost && P.lost >= S.paperLost)) return null;
      return makeItem('weak_chapter_paper', 'weakness', { chapter: c, title: c,
        detail: `${P.right} of ${P.n} right in this paper, ${P.lost} marks lost. One paper is a small sample.`,
        questions: P.qs, weight: P.lost, evidence: { paper: paperEvidence(P), record: recordEvidence(L) },
        plan: { reason: `${P.lost} marks lost here in this paper.` } });
    },
    close_chapter: (c, P, L) => {
      const w = wilson(L.right, L.answered);
      const S = R.closeChapter;
      if (!(L.answered >= S.recordAnswered && L.papers >= S.recordPapers && w.pct >= S.pctFrom && w.pct < S.pctBelow && P.lost >= S.paperLost)) return null;
      return makeItem('close_chapter', 'opportunity', { chapter: c, title: c,
        detail: `${L.right} right of ${L.answered} across ${L.papers} papers. ${P.lost} marks lost here in this paper.`,
        questions: [], weight: P.lost, evidence: { paper: paperEvidence(P), record: recordEvidence(L) },
        plan: { reason: `${L.right} right of ${L.answered} so far. ${P.lost} marks lost here in this paper.` } });
    },
    strong_chapter: (c, P, L) => {
      const w = wilson(L.right, L.answered);
      const S = R.strongChapter;
      if (!(L.answered >= S.recordAnswered && L.papers >= S.recordPapers && w.low >= S.recordLowAtLeast && P.n >= S.paperN && P.wrong <= S.paperWrongAtMost)) return null;
      return makeItem('strong_chapter', 'strength', { chapter: c, title: c,
        detail: `${L.right} right of ${L.answered} across ${L.papers} papers, ${P.right} of ${P.n} in this one.`,
        questions: [], weight: L.answered, evidence: { paper: paperEvidence(P), record: recordEvidence(L) } });
    },
  };

  for (const kind of R.chapterPrecedence) {
    for (const c of chapters) {
      if (claimed.has(c)) continue;
      const item = checks[kind](c, paperFor(ledger, c), recordFor(ledger, c), earlierFor(ledger, c));
      if (item) { items.push(item); claimed.add(c); }
    }
  }
  return items;
}

// ---------- Marked for review ----------

/**
 * The questions marked for review at some point in this paper (the last state does not matter: a question marked and
 * then unmarked was still marked), counted over the questions in this read. Null when the record carries no marks
 * (taken before the capture of 15 Oct, scored in the browser, or not matched), so an older paper says nothing here.
 */
export function markedRead(attempt, counted) {
  const trace = paperTrace(attempt);
  if (trace.state !== 'ready' || !trace.captured) return null;
  const marked = counted.filter((row) => (trace.marksByQid.get(row.qid) || []).some((m) => m.marked));
  const answered = marked.filter((row) => row.outcome !== 'blank');
  const right = answered.filter((row) => row.outcome === 'right').length;
  return {
    marked, answered: answered.length, right, wrong: answered.length - right, blank: marked.length - answered.length, counted: counted.length,
  };
}

function markedItem(read) {
  const R = SWOT_RULES.markedReview;
  if (!read || read.marked.length < R.marked) return null;
  const { marked, answered, right, wrong, blank } = read;
  const m = marked.length;
  const base = SWOT_COPY.marked(m, read.counted, answered, right, wrong);
  const evidence = { marked: m, answered, right, wrong, blank, counted: read.counted };
  const numbersOf = (rows) => rows.map((row) => row.number);
  if (blank > 0) {
    const blanks = marked.filter((row) => row.outcome === 'blank');
    return makeItem('marked_review', 'opportunity', { title: SWOT_COPY.markedTitle.blank, detail: base + SWOT_COPY.markedBlank(blank),
      questions: numbersOf(blanks), weight: blank * GAP.blank, evidence,
      plan: blank >= 2 ? { reason: SWOT_COPY.markedReason(blank, m), count: SWOT_RULES.plan.timedCount, label: `Practise ${SWOT_RULES.plan.timedCount}, timed` } : null });
  }
  if (answered >= R.marked && right / answered >= R.strengthShare) {
    return makeItem('marked_review', 'strength', { title: SWOT_COPY.markedTitle.strength, detail: base,
      questions: numbersOf(marked.filter((row) => row.outcome === 'right')), weight: right, evidence });
  }
  if (wrong >= R.weaknessWrong && wrong > right) {
    return makeItem('marked_review', 'weakness', { title: SWOT_COPY.markedTitle.weakness, detail: base,
      questions: numbersOf(marked.filter((row) => row.outcome === 'wrong')), weight: wrong * GAP.wrong, evidence });
  }
  return null;
}

// ---------- Paper items ----------

/**
 * Chapters answered (right or wrong) in any paper in this subject from the oldest paper of the record up to this one,
 * of any scoring and retakes included, so "no answers in your last N papers" holds for every paper in that span.
 */
function chaptersAnsweredInRecordSpan(attempt, allAttempts, ledger) {
  const cur = when(attempt);
  const oldest = Math.min(cur, ...ledger.earlierAttempts.map(when));
  const answered = new Set();
  for (const x of [attempt, ...(allAttempts || [])]) {
    if (!x || x.subject !== attempt.subject || when(x) < oldest || when(x) > cur) continue;
    for (const row of paperRows(x)) if (row.outcome !== 'blank') answered.add(row.chapter);
  }
  return answered;
}

function paperItems({ attempt, allAttempts, ledger, missedBefore, recorded }) {
  const R = SWOT_RULES;
  const items = [];
  const counted = ledger.rows.filter((r) => !r.excluded);
  const byQid = new Map(counted.map((r) => [r.qid, r]));
  const { right, answered, blank } = ledger.totals;

  if (answered >= R.accurate.answered && right / answered >= R.accurate.ratio) {
    items.push(makeItem('accurate', 'strength', { title: 'Accurate when you answered',
      detail: `${right} of your ${answered} answers were right.`, weight: answered, evidence: { right, answered } }));
  }

  if (recorded) {
    const changes = answerChangesByQuestion(attempt);
    let count = 0; let net = 0; let keyLeft = 0;
    const rightToWrong = [];
    for (const [qid, list] of changes) {
      const row = byQid.get(qid);
      if (!row) continue;
      count += list.length;
      for (const c of list) {
        net += Number(c.markEffect) || 0;
        if (row.keyIndex !== null && c.before === row.keyIndex && c.after !== row.keyIndex) keyLeft++;
      }
      if (row.keyIndex !== null && list[0]?.before === row.keyIndex && row.outcome === 'wrong') rightToWrong.push(row.number);
    }
    if (count >= R.changesHelped.changes && net >= R.changesHelped.net && keyLeft === 0) {
      items.push(makeItem('changes_helped', 'strength', { title: 'Changed answers paid off',
        detail: `${count} answer changes gained ${net} marks in total. None turned a right answer wrong.`, weight: net,
        evidence: { changes: count, net } }));
    }
    const r = rightToWrong.length;
    if (r >= R.changesHurt.rightToWrong) {
      items.push(makeItem('changes_hurt', 'weakness', { title: 'Right answers changed to wrong',
        detail: `${r} answers were right before you changed them. Those changes cost ${r * GAP.wrong} marks.`,
        questions: rightToWrong, weight: r * GAP.wrong, evidence: { rightToWrong: r, changes: count, net } }));
    }

    const opened = openedQuestions(attempt);
    const unopened = counted.filter((row) => !opened.has(row.qid)).map((row) => row.number);
    const u = unopened.length;
    const tail = Math.ceil(ledger.total / 4);
    const inTail = unopened.filter((n) => n > ledger.total - tail).length;
    if (u >= R.notOpened.unopened && inTail >= Math.ceil((2 * u) / 3)) {
      items.push(makeItem('not_opened', 'threat', { title: 'Questions never opened',
        detail: SWOT_COPY.notOpened(u, counted.length, questionList(unopened)), questions: unopened, weight: u * GAP.blank,
        evidence: { unopened: u, counted: counted.length, inLastQuarter: inTail, total: ledger.total },
        plan: { reason: SWOT_COPY.notOpenedReason(u, counted.length, TEST_MODES.quick.durationPerQuestionSec), count: R.plan.timedCount, label: `Practise ${R.plan.timedCount}, timed` } }));
    }
  }

  // Marked for review (recovery.marks): read only when the record carries them.
  const marked = markedItem(markedRead(attempt, counted));
  if (marked) items.push(marked);

  const dwell = paperDwell(attempt);
  if (dwell) {
    const timedWrong = counted.filter((row) => row.outcome === 'wrong' && Number.isFinite(dwell.get(row.qid)) && dwell.get(row.qid) > 0);
    const quick = timedWrong.filter((row) => dwell.get(row.qid) < R.quickWrong.underMs);
    const w = timedWrong.length; const q = quick.length;
    if (w >= R.quickWrong.timedWrong && q / w >= R.quickWrong.ratio) {
      items.push(makeItem('quick_wrong', 'weakness', { title: 'Quick wrong answers',
        detail: `${q} of your ${w} timed wrong answers took under ${R.quickWrong.underMs / 1000} seconds.`,
        questions: quick.map((row) => row.number), weight: q * GAP.wrong, evidence: { quick: q, timedWrong: w } }));
    }
  }

  if (blank >= R.blanks.blanks) {
    const blanks = counted.filter((row) => row.outcome === 'blank');
    const fourOptions = blanks.every((row) => row.options === 4);
    items.push(makeItem('blanks', 'opportunity', { title: 'Blanks',
      detail: `${SWOT_COPY.blanks(blank, counted.length)}${fourOptions ? SWOT_COPY.blanksFourOptions : ''}`,
      questions: blanks.map((row) => row.number), weight: blank * GAP.blank, evidence: { blank, counted: counted.length, fourOptions } }));
  }

  if (ledger.earlierPapers >= R.untried.earlierPapers) {
    const inPaper = new Set(ledger.rows.map((row) => row.chapter));
    const answeredInSpan = chaptersAnsweredInRecordSpan(attempt, allAttempts, ledger);
    const untried = getCanonicalChapters(attempt.subject).filter((c) => !inPaper.has(c) && recordFor(ledger, c).answered === 0 && !answeredInSpan.has(c));
    const k = untried.length;
    if (k >= R.untried.chapters) {
      const named = untried.slice(0, R.untried.named);
      const list = k > named.length ? `${named.join(', ')} and ${k - named.length} more` : `${named.slice(0, -1).join(', ')} and ${named[named.length - 1]}`;
      // N: the papers of the record L, this one included (spec B.2).
      const papers = ledger.earlierAttempts.length + 1;
      const subject = subjectDisplay(attempt.subject);
      items.push(makeItem('untried', 'opportunity', { title: SWOT_COPY.untriedTitle,
        detail: SWOT_COPY.untried(k, list, papers, subject), weight: 0,
        evidence: { chapters: untried, earlierPapers: ledger.earlierPapers, recordPapers: papers },
        plan: { reason: SWOT_COPY.untriedReason(papers, subject), candidates: untried } }));
    }
  }

  const cur = when(attempt);
  // m: today's questions with a miss (a wrong answer) in an attempt completed before this one, whatever today's answer.
  // missedBefore lists only today's wrong answers, so the other questions are read from the attempts themselves.
  // k: the m questions that are wrong again today.
  const wrongEarlier = new Set();
  for (const x of allAttempts || []) {
    if (!x || x.id === attempt.id || !(when(x) < cur)) continue;
    for (const d of x.details || []) if (d?.isCorrect === false && Number.isInteger(d?.givenIndex)) wrongEarlier.add(d.qid);
  }
  const missedEarlier = counted.filter((row) => wrongEarlier.has(row.qid)
    || (row.outcome === 'wrong' && (Array.isArray(missedBefore?.[row.qid]) ? missedBefore[row.qid] : []).some((m) => m && Number(m.completedAt) < cur)));
  const again = missedEarlier.filter((row) => row.outcome === 'wrong');
  if (again.length >= R.repeatMisses.questions) {
    items.push(makeItem('repeat_misses', 'threat', { title: 'Missed again',
      detail: SWOT_COPY.repeatMisses(again.length, missedEarlier.length), questions: again.map((row) => row.number),
      weight: again.length * GAP.wrong, evidence: { questions: again.length, missedBefore: missedEarlier.length } }));
  }
  return items;
}

// ---------- The plan: "Do these next" ----------

/** The earliest quick set after this attempt, in the same subject, entirely in chapter `c`, with 5 or more questions. */
export function laterSet(attempt, allAttempts, chapter, now = Date.now()) {
  const cur = when(attempt);
  const next = (allAttempts || [])
    .filter((x) => x && x.id !== attempt.id && x.subject === attempt.subject && attemptScoring(x) === 'server' && modeOf(x) === 'quick'
      && when(x) > cur && when(x) <= now)
    .filter((x) => {
      const rows = paperRows(x);
      return rows.length >= SWOT_RULES.later.minQuestions && rows.every((row) => row.chapter === chapter);
    })
    .sort((a, b) => when(a) - when(b) || String(a.id).localeCompare(String(b.id)))[0];
  if (!next) return null;
  const rows = paperRows(next);
  const right = rows.filter((row) => row.outcome === 'right').length;
  return { at: when(next), right, of: rows.length, line: SWOT_COPY.later(istDayMonth(when(next)), right, rows.length) };
}

function practiceHref(subject, count, chapter) {
  return `/dashboard?subject=${encodeURIComponent(subject)}&mode=quick&count=${count}${chapter ? `&chapter=${encodeURIComponent(chapter)}` : ''}`;
}

function buildPlan({ attempt, allAttempts, items, now }) {
  const R = SWOT_RULES;
  const subject = attempt.subject;
  const of = (kinds) => items.filter((item) => kinds.includes(item.kind));
  const byLost = (a, b) => (b.evidence?.paper?.lost ?? 0) - (a.evidence?.paper?.lost ?? 0) || (a.id < b.id ? -1 : 1);
  const candidates = [
    ...of(['repeat_loss']).sort(byWeight),
    ...of(['weak_chapter', 'chapter_slipped', 'weak_chapter_paper']).sort(byLost),
    ...of(['close_chapter']).sort(byLost),
    ...of(['not_opened']),
    ...of(['marked_review']),
    ...of(['untried']),
  ];
  const plan = [];
  const usedChapters = new Set();
  let noChapterUsed = false;
  // A chapter that fails the syllabus check cannot be practised, so it gets no row; the read may still name it.
  let chapterSkipped = false;
  for (const item of candidates) {
    if (plan.length >= R.plan.max || !item.plan) continue;
    let chapter = item.chapter;
    if (item.kind === 'untried') chapter = (item.plan.candidates || []).find((c) => isValidTopSyllabusPair(subject, c) && !usedChapters.has(c)) || null;
    if (item.kind === 'untried' && !chapter) continue;
    if (chapter && !isValidTopSyllabusPair(subject, chapter)) { chapterSkipped = true; continue; }
    if (chapter && usedChapters.has(chapter)) continue;
    if (!chapter && noChapterUsed) continue;
    const count = item.plan.count ?? R.plan.chapterCount;
    const id = `p${plan.length + 1}`;
    plan.push({
      id, label: item.plan.label ?? `Practise ${count} on ${chapter}`, reason: item.plan.reason,
      practice: { subject, mode: 'quick', count, chapter: chapter || null },
      href: practiceHref(subject, count, chapter),
      later: chapter ? laterSet(attempt, allAttempts, chapter, now) : null,
    });
    item.planId = id;
    if (chapter) usedChapters.add(chapter); else noChapterUsed = true;
  }
  if (!plan.length) {
    const count = R.plan.mixedCount;
    // "No single chapter stands out" would be false beside a chapter the read names but no set can practise.
    plan.push({ id: 'p1', label: `Practise ${count} mixed questions`, reason: chapterSkipped ? SWOT_COPY.mixedOnly : SWOT_COPY.mixed,
      practice: { subject, mode: 'quick', count, chapter: null }, href: practiceHref(subject, count, null), later: null });
  }
  return plan;
}

// ---------- The SWOT ----------

/** Is this item already shown by one of the Mistake Lab ledger's groups? */
function inLedger(item, ledgerGroups) {
  const covers = SWOT_RULES.ledgerCovers[item.kind];
  return !!(covers && ledgerGroups && covers.some((id) => ledgerGroups.has(id)));
}

/**
 * buildSwot({ attempt, allAttempts, answerReviews, answerReviewState, missedBefore, now, ledger?, ledgerGroups? }).
 * `ledger` may be passed in so the route shares one ledger with the record lines.
 * `ledgerGroups` (the ids of the Mistake Lab ledger's groups on the page, or null) hides the quadrant items the
 * ledger already shows (SWOT_RULES.ledgerCovers), after the plan is built, so "Do these next" is unchanged. A
 * quadrant emptied that way says so. Null (the default) leaves the read exactly as before.
 */
export function buildSwot({ attempt, allAttempts = [], answerReviews = {}, answerReviewState = 'ready', missedBefore = {}, now = Date.now(), ledger = null, ledgerGroups = null } = {}) {
  if (!attempt || !isMock(attempt) || attemptScoring(attempt) !== 'server') return shell('not_available');
  if (answerReviewState !== 'ready') return shell('checks_pending', SWOT_COPY.checksPending);
  const book = ledger || buildLedger(attempt, allAttempts, { answerReviews });
  if (book.totals.answered < SWOT_RULES.minAnswered) return shell('too_few', SWOT_COPY.tooFew);

  const recorded = telemetryRecorded(attempt);
  const subject = subjectDisplay(attempt.subject);
  const first = book.earlierPapers === 0;
  // First paper in the subject (spec B.3 basis line): history items are skipped, so the read never says "There is no
  // earlier record" beside a line that leans on one (a retake's "Missed again", or blank-only earlier mocks).
  const all = [...chapterItems({ attempt, allAttempts, ledger: book }), ...paperItems({ attempt, allAttempts, ledger: book, missedBefore, recorded })]
    .filter((item) => !(first && HISTORY_KINDS.has(item.kind)));

  const covered = Array.isArray(ledgerGroups) ? new Set(ledgerGroups) : null;
  const quadrants = QUADRANTS.map(({ id, label }) => {
    const inQuadrant = all.filter((item) => item.quadrant === id);
    const shown = covered ? inQuadrant.filter((item) => !inLedger(item, covered)) : inQuadrant;
    const items = shown.sort(byWeight).slice(0, SWOT_RULES.caps[id]);
    return { id, label, items, emptiedByLedger: !shown.length && inQuadrant.length > 0 };
  });
  // The plan reads every qualifying item, so a chapter cut by a quadrant cap can still lead a practice set.
  const plan = buildPlan({ attempt, allAttempts, items: all, now });

  const basis = {
    line: first ? SWOT_COPY.basisFirst(book.counted, book.total, subject) : SWOT_COPY.basis(book.counted, book.total, book.earlierAnswers, subject, book.earlierPapers),
    heldLine: book.held ? SWOT_COPY.held(book.held) : null,
    counted: book.counted, total: book.total, held: book.held,
    earlierPapers: book.earlierPapers, earlierAnswers: book.earlierAnswers,
    timing: recorded ? 'recorded' : 'not_recorded',
  };

  return {
    version: SWOT_VERSION,
    state: 'ready',
    message: null,
    basis,
    quadrants: quadrants.map(({ id, label, items, emptiedByLedger }) => ({
      id, label,
      empty: items.length ? null : emptiedByLedger ? SWOT_COPY.empty.inLedger : id === 'threat' ? (recorded ? SWOT_COPY.empty.threatRecorded : SWOT_COPY.empty.threatNotRecorded) : SWOT_COPY.empty[id],
      items: items.map(({ id: itemId, kind, title, detail, chapter, questions, planId, evidence }) => ({ id: itemId, kind, title, detail, chapter, questions, planId, evidence })),
    })),
    plan,
  };
}

// ---------- The route's history block ----------

/**
 * The additive history fields of GET /api/attempts/:id. Each part fails on its own: a failed history
 * read gives recap null, missedBefore {}, mistakeInsights {}, lab null and swot null, and the result still loads.
 * `swotEnabled: false` (env SWOT_ENABLED=off) leaves the swot field out.
 * Until the answer checks are ready the record lines are not built ({}) and the Mistake Lab is null, as the SWOT
 * says checks_pending: their counts leave held questions out, and which questions are held is not known yet.
 * `cohortOf({ attempt, allAttempts, answerReviews })` (server only: data/cohort_picks.js readCohort) gives How
 * others answered; without it, or when it fails, the Lab is built without the cohort.
 * `labLoop: true` adds slice 3 to the Lab (data/lab_loop.js: acrossMocks, repairOrder, rules, prove.ruleCheck);
 * `ruleSourcesOf({ attempt, allAttempts })` (server only: src/lib/server/ruleBook.js loadRuleSources) gives the
 * repairs and playbook rows the rules and the rule check need; without it, or when it fails, those two are null.
 */
export async function resultHistory({ attempt, answerReviews = {}, answerReviewState = 'ready', loadAttempts, recapOf, missedBeforeOf, cohortOf = null, labLoop = false, ruleSourcesOf = null, swotEnabled = true, now = Date.now(), warn = () => {} }) {
  const out = { recap: null, missedBefore: {}, mistakeInsights: {}, lab: null, ...(swotEnabled ? { swot: null } : {}) };
  let allAttempts;
  try { allAttempts = await loadAttempts(); } catch (e) { warn('history', e); return out; }
  const step = (name, fn, fallback) => { try { return fn() ?? fallback; } catch (e) { warn(name, e); return fallback; } };
  out.recap = step('recap', () => recapOf(attempt, allAttempts, answerReviews, answerReviewState), null);
  out.missedBefore = step('missedBefore', () => missedBeforeOf(allAttempts, attempt.id), {});
  const checksReady = answerReviewState === 'ready';
  const ledger = checksReady ? step('ledger', () => buildLedger(attempt, allAttempts, { answerReviews }), null) : null;
  if (checksReady) out.mistakeInsights = step('mistakeInsights', () => buildMistakeInsights({ attempt, allAttempts, ledger, missedBefore: out.missedBefore, answerReviews }), {});
  if (checksReady) {
    let cohort = null;
    if (cohortOf) { try { cohort = (await cohortOf({ attempt, allAttempts, answerReviews })) ?? null; } catch (e) { warn('cohort', e); } }
    out.lab = step('lab', () => buildMistakeLab({ attempt, answerReviews, cohort }), null);
    if (out.lab && labLoop) {
      let sources = null;
      if (ruleSourcesOf) { try { sources = (await ruleSourcesOf({ attempt, allAttempts })) ?? null; } catch (e) { warn('ruleSources', e); } }
      Object.assign(out.lab, buildLabLoop({ attempt, allAttempts, answerReviews, lab: out.lab, sources, warn }));
    }
  }
  const ledgerGroups = out.lab && (out.lab.state === 'ready' || out.lab.state === 'basic') ? out.lab.groups.map((g) => g.id) : null;
  if (swotEnabled) out.swot = step('swot', () => buildSwot({ attempt, allAttempts, answerReviews, answerReviewState, missedBefore: out.missedBefore, now, ledger, ledgerGroups }), null);
  return out;
}
