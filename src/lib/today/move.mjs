// Up next: the one move Today offers, and why (TODAY-1017 section 4.2; FEATURE-ADOPTION 2, 7, 8 and 10).
// PURE: no I/O, no clock (the caller passes `now` and today's day key). Every number is a count from the
// student's own record, every reason names its source (the paper, its date), and thin data says so.
//
// The order (first match wins):
//   1. resume       an unfinished session the server is holding
//   2. failed       the plan did not load and nothing else is known
//   3. dayOne       no saved session yet: 10 questions to a starting point (first week, day 1)
//   4. check        a recovery check or repair step the plan says is due (time-sensitive)
//   5. returning    7 or more days away: the open mistakes of the last paper first (or a warm-up)
//   6. firstRepair  a paper with open mistakes and no Repair ever: Fix one (first week, day 1)
//   7. revise       Revise has questions due today: Keep (first week, day 2)
//   8. repair       the newest paper has open mistakes: Fix them
//   9. firstMock    no full mock yet: days 5 to 7 of the first week, or 3 or more sessions after it
//  10. smart        first week before day 5, no mock yet, Pro: smart practice (first week, days 3 and 4)
//  11. practice     the plan's own practice, aimed at the chapter with the most marks open
// and `done` replaces 8 to 11 once tonight's planned session is recorded (Find, Fix, Keep never waits on it).
//
// The first week is not a checklist: it is this order, and the overline says "Day 3 of your first week" while
// the first saved session is under 7 days old.
import { TEST_MODES } from '../../../data/test_modes.js';
import { FIRST_TIMED_COPY, firstTimedMockHref, shortestTimedPaper } from '../../../data/first_timed_mock.js';

export const RETURNING_AFTER_DAYS = 7;
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const DAY_MS = 86400000;

const whole = (n) => Number.isInteger(n) && n >= 0;
const plural = (n, one, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;
const word = (n) => ['no', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten'][n] ?? String(n);

/** '11 Oct' in IST, the day a paper was saved. */
export function paperDay(at) {
  const t = Number(at);
  if (!Number.isFinite(t)) return '';
  const d = new Date(t + 19800000);
  return `${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]}`;
}

/** What a saved paper is called in a sentence: "your Accountancy full mock". */
export function paperName(paper, subjectName = (id) => id) {
  if (!paper) return 'your last paper';
  const mode = TEST_MODES[paper.mode]?.label || 'practice';
  const subject = paper.subject ? subjectName(paper.subject) : '';
  const kind = mode === 'NTA mode' ? 'NTA mock' : mode;
  return `your ${subject ? `${subject} ` : ''}${kind.charAt(0).toLowerCase()}${kind.slice(1)}`;
}

/** Minutes a set of repairs takes: about 3 each, rounded up to 5, at least 5 (3 -> 10, 4 -> 15, 2 -> 10). */
export const repairMinutes = (n) => Math.max(5, Math.ceil((n * 3) / 5) * 5);

/** Open mistakes on a paper: its wrong answers less the ones already repaired (F17: never offer a repaired one again). */
export function openMistakes(paper, repairedByAttempt = null) {
  if (!paper || !whole(paper.wrong)) return null;
  const repaired = repairedByAttempt instanceof Map ? repairedByAttempt.get(paper.id) || 0 : 0;
  return Math.max(0, paper.wrong - repaired);
}

/** The day of the first week (1 to 7) while the first saved session is under 7 days old, else null. */
export function firstWeekDay(firstSessionAt, now) {
  const t = Date.parse(firstSessionAt || '');
  if (!Number.isFinite(t)) return null;
  const day = Math.floor((now + 19800000) / DAY_MS) - Math.floor((t + 19800000) / DAY_MS) + 1;
  return day >= 1 && day <= 7 ? day : null;
}

const pills = (second = 'else') => ({ length: true, second });

/**
 * The move. Inputs (each may be null while it loads or when its read failed; unknown is never zero):
 *   plan        GET /api/learning/plan body
 *   planFailed  the plan read failed
 *   papers      GET /api/attempts/summary items, newest first
 *   rhythm      GET /api/me/rhythm body
 *   revise      { due } from GET /api/me/revise
 *   facts       GET /api/me/timed-mock body
 *   repaired    Map attemptId -> repairs saved (GET /api/me/repair-record)
 *   top         the ranked chapter with the most marks open (PrepOS insights), or null
 *   subjectName id -> display name
 *   firstSubject the student's first subject id (day one), or null
 *   premium     Pro account (smart practice is a Pro mode)
 *   minutes     the chosen length (10, 20 or 30)
 *   now         epoch ms
 * Returns null while the facts that decide the first matching rule are still loading.
 */
export function buildMove({ plan = null, planFailed = false, papers = null, rhythm = null, revise = null, facts = null, repaired = null, top = null, subjectName = (id) => id, firstSubject = null, premium = false, minutes = null, now = Date.now() } = {}) {
  const length = [10, 20, 30].includes(minutes) ? minutes : [10, 20, 30].includes(plan?.minutes) ? plan.minutes : 10;
  const primary = plan?.primary || null;

  if (primary?.kind === 'resume_session') {
    return { id: 'resume', overline: 'Pick up your session', title: 'Your session is waiting', number: null, label: '', why: 'The server is holding your answers. Carry on where you stopped.', key: { label: 'Resume your practice', href: primary.href, minutes: null }, pills: { length: false, second: 'else' }, art: 'object', subject: null };
  }

  const sessions = whole(facts?.sessions) ? facts.sessions : whole(rhythm?.counts?.sessions) ? rhythm.counts.sessions : papers ? papers.length : null;
  if (planFailed && sessions == null && !papers) return { id: 'failed' };
  if (sessions == null) return null;

  if (sessions === 0) {
    const name = firstSubject ? subjectName(firstSubject) : '';
    return {
      id: 'dayOne', overline: 'Your first move', number: 10, label: 'questions to your starting point',
      why: `Ten CUET-style ${name ? `${name} ` : ''}questions, marked +5 and −1. The result shows where your marks go, chapter by chapter.`,
      key: { label: 'Start now', href: `/dashboard?${firstSubject ? `subject=${encodeURIComponent(firstSubject)}&` : ''}mode=quick&count=10`, minutes: 10 },
      pills: pills('mock'), art: 'mobi', mobiAct: 'hello', subject: firstSubject, firstWeek: 1,
    };
  }

  const firstWeek = firstWeekDay(rhythm?.milestones?.find?.((m) => m.id === 'first_scored_session')?.achievedAt, now);
  const weekLine = firstWeek ? `Day ${firstWeek} of your first week` : null;
  const moveWord = moveOverline(now);

  if (primary && ['fresh_check', 'repair', 'investigate'].includes(primary.kind)) {
    const record = (primary.facts || []).filter((f) => f.basis === 'record').map((f) => f.text);
    return { id: 'check', overline: weekLine || 'Up next', title: primary.title, number: null, label: '', why: [primary.reason, record[0]].filter(Boolean).join(' '), key: { label: primary.title, href: primary.href, minutes: null }, pills: pills(), art: 'object', subject: null, firstWeek };
  }

  if (!papers) return null; // every rule below reads the newest paper
  const last = papers[0] || null;
  const open = openMistakes(last, repaired);
  const sparse = papers.length < 3;
  const lastWhen = last ? paperDay(last.completedAt) : '';
  const lastName = paperName(last, subjectName);
  // Thin data says so (AGENT_RULES overlay); a fuller picture is offered only when the one paper was not a full mock.
  const oneFull = Boolean(last) && ['full', 'nta'].includes(last.mode);
  const sparseClause = sparse && last ? (papers.length === 1 ? ` From your one paper so far${oneFull ? '.' : '; a full mock gives a fuller picture.'}` : ` From your ${word(papers.length)} papers so far.`) : '';

  const away = whole(rhythm?.daysSinceLastActivity) ? rhythm.daysSinceLastActivity : null;
  if (away != null && away >= RETURNING_AFTER_DAYS) {
    if (open > 0) {
      const n = Math.min(3, open);
      return {
        id: 'returning', overline: 'Pick up where you left off', number: n, label: n === 1 ? 'mistake to repair' : 'mistakes to repair',
        why: `Your last paper was ${lastName} on ${lastWhen}. ${open === n ? `${open === 1 ? 'Its one mistake is' : `All ${word(open)} of its mistakes are`} still open.` : `Its ${word(open)} open mistakes are still here; start with ${word(n)}.`}`,
        key: { label: 'Start repair', href: `/result/${encodeURIComponent(last.id)}`, minutes: repairMinutes(n) },
        link: open > n ? { label: `See all ${open} mistakes`, href: `/result/${encodeURIComponent(last.id)}` } : null,
        pills: pills(), art: 'mobi', mobiAct: 'hello', subject: last.subject, returning: true, open, aiEach: 1, paperAt: last.completedAt,
      };
    }
    return {
      id: 'returning', overline: 'Pick up where you left off', number: 10, label: 'questions to warm up',
      why: `Your last session was ${away} days ago. Ten questions find your footing again, marked the CUET way.`,
      key: { label: 'Start 10 questions', href: '/dashboard?mode=quick&count=10', minutes: 10 },
      pills: pills(), art: 'mobi', mobiAct: 'hello', subject: last?.subject || null, returning: true,
    };
  }

  const tonightDone = plan?.tonight?.state === 'recorded';
  const neverRepaired = whole(rhythm?.counts?.repairs) ? rhythm.counts.repairs === 0 : repaired instanceof Map ? repaired.size === 0 : false;
  const repairMove = (id, overline, extra = '') => ({
    id, overline, number: open, label: open === 1 ? 'mistake to repair' : 'mistakes to repair',
    why: `${open === last.wrong ? (open === 1 ? 'It is from' : `All ${word(open)} are from`) : `${plural(open, 'open mistake')} from`} ${lastName} on ${lastWhen}.${extra}${sparseClause}`,
    key: { label: 'Start repair', href: `/result/${encodeURIComponent(last.id)}`, minutes: repairMinutes(open) },
    pills: pills(papers.length < 2 ? 'mock' : 'else'), art: 'object', subject: last.subject, firstWeek, open, paperAt: last.completedAt,
    aiEach: 1, // each repair uses 1 credit; the card says so, with the balance, before the press
  });

  if (!tonightDone && open > 0 && neverRepaired) {
    return repairMove('firstRepair', weekLine || moveWord, ' Repair shows why your answer went wrong and gives you one like it to try.');
  }
  const due = whole(revise?.due) ? revise.due : 0;
  if (!tonightDone && due > 0) {
    return {
      id: 'revise', overline: weekLine || moveWord, number: due, label: due === 1 ? 'mistake comes back today' : 'mistakes come back today',
      why: `Revise brings back what you got wrong after 1, 3, 7 and 21 days. ${due === 1 ? 'This one is' : `These ${word(due)} are`} due today, so the fix holds.`,
      key: { label: 'Start Revise', href: '/review/revise', minutes: Math.max(5, Math.ceil(due / 5) * 5) },
      pills: pills(), art: 'object', subject: last?.subject || null, firstWeek, due,
    };
  }
  if (tonightDone) {
    const t = plan.tonight;
    return {
      id: 'done', overline: 'Done for today', number: t.minutes, label: `minutes practised ${moveWord.startsWith('Tonight') ? 'tonight' : 'today'}`,
      why: `Saved at ${clock(t.completedAt)}. ${open > 0 ? `Tomorrow starts with ${plural(open, 'open mistake')} from it.` : 'Tomorrow’s move is planned from it.'}`,
      // The key keeps going (one more session is extra, never owed); the session just saved is one tap away in the pills.
      key: { label: 'Practise more', href: primary?.kind === 'ordinary_practice' ? primary.href : '/dashboard', minutes: null },
      pills: { length: false, second: 'open', openHref: `/result/${encodeURIComponent(t.sessionId)}` }, art: 'object', subject: last?.subject || null, done: true,
    };
  }
  if (open > 0) return repairMove('repair', weekLine || moveWord);

  // The first full mock: in the first week it comes on days 5 to 7 (the path: check and Repair, Revise, smart
  // practice, then the mock); after the first week, once 3 sessions are saved without one.
  const paper = shortestTimedPaper();
  const mockDue = firstWeek ? firstWeek >= 5 : sessions >= 3;
  if (paper && whole(facts?.mocks) && facts.mocks === 0 && mockDue) {
    return {
      id: 'firstMock', overline: weekLine || moveWord, number: paper.questions, label: `questions in ${paper.minutes} minutes`,
      why: `Your first full mock, timed like the real paper. It ${FIRST_TIMED_COPY.unlocks}`,
      key: { label: 'Start a timed mock', href: firstTimedMockHref(facts.subject, paper), minutes: paper.minutes },
      pills: pills(), art: 'object', subject: facts.subject || last?.subject || null, firstWeek,
    };
  }
  // Smart practice is a Pro mode; a free account gets the same aim through the practice move below.
  if (premium && firstWeek && firstWeek < 5 && whole(facts?.mocks) && facts.mocks === 0) {
    const subject = last?.subject || null;
    return {
      id: 'smart', overline: weekLine, number: 15, label: 'questions from your weak chapters',
      why: `Smart practice picks questions from the chapters where your ${subject ? `${subjectName(subject)} ` : ''}marks went, from ${plural(sessions, 'saved session')}.`,
      key: { label: 'Start smart practice', href: `/dashboard?${subject ? `subject=${encodeURIComponent(subject)}&` : ''}mode=smart`, minutes: 15 },
      pills: pills(), art: 'object', subject, firstWeek,
    };
  }

  // Ordinary practice: the plan's own session, aimed at the chapter with the most marks open.
  const count = length === 10 ? 10 : 20;
  const href = primary?.kind === 'ordinary_practice' ? primary.href : `/dashboard?mode=quick&count=${count}`;
  const aim = top?.subject && top?.chapter ? `${href}${href.includes('?') ? '&' : '?'}${new URLSearchParams({ subject: top.subject, chapter: top.chapter })}` : href;
  return {
    id: 'practice', overline: weekLine || moveWord, number: count, label: top?.chapter ? `questions on ${top.chapter}` : 'practice questions',
    why: top?.chapter ? `${top.chapter} has ${plural(top.open, 'mark')} open in your record, over ${plural(top.sessions, 'session')}.${sparseClause}` : `Marked +5 and −1, the CUET way. Each miss waits in Review with its explanation.${sparseClause}`,
    key: { label: `Start ${count} questions`, href: aim, minutes: length },
    link: top?.chapter ? { label: 'See why', href: '/mentor?tab=record' } : null,
    pills: pills(), art: 'object', subject: top?.subject || last?.subject || null, firstWeek,
    chapter: top?.chapter || null, chapterOpen: top?.chapter ? top.open : null, chapterSessions: top?.chapter ? top.sessions : null,
  };
}

/** The move's overline by the IST hour: "Tonight’s move" from 5 PM to 4 AM, when most sessions happen, else "Today’s move". */
export function moveOverline(now = Date.now()) {
  const h = new Date(now + 19800000).getUTCHours();
  return h >= 17 || h < 4 ? 'Tonight’s move' : 'Today’s move';
}

/** For display only: a day and its month ('6 Oct') and a mark count ('6-mark') never break across lines. */
export const keepTogether = (s) => String(s ?? '').replace(/(\d{1,2}) (Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\b/g, '$1\u00a0$2').replace(/(\d)-mark/g, '$1\u2011mark');

/** 8:41 PM in IST. */
export function clock(at) {
  const t = typeof at === 'number' ? at : Date.parse(at || '');
  if (!Number.isFinite(t)) return 'earlier tonight';
  const d = new Date(t + 19800000);
  const h = d.getUTCHours();
  return `${h % 12 || 12}:${String(d.getUTCMinutes()).padStart(2, '0')} ${h < 12 ? 'AM' : 'PM'}`;
}

/**
 * The other moves for Something else, each with its reason (one tap from Today; FEATURE-ADOPTION 8: each feature
 * named at its moment). Never the move already on the card.
 */
export function alternatives({ move, papers = null, revise = null, facts = null, repaired = null, mobUnsat = false, subjectName = (id) => id }) {
  const last = papers?.[0] || null;
  const open = openMistakes(last, repaired);
  const out = [];
  if (open > 0) out.push({ id: 'repair', title: 'Repair a mistake', reason: `${plural(open, 'open mistake')} on ${paperName(last, subjectName)}.`, href: `/result/${encodeURIComponent(last.id)}` });
  if (whole(revise?.due) && revise.due > 0) out.push({ id: 'revise', title: 'Revise what came back', reason: `${plural(revise.due, 'question')} due today.`, href: '/review/revise' });
  out.push({ id: 'quick', title: 'Quick practice', reason: 'Pick the subject, chapters and length yourself.', href: '/dashboard?mode=quick' });
  out.push({ id: 'another', title: 'Another subject', reason: 'Practice opens on every subject you study.', href: '/dashboard' });
  const paper = shortestTimedPaper();
  if (paper) out.push({ id: 'mock', title: 'Full mock', reason: `${paper.questions} questions in ${paper.minutes} minutes, a fresh paper from the bank each time.`, href: firstTimedMockHref(facts?.subject || last?.subject || null, paper) });
  out.push({ id: 'nta', title: 'NTA mode', reason: 'The dress rehearsal: the real paper’s screen, clock and rules.', href: '/dashboard?mode=nta' });
  if (mobUnsat) out.push({ id: 'mob', title: 'Sit this week’s Mob paper', reason: 'Everyone in your Mob sits the same 10 questions.', href: '/mob' });
  out.push({ id: 'review', title: 'Review your papers', reason: whole(papers?.length) && papers.length ? `${plural(papers.length, 'paper')} saved, every answer explained.` : 'Every answer, explained.', href: '/review' });
  return out.filter((a) => a.href !== move?.key?.href && a.id !== move?.id);
}

/**
 * The move at a length the student chose (Change length: 10, 20 or 30 minutes). Practice sets its question count
 * (Quick practice allows 20 at most; 30 minutes adds 10 of review, practiceForMinutes); a repair or Revise move takes
 * as many as fit (about 3 minutes a repair, 1 a Revise question), never more than are open.
 */
export function fitMove(move, chosen) {
  if (!move || ![10, 20, 30].includes(chosen)) return move;
  if (['repair', 'firstRepair', 'returning'].includes(move.id) && move.open > 0) {
    const n = Math.min(move.open, Math.max(1, Math.floor(chosen / 3)));
    // D15: one label for a mistake to repair; priority is shown by order and the why line ("start with three"), never by "first".
    return { ...move, number: n, label: n === 1 ? 'mistake to repair' : 'mistakes to repair', key: { ...move.key, minutes: chosen } };
  }
  if (move.id === 'revise' && move.due > 0) {
    const n = Math.min(move.due, chosen);
    return { ...move, number: n, label: n === 1 ? 'mistake comes back today' : 'mistakes come back today', key: { ...move.key, minutes: Math.max(5, Math.ceil(n / 5) * 5) } };
  }
  if (['practice', 'dayOne', 'weakest'].includes(move.id) || (move.id === 'returning' && !move.open)) {
    const count = chosen === 10 ? 10 : 20;
    const href = move.key.href.replace(/([?&])count=\d+/, `$1count=${count}`);
    return { ...move, number: count, key: { ...move.key, href, minutes: chosen, label: ['dayOne', 'weakest'].includes(move.id) ? move.key.label : `Start ${count} questions` }, review: chosen === 30 ? 10 : 0 };
  }
  return move;
}
