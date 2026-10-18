// The result screen's first two layers (docs/design-decisions/pass-1017/RESULT-1017.md 4.2 to 4.4, packet S1): what
// happened in one glance (the receipt, the costliest chapter) and the one next move, chosen by stated rules.
// PURE: no I/O, no React. The website reads it (src/components/result/ResultHead.jsx, NextMove.jsx); the app ports it
// (flutter_app lib/features/result/model/next_move.dart) and is tested against the same fixtures
// (data/tests/fixtures/result_next_move/*.json).
//
// Every number comes from the scored attempt (data/session_recovery.js analyseSession), the server's repair order
// (lab.repairOrder), the key checks (answerReviews) or the wallet. Nothing is invented: an unknown balance has no number.
import { usesLine, haveLine } from '../src/lib/creditCopy.mjs';
import { TEST_MODES, practiceCreditCost } from './test_modes.js';

const SET_SIZE = 10;

export const NEXT_MOVE_RULES = Object.freeze({
  gapWrong: 6, // 5 not won plus the 1 penalty
  gapBlank: 5,
  fewRight: 0.15, // a chapter with under 15 percent right leads its detail with the right count ("1 right of 10: ...")
  weakShare: 0.4, // under 40 percent of answered questions right: a chapter set before single repairs
  setSize: SET_SIZE, // "Practise 10 on {chapter}"
  practiceCost: practiceCreditCost('quick', SET_SIZE), // practice credits for this 10-question Quick practice: 1 a question (data/test_modes.js)
  fullMockCost: practiceCreditCost('full', TEST_MODES.full.fixedCount), // practice credits for a Full mock (data/test_modes.js)
  fewRepairs: 5, // with 5 or fewer left, the time for all of them is said
  lateFrom: 23, // 11 PM to 5 AM: one plain line, no figure
  lateUntil: 5,
});

// Keys under re-check or corrected: never repaired, never counted against a chapter.
const HELD_STATES = new Set(['withdrawn', 'under_review', 'content_changed', 'key_changed_unverified', 'corrected']);
const LETTERS = 'ABCDEFGH';
const plural = (n, word) => `${n} ${word}${n === 1 ? '' : 's'}`;
const isHeld = (answerReviews, qid) => HELD_STATES.has(answerReviews?.[qid]?.state);

/** Paper kind in plain words, from the attempt's mode. */
export function paperKind(mode) {
  if (mode === 'full') return 'full mock';
  if (mode === 'nta') return 'NTA paper';
  if (mode === 'smart') return 'smart practice';
  return 'practice';
}

/** The attempt's mode: the stored mode, else a server practice record is Quick practice. */
export function attemptMode(attempt) {
  const mode = attempt?.selectionMeta?.mode || attempt?.mode || null;
  if (mode) return mode;
  return attempt?.selectionMeta?.scoringVersion === 'server_practice_v1' ? 'quick' : null;
}

/** "9:41 PM" (12-hour). `timeZone` only for tests; the page uses the device's own clock. */
export function clockTime(at, { timeZone } = {}) {
  const t = typeof at === 'number' ? at : Date.parse(at);
  if (!Number.isFinite(t)) return '';
  return new Date(t).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true, ...(timeZone ? { timeZone } : {}) });
}

function dayKey(t, timeZone) {
  return new Date(t).toLocaleDateString('en-CA', timeZone ? { timeZone } : {});
}

/** "46m 36s", "2m 05s", "48s". */
export function shortDuration(ms) {
  if (!Number.isFinite(ms) || ms <= 0) return '';
  const s = Math.round(ms / 1000);
  return s < 60 ? `${s}s` : `${Math.floor(s / 60)}m ${String(s % 60).padStart(2, '0')}s`;
}

/**
 * The one receipt: "Accountancy full mock. Recorded 9:41 PM, 46m 36s." A paper from another day names the day:
 * "Recorded yesterday, 9:41 PM" or "Recorded 14 Oct, 9:41 PM". No duration when the clock record has none.
 */
export function receiptLine({ subjectName = '', mode = null, completedAt = null, durationMs = null, now = Date.now(), timeZone } = {}) {
  const head = [subjectName, paperKind(mode)].filter(Boolean).join(' ');
  const t = typeof completedAt === 'number' ? completedAt : Date.parse(completedAt);
  let when = '';
  if (Number.isFinite(t)) {
    const time = clockTime(t, { timeZone });
    // Today says only the time; yesterday says so (a relative day); older papers name the date.
    const sameDay = dayKey(t, timeZone) === dayKey(now, timeZone);
    const yesterday = !sameDay && dayKey(t, timeZone) === dayKey(now - 86_400_000, timeZone);
    const day = sameDay ? '' : yesterday ? 'yesterday, ' : `${new Date(t).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', ...(timeZone ? { timeZone } : {}) })}, `;
    when = `Recorded ${day}${time}`;
  }
  const dur = shortDuration(durationMs);
  const tail = [when, dur].filter(Boolean).join(', ');
  const first = head ? `${head.charAt(0).toUpperCase()}${head.slice(1)}.` : '';
  return [first, tail ? `${tail}.` : ''].filter(Boolean).join(' ');
}

/**
 * The chapter that cost the most marks (6 per wrong, 5 per blank), leaving out questions whose key is held or
 * corrected. Ties: more wrong answers first, then the chapter that comes earlier in the paper. Null when nothing was
 * missed or the rows have no chapter.
 */
export function costliest(analysis, { answerReviews = {} } = {}) {
  const rows = analysis?.rows || [];
  const by = new Map();
  rows.forEach((r, i) => {
    if (!r?.chapter) return;
    const c = by.get(r.chapter) || { chapter: r.chapter, n: 0, right: 0, wrong: 0, blank: 0, marks: 0, firstAt: i };
    c.n += 1;
    if (!isHeld(answerReviews, r.q?.id)) {
      if (r.verdict === 'correct') c.right += 1;
      else if (r.verdict === 'wrong') { c.wrong += 1; c.marks += NEXT_MOVE_RULES.gapWrong; }
      else { c.blank += 1; c.marks += NEXT_MOVE_RULES.gapBlank; }
    }
    by.set(r.chapter, c);
  });
  const list = [...by.values()].filter((c) => c.marks > 0).sort((a, b) => b.marks - a.marks || b.wrong - a.wrong || a.firstAt - b.firstAt);
  return list[0] || null;
}

/**
 * Layer 1's finding: { line, detail }. "Share Capital cost 29 of the 122 marks you missed." / "4 wrong and 1 left
 * blank, of 6 questions." Nothing missed: "Every question right." Without chapter data: the marks split.
 */
export function costliestLine(analysis, { answerReviews = {} } = {}) {
  const marks = analysis?.marks;
  if (!marks) return null;
  if (!marks.gap) return { line: 'Every question right.', detail: null };
  if (marks.right + marks.wrong === 0) return { line: `All ${marks.blank} were left blank: ${marks.gapBlank} marks not earned.`, detail: null };
  const c = costliest(analysis, { answerReviews });
  if (!c) {
    if (marks.wrong && marks.gapWrong >= marks.gapBlank) return { line: `${plural(marks.wrong, 'wrong answer')} cost ${marks.gapWrong} of the ${marks.gap} marks you missed.`, detail: null };
    return { line: `${plural(marks.blank, 'blank')} left ${marks.gapBlank} marks unearned.`, detail: null };
  }
  const parts = [c.wrong ? `${c.wrong} wrong` : null, c.blank ? `${c.blank} left blank` : null].filter(Boolean).join(' and ');
  const detail = c.n && c.right / c.n < NEXT_MOVE_RULES.fewRight
    ? `${c.right} right of ${c.n}: ${parts}.`
    : `${parts}, of ${plural(c.n, 'question')}.`;
  // One chapter holding every missed mark says so, rather than "11 of the 11".
  const line = c.marks === marks.gap ? `${c.chapter} cost all ${marks.gap} marks you missed.` : `${c.chapter} cost ${c.marks} of the ${marks.gap} marks you missed.`;
  return { line, detail, chapter: c.chapter };
}

/**
 * The mistake a repair move points at: the first open one inside the costliest chapter when there is one, else the first in
 * repair order. The result's list leads with it (D15: priority is shown by order, never by a label), so the key and the
 * first row name the same question.
 */
export function leadMistake({ analysis, answerReviews = {}, repairOrder = null, repaired = new Set() } = {}) {
  const top = costliest(analysis, { answerReviews });
  const open = openMistakes(analysis, { answerReviews, repairOrder, repaired });
  return (top ? open.find((r) => r.chapter === top.chapter) : null) || open[0] || null;
}

/** The wrong answers repair can open, in the server's repair order: not held, not repaired yet. */
export function openMistakes(analysis, { answerReviews = {}, repairOrder = null, repaired = new Set() } = {}) {
  const list = (analysis?.mistakes || []).filter((r) => !isHeld(answerReviews, r.q?.id) && !repaired.has(r.q?.id));
  return inOrder(list, repairOrder);
}

/** Rows in repair order (lab.repairOrder.qids first, in its order), then paper order. */
export function inOrder(rows, repairOrder) {
  const list = Array.isArray(rows) ? rows : [];
  const qids = Array.isArray(repairOrder?.qids) ? repairOrder.qids : null;
  if (!qids?.length) return list;
  const rank = new Map(qids.map((id, i) => [id, i]));
  const at = (row) => (rank.has(row?.q?.id) ? rank.get(row.q.id) : Number.MAX_SAFE_INTEGER);
  return list.map((row, i) => ({ row, i })).sort((a, b) => at(a.row) - at(b.row) || a.i - b.i).map((x) => x.row);
}

/** The cohort line for a mistake from the repair order ("18 of 22 other students got it right."), or null. */
export function cohortLine(repairOrder, qid) {
  if (repairOrder?.state !== 'cohort' || !Array.isArray(repairOrder.items)) return null;
  const item = repairOrder.items.find((x) => x?.qid === qid);
  return item && item.reason !== 'paper' && item.line ? item.line : null;
}

/** Three minutes a mistake, rounded up to five (the app's figure). */
export function repairMinutes(count) {
  return count > 0 ? Math.ceil((count * 3) / 5) * 5 : null;
}

/** "It is late. One repair is enough for tonight." from 11 PM to 5 AM, else null. */
export function lateLine(hour) {
  if (!Number.isInteger(hour)) return null;
  return hour >= NEXT_MOVE_RULES.lateFrom || hour < NEXT_MOVE_RULES.lateUntil ? 'It is late. One repair is enough for tonight.' : null;
}

/** "A repair gives you why D looked right, the trap, one rule to keep, and a new question to check it held." */
export function repairValueLine(letter, { checkReady = true } = {}) {
  const pick = letter ? letter : 'your answer';
  return checkReady
    ? `A repair gives you why ${pick} looked right, the trap, one rule to keep, and a new question to check it held.`
    : `A repair gives you why ${pick} looked right, the trap, and one rule to keep.`;
}

/** "1 AI credit. You have 68. No charge if the repair cannot be written." */
export function repairCostLine(aiCredits) {
  const have = haveLine(aiCredits);
  return ['1 AI credit.', have, 'No charge if the repair cannot be written.'].filter(Boolean).join(' ');
}

/** The cost of a 10-question chapter set: Pro covers it; otherwise practice credits and the balance. */
export function practiceCostLine({ isPremium = false, practiceCredits = null } = {}) {
  if (isPremium) return 'Pro covers this set.';
  return usesLine({ what: 'This set', cost: NEXT_MOVE_RULES.practiceCost, pool: 'practice', balance: practiceCredits });
}

// Practice's own setup, with the subject, the chapter and the count already chosen (the dashboard reads them).
const practiseHref = ({ subject, chapter = null }) => {
  const p = new URLSearchParams({ subject: subject || '', mode: 'quick', count: String(NEXT_MOVE_RULES.setSize) });
  if (chapter) p.set('chapter', chapter);
  return `/dashboard?${p}`;
};

/**
 * The one next move (RESULT-1017 4.3), first rule that applies:
 *   1 nothing missed                      harder paper
 *   2 under 40% of answered right, or nothing answered        practise the costliest chapter
 *   3 a wrong answer can be repaired and AI credits are 1+ or unknown   repair the first in repair order (inside the
 *     costliest chapter when one is there)
 *   4 every wrong answer repaired, a check not taken                   check it held (free)
 *   5 otherwise (0 AI credits, keys held, only blanks, all done)       practise the costliest chapter
 *
 * Input:
 *   analysis       analyseSession(attempt)
 *   answerReviews  attempt.answerReviews
 *   repairOrder    attempt.lab.repairOrder or null
 *   repaired       Set of qids with a repair written (this visit, or lab.repaired from the server)
 *   checks         { [qid]: 'right' | 'wrong' } checks the server has marked
 *   aiCredits      number, or null when unknown
 *   practiceCredits, isPremium
 *   mode           'quick' | 'full' | 'nta' | 'smart' | null
 *   subject, subjectName
 *   labReady       the Lab's checks are ready (the value line names the check only then)
 *   hour           local hour, 0 to 23 (the late line)
 *
 * Output: { kind, rule, label, why, value, cost, late, alt, note, target }
 *   kind     'harder' | 'practise' | 'repair' | 'check'
 *   target   { qid, number, chapter } for repair and check; { chapter, href } for practise and harder
 *   alt      { kind: 'repair' | 'practise' | 'paper' | 'credits', label, target } or null
 */
export function nextMove({ analysis, answerReviews = {}, repairOrder = null, repaired = new Set(), checks = {}, aiCredits = null, practiceCredits = null, isPremium = false, mode = null, subject = '', subjectName = '', labReady = true, hour = null } = {}) {
  const marks = analysis?.marks;
  if (!marks) return null;
  const subjectLabel = subjectName || 'this subject';
  const top = costliest(analysis, { answerReviews });
  const answered = marks.right + marks.wrong;
  const open = openMistakes(analysis, { answerReviews, repairOrder, repaired });
  const noAi = Number.isFinite(aiCredits) && aiCredits < 1;
  const repairable = open.length > 0 && !noAi;
  const pickRepair = () => leadMistake({ analysis, answerReviews, repairOrder, repaired });
  // Nothing answered: the set is in the subject (a chapter picked by blanks alone would only be the longest one).
  const practise = ({ rule, why }) => {
    const chapter = answered === 0 ? null : top?.chapter || null;
    const repairFirst = repairable ? pickRepair() : null;
    return {
      kind: 'practise', rule,
      label: chapter ? `Practise ${NEXT_MOVE_RULES.setSize} on ${chapter}` : `Practise ${NEXT_MOVE_RULES.setSize} in ${subjectLabel}`,
      why, value: null,
      cost: practiceCostLine({ isPremium, practiceCredits }),
      late: null,
      alt: repairFirst ? { kind: 'repair', label: `Or repair Q${repairFirst.number}, 1 AI credit`, target: { qid: repairFirst.q.id, number: repairFirst.number, chapter: repairFirst.chapter } }
        : noAi && open.length ? { kind: 'credits', label: 'See your AI credits', target: { href: '/pricing/ai-credits' } } : null,
      note: null,
      target: { chapter, href: practiseHref({ subject, chapter }) },
    };
  };

  // 1. Nothing missed. A set level (harder) comes with Pro, so a free student is offered another paper at its real
  // price, never a harder one they cannot set up; a price above the balance says how many more are needed.
  if (!marks.gap) {
    const mock = mode === 'full' || mode === 'nta';
    const mockHref = `/dashboard?${new URLSearchParams({ subject: subject || '', mode: 'full' })}`;
    if (isPremium) {
      return {
        kind: 'harder', rule: 1,
        label: mock ? 'Set up a harder full mock' : `Practise ${NEXT_MOVE_RULES.setSize} harder in ${subjectLabel}`,
        why: 'A harder paper finds what is left to fix.', // layer 1 already says "Every question right."
        value: null, cost: mock ? 'Pro covers this paper.' : 'Pro covers this set.', late: null,
        alt: { kind: 'paper', label: 'Take another fresh paper', target: null },
        note: null,
        target: { chapter: null, href: mock ? mockHref : practiseHref({ subject }) },
      };
    }
    const price = mock ? NEXT_MOVE_RULES.fullMockCost : NEXT_MOVE_RULES.practiceCost;
    const short = Number.isFinite(practiceCredits) && practiceCredits < price ? price - practiceCredits : 0;
    const cost = [
      usesLine({ what: mock ? 'A full mock' : 'This set', cost: price, pool: 'practice', balance: practiceCredits }),
      short ? `Need ${short} more.` : null,
      'A set level comes with Pro.',
    ].filter(Boolean).join(' ');
    return {
      kind: 'harder', rule: 1,
      label: mock ? 'Take another full mock' : `Practise ${NEXT_MOVE_RULES.setSize} more in ${subjectLabel}`,
      why: 'Another fresh paper finds what is left to fix.',
      value: null, cost, late: null,
      alt: mock
        ? { kind: 'practise', label: `Or practise ${NEXT_MOVE_RULES.setSize} in ${subjectLabel}, ${NEXT_MOVE_RULES.practiceCost} practice credits`, target: { chapter: null, href: practiseHref({ subject }) } }
        : { kind: 'paper', label: 'Take another fresh paper', target: null },
      note: null,
      target: { chapter: null, href: mock ? mockHref : practiseHref({ subject }) },
    };
  }

  // 2. A weak paper: a chapter set before single repairs.
  if (answered === 0 || marks.right / answered < NEXT_MOVE_RULES.weakShare) {
    const why = answered === 0
      ? `Nothing was answered on this paper, so a short set in ${subjectLabel} comes first.`
      : top && top.wrong > top.right
        ? `${top.chapter}: most answers in this chapter were wrong, so a chapter set comes before repairing single mistakes.`
        : top ? `${top.chapter} cost the most marks, so a chapter set comes before repairing single mistakes.`
          : 'Most answers on this paper were wrong, so a short set comes before repairing single mistakes.';
    return practise({ rule: 2, why });
  }

  // 3. Repair the first mistake in repair order.
  if (repairable) {
    const r = pickRepair();
    const letter = Number.isInteger(r.d?.givenIndex) ? LETTERS[r.d.givenIndex] : null;
    const cohort = cohortLine(repairOrder, r.q.id);
    const left = open.length;
    return {
      kind: 'repair', rule: 3,
      label: `Repair Q${r.number}`,
      why: [`${r.chapter}.`, letter ? `You picked ${letter}.` : null, cohort].filter(Boolean).join(' '),
      value: repairValueLine(letter, { checkReady: labReady }),
      cost: repairCostLine(aiCredits),
      late: lateLine(hour),
      alt: top ? { kind: 'practise', label: `Practise ${NEXT_MOVE_RULES.setSize} on ${top.chapter} instead`, target: { chapter: top.chapter, href: practiseHref({ subject, chapter: top.chapter }) } } : null,
      note: left <= NEXT_MOVE_RULES.fewRepairs && left > 1 ? `All ${left} repairs take about ${repairMinutes(left)} minutes.` : null,
      target: { qid: r.q.id, number: r.number, chapter: r.chapter },
    };
  }

  // 4. Every wrong answer repaired; a check not taken yet.
  const mistakes = inOrder((analysis.mistakes || []).filter((r) => !isHeld(answerReviews, r.q?.id)), repairOrder);
  const done = mistakes.filter((r) => repaired.has(r.q.id));
  const unchecked = done.find((r) => !checks[r.q.id]);
  if (mistakes.length && done.length === mistakes.length && unchecked) {
    return {
      kind: 'check', rule: 4,
      label: `Check Q${unchecked.number} held`,
      why: `You repaired ${done.length} of ${mistakes.length}. One new question each shows whether the fix held.`,
      value: null, cost: 'No extra credit.', late: lateLine(hour), alt: null, note: null,
      target: { qid: unchecked.q.id, number: unchecked.number, chapter: unchecked.chapter },
    };
  }

  // 5. Practise the costliest chapter.
  const why = noAi && open.length ? `Repairs use AI credits. ${haveLine(0)}`
    : mistakes.length && done.length === mistakes.length ? `Every mistake on this paper is repaired. A set on ${top?.chapter || subjectLabel} keeps it.`
      : top ? `${top.chapter} cost the most marks on this paper.` : `A short set in ${subjectLabel} comes next.`;
  return practise({ rule: 5, why });
}

/** "Your 12 mistakes" head: the right side reads "−72 marks", or "3 of 12 repaired" once any are. */
export function mistakesHead({ count, repairedCount = 0, heldCount = 0, answered = null }) {
  return {
    title: count ? `Your ${plural(count, 'mistake')}` : answered === 0 ? 'No answers to repair' : 'No mistakes to repair',
    // The empty state teaches what will appear here (FEATURE-ADOPTION item 10).
    empty: count ? null : answered === 0
      ? 'Questions you answer and get wrong on your next paper show up here, each with its own repair.'
      : 'A wrong answer shows up here with its own repair: why your pick looked right, one rule to keep and a new question to check it held.',
    side: !count ? null : repairedCount ? `${repairedCount} of ${count} repaired${heldCount ? `, ${heldCount} held` : ''}` : `−${count * NEXT_MOVE_RULES.gapWrong} marks`,
  };
}

/**
 * The analysis this module reads, from plain rows ({ qid, number, chapter, verdict, givenIndex }): the shape the shared
 * fixtures use, so the app's port and this file are tested on the same papers. The page passes analyseSession instead.
 */
export function analysisFromRows(rows) {
  const list = (rows || []).map((r, index) => ({ q: { id: r.qid }, d: Number.isInteger(r.givenIndex) ? { givenIndex: r.givenIndex } : null, verdict: r.verdict, index, number: r.number ?? index + 1, chapter: r.chapter }));
  const count = (v) => list.filter((r) => r.verdict === v).length;
  const right = count('correct'), wrong = count('wrong'), blank = count('skipped');
  const max = list.length * 5;
  const scored = right * 5 - wrong;
  return {
    rows: list,
    marks: { scored, max, gap: max - scored, gapWrong: wrong * NEXT_MOVE_RULES.gapWrong, gapBlank: blank * NEXT_MOVE_RULES.gapBlank, right, wrong, blank },
    mistakes: list.filter((r) => r.verdict === 'wrong' && Number.isInteger(r.d?.givenIndex)),
  };
}
