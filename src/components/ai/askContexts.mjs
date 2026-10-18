// What each screen tells Ask Mobi when it opens the panel (ASK-MOBI-1018, section 3). Pure, so a test holds every label and
// every figure. A screen sends what it is about, never a transcript: a question's reference and short labels, a mock's own
// chapter figures, Today's reason and the plan's record facts, Practice's weakest chapter. Every figure here is read from
// data the screen already holds; nothing is invented, and a line with no data behind it is left out.
//
// One label everywhere (D15): "Ask Mobi about Q7", "Ask Mobi about this mock", "Ask Mobi what to practise", "Why this?".
import { askLabel } from '../../../data/repair_check_client.mjs';

const QUESTION_REF = /^[A-Za-z0-9_-]{1,80}:[A-Za-z0-9_-]{1,80}$/;
const PLAIN_REF = /^[A-Za-z0-9_-]{1,80}$/;
const OPTION_LABEL_CAP = 28;

const clean = (value) => String(value ?? '').replace(/[\u0000-\u001f<>]/g, ' ').replace(/\s+/g, ' ').trim();
const plural = (n, one, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;
const whole = (n) => Number.isInteger(n) && n >= 0;

export const ENTRY_LABELS = Object.freeze({
  mock: 'Ask Mobi about this mock',
  session: 'Ask Mobi about this session',
  practice: 'Ask Mobi what to practise',
  today: 'Why this?',
});

/** "Ask Mobi about Q7", the one label for a question wherever it appears. */
export const questionEntryLabel = (number) => askLabel(Number.isInteger(number) && number > 0 ? number : null).replace('this mistake', 'this question');

/** The link a plain click falls back to (no panel mounted, or a modifier-click): the question's own hand-off, else the record page. */
export function fallbackHref(context) {
  return context?.kind === 'question' && context.ref ? `/mentor?tab=ask&q=${encodeURIComponent(context.ref)}` : '/mentor';
}

/** The reference the panel and the routes use for one question, or null when an id could not be sent safely. */
export function questionRefOf(attemptId, questionId) {
  const ref = `${attemptId ?? ''}:${questionId ?? ''}`;
  return QUESTION_REF.test(ref) ? ref : null;
}

/** An option's text as a short label ("9:6:5", "₹4,000"), or null when it is a sentence that would not read inside another. */
export function optionLabel(text) {
  const value = clean(text);
  return value && value.length <= OPTION_LABEL_CAP ? value : null;
}

/**
 * The context for one question. `pickText` and `keyText` are the option texts as the screen shows them; each becomes a short
 * label only when it is short. `hasKey` false (a key under re-check) sends no key label. `blank`: the student left it blank.
 */
export function questionContext({ attemptId, questionId, number = null, chapter = null, pickText = null, keyText = null, hasKey = true, blank = false } = {}) {
  const ref = questionRefOf(attemptId, questionId);
  if (!ref) return null;
  return {
    kind: 'question', ref,
    number: Number.isInteger(number) && number > 0 ? number : null,
    chapter: clean(chapter) || null,
    pickLabel: blank ? null : optionLabel(pickText),
    keyLabel: hasKey ? optionLabel(keyText) : null,
    blank: Boolean(blank),
  };
}

/** Whether the screen can offer Ask Mobi about this question: a wrong answer or a blank, with its key not under re-check. */
export function canAskAboutQuestion({ verdict, held = false } = {}) {
  return !held && (verdict === 'wrong' || verdict === 'skipped');
}

/**
 * The context for a whole paper: its label ("Mock 3" when the paper names itself) and the chapter figures that answer
 * "where did the marks go", from the session analysis the result page already holds (marks lost by chapter). With nothing
 * missed there are no lines, and the panel answers from the record instead.
 */
export function mockContext({ attemptId, label = null, analysis = null } = {}) {
  const marks = analysis?.marks;
  const lines = [];
  if (marks && whole(marks.gap) && marks.gap > 0 && whole(marks.max)) {
    lines.push(`You missed ${marks.gap} of ${marks.max} marks.`);
    for (const c of (analysis.chapters || []).slice(0, 3)) {
      if (!c?.chapter || !whole(c.gap) || c.gap <= 0) continue;
      const parts = [c.wrong ? `${c.wrong} wrong` : null, c.blank ? `${c.blank} blank` : null].filter(Boolean).join(' and ');
      lines.push(`${clean(c.chapter)}: ${plural(c.gap, 'mark')}${parts ? `, from ${parts}` : ''}.`);
    }
  }
  return {
    kind: 'mock',
    ref: attemptId && PLAIN_REF.test(String(attemptId)) ? String(attemptId) : null,
    label: clean(label) || null,
    lines,
  };
}

/** What names the paper in the panel's chip: the paper's own name ("Mock 3"), else "This mock" for a mock or "This session". */
export function mockLabel({ source = null, mode = null } = {}) {
  const own = clean(source);
  if (own) return own;
  return mode === 'full' || mode === 'nta' ? 'This mock' : 'This session';
}

/** The entry line for a paper: "this mock" for a mock, "this session" for practice. */
export const mockEntryLabel = (mode) => (mode === 'full' || mode === 'nta' ? ENTRY_LABELS.mock : ENTRY_LABELS.session);

/**
 * Today's "Why this?" (release 9). The card already shows the reason, so the answer leads with what the card does not say: which
 * mistakes (the chapters of today's Revise questions, from the Revise read), and the chapter's own record (how many wrong and blank,
 * when it was last missed, the marks at stake). Every record count in the answer comes from the same insights read as the panel's
 * "Your record" chip (todayAnswer, called by the panel with its own read), so the answer and the chip can never disagree; the plan's
 * separate fact lines ("2 saved sessions") are no longer sent. `revise` is Today's Revise read ({ due, chapters: [{ chapter, n }] }).
 */
export function todayContext({ move = null, revise = null } = {}) {
  if (!move || move.id === 'failed') return null;
  const reason = clean(move.why);
  const lines = [];
  const due = move.id === 'revise' && whole(move.number) && move.number > 0 ? move.number : null;
  const parts = Array.isArray(revise?.chapters) ? revise.chapters.filter((c) => clean(c?.chapter) && whole(c?.n) && c.n > 0) : [];
  // Only when the chapters account for every question on the card, so the count in the line is the card's own count.
  if (due && parts.length && parts.reduce((t, c) => t + c.n, 0) === due) {
    const named = parts.slice(0, 3).map((c) => `${c.n} from ${clean(c.chapter)}`);
    const rest = parts.slice(3).reduce((t, c) => t + c.n, 0);
    if (rest) named.push(`${rest} from other chapters`);
    lines.push(`Today's ${due}: ${named.length > 1 ? `${named.slice(0, -1).join(', ')} and ${named[named.length - 1]}` : named[0]}.`);
  }
  const chapter = clean(move.chapter) || (due && parts.length ? clean(parts[0].chapter) : '') || null;
  return { kind: 'today', label: 'Today', reason: reason || null, chapter, lines };
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
/** 'Thu 15 Oct' in India time, or '' for an unknown time. */
function dayIn(at) {
  const t = typeof at === 'number' ? at : Date.parse(at || '');
  if (!Number.isFinite(t) || t < Date.UTC(2020, 0, 1)) return ''; // no real paper is older: anything earlier is not a time
  const d = new Date(t + 19800000);
  return `${DAYS[d.getUTCDay()]} ${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]}`;
}

/**
 * The opening answer for Today's "Why this?": { reply, record } where `record` says the counts came from the insights read. With the
 * record unreadable it is the card's reason and the context's own lines (nothing invented), else the context's lines then the
 * chapter's record: the chapter named by the card, else the chapter with the most marks open.
 */
export function todayAnswer({ context = {}, insights = null } = {}) {
  const own = (context.lines || []).map(clean).filter(Boolean);
  if (insights?.state !== 'ready') {
    const reply = [context.reason, ...own].filter(Boolean).join(' ');
    return reply ? { reply, record: false } : null;
  }
  const rows = [...(insights.chapters?.ranked || []), ...(insights.chapters?.thin || [])];
  const want = clean(context.chapter).toLowerCase();
  const named = want ? rows.find((c) => clean(c?.chapter).toLowerCase() === want) || null : null;
  const c = named || insights.chapters?.ranked?.[0] || null;
  const lines = [...own];
  if (c && whole(c.wrong) && whole(c.skip) && whole(c.n) && c.n > 0) {
    const missed = c.wrong + c.skip;
    const how = [c.wrong ? `${c.wrong} wrong` : null, c.skip ? `${c.skip} left blank` : null].filter(Boolean).join(' and ') || 'nothing missed';
    const over = whole(c.sessions) && c.sessions > 0 ? ` over ${plural(c.sessions, 'session')}` : '';
    lines.push(`${named ? '' : 'Most of your open marks are in '}${clean(c.chapter)}: ${how}, of ${plural(c.n, 'question')}${over}.`);
    const last = dayIn(c.recent?.[0]?.completedAt ?? c.last);
    if (missed > 0 && last) lines.push(`The last miss there was on ${last}.`);
    const open = insights.ledger?.open;
    if (missed > 0 && whole(c.open)) lines.push(`Those ${plural(missed, 'question')} were worth ${c.open} marks${whole(open) && open >= c.open ? `, of the ${open} open in your record` : ''}.`);
  }
  const reply = lines.join(' ') || clean(context.reason);
  return reply ? { reply, record: lines.length > own.length } : null;
}

/** The weakest chapter's record line for Practice's row: "Partnership: 11 wrong of 34 answered", or null without one. */
export function practicePreview(insights) {
  if (insights?.state !== 'ready') return null;
  const c = insights.chapters?.ranked?.[0];
  if (!c || !whole(c.wrong) || !whole(c.n) || c.n <= 0) return null;
  return `${clean(c.chapter)}: ${c.wrong} wrong of ${c.n} answered`;
}

/** The context for Practice: the weakest chapter by name when the record has one. */
export function practiceContext(insights) {
  const c = insights?.state === 'ready' ? insights.chapters?.ranked?.[0] : null;
  return { kind: 'practice', chapter: c?.chapter ? clean(c.chapter) : null };
}
