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
 * Today's "Why this?": the reason already on the card, then the plan's own record facts (basis: record) that the reason does
 * not already say, with their denominators. A fact is never repeated. Up to three.
 */
export function todayContext({ move = null, plan = null } = {}) {
  if (!move || move.id === 'failed') return null;
  const reason = clean(move.why);
  const said = reason.toLowerCase();
  const facts = (plan?.primary?.facts || [])
    .filter((f) => f && f.basis === 'record' && clean(f.text))
    .map((f) => clean(f.text))
    .filter((text) => !said.includes(text.toLowerCase().replace(/\.$/, '')));
  return { kind: 'today', label: 'Today', reason: reason || null, lines: [...new Set(facts)].slice(0, 3) };
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
