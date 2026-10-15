// Tonight's move: one rule set, three places (web IA plan 5.2, 15 Oct 2026).
//
// Today's hero, the Start sheet's hero and the last card of a result all call nextMove(). The first
// rule that matches wins. The rules read facts the caller already has (/api/learning, the attempts
// list, the SWOT's plan[0], the wallet); nothing here fetches. Shared JSON fixtures live in
// data/fixtures/next_step/ so the app's TonightPick tests can adopt them later.
//
//   1 resume    a practice or mock is still open (only when the server or device reports it)
//   2 unopened  a result has not been opened
//   3 repair    the latest mock has unrepaired mistakes (needs the mistakeRepair capability)
//   4 check     a fresh check is due (only once Repair v3 A.9 ships: capabilities.freshCheck)
//   5 practise  a weak chapter exists (SWOT plan[0], otherwise the weakest chapter on record)
//   6 mock      no full mock in 7 days (and at least one session on record)
//   7 first     day one: no session yet
//   8 quick     fallback, so the hero is never empty: 10 questions in the next subject
//
// After 3 or more days away, `away.line` ("Your last mock was on 9 Oct") sits above the hero.
// Today shows one primary; the rest sit behind "Something else instead" (`others`).
// Copy rules: sentence case, no "!", no em dash. Numbers come only from the input and plan_facts.

import { costLine, quickMinutes, repairCostLine, PLAN_FACTS } from './plan_facts.mjs';
import { moveLabel } from './glossary.mjs';
import { subjectName } from './subject_art.mjs';

export const NEXT_STEP_RULES_VERSION = 1;
export const RULE_IDS = Object.freeze(['resume', 'unopened', 'repair', 'check', 'practise', 'mock', 'first', 'quick']);
export const DAY_MS = 86_400_000;
export const AWAY_AFTER_DAYS = 3;
export const MOCK_DUE_DAYS = 7;
export const MOCK_MODES = Object.freeze(['full', 'nta']);
export const PRACTICE_HREF = '/dashboard';
export const REVIEW_HREF = '/review';
export const OTHERS_LABEL = 'Something else instead';
export const MORE = Object.freeze({ label: 'Choose your own in Practice', href: PRACTICE_HREF });

/** The app's repair time: 3 minutes a mistake, rounded up to 5 (repair_candidates.dart repairMinutes). */
export function repairMinutes(mistakes) {
  const count = Math.trunc(Number(mistakes) || 0);
  if (count <= 0) return null;
  return Math.ceil((count * 3) / 5) * 5;
}

const plural = (count, word) => `${count} ${word}${count === 1 ? '' : 's'}`;
const isMock = (mode) => MOCK_MODES.includes(String(mode || ''));
const kindWord = (mode) => (isMock(mode) ? 'mock' : 'practice');
const time = (value) => {
  const t = typeof value === 'number' ? value : Date.parse(value);
  return Number.isFinite(t) ? t : null;
};
const nameOf = (subject, fallbackName) => fallbackName || subjectName(subject) || 'your subject';

/** A local path inside MockMob, or null. Rejects other origins, protocol-relative and script URLs. */
export function safeHref(href, { prefixes = null } = {}) {
  const value = String(href || '');
  if (!value.startsWith('/') || value.startsWith('//') || /[\s\\]/.test(value)) return null;
  if (prefixes && !prefixes.some((p) => value === p || value.startsWith(`${p}?`) || value.startsWith(`${p}/`) || value.startsWith(`${p}#`))) return null;
  return value;
}

/** /dashboard set up for a session. Nothing is charged until Start on the confirm line. */
export function practiceHref({ subject = null, mode = 'quick', count = null, chapter = null } = {}) {
  const q = new URLSearchParams();
  if (subject) q.set('subject', subject);
  q.set('mode', mode);
  if (count) q.set('count', String(count));
  if (chapter) q.set('chapter', chapter);
  return `${PRACTICE_HREF}?${q.toString()}`;
}

function dayKey(t, timeZone) {
  return new Intl.DateTimeFormat('en-CA', { year: 'numeric', month: '2-digit', day: '2-digit', timeZone }).format(new Date(t));
}

/** "9 Oct" in the student's time zone. */
export function shortDate(t, timeZone = 'Asia/Kolkata') {
  return new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', timeZone }).format(new Date(t));
}

/** "today's", "yesterday's", "Tuesday's" (within 6 days) or "the 9 Oct". */
export function whenWord(t, now, timeZone = 'Asia/Kolkata') {
  const days = Math.round((Date.parse(dayKey(now, timeZone)) - Date.parse(dayKey(t, timeZone))) / DAY_MS);
  if (days <= 0) return "today's";
  if (days === 1) return "yesterday's";
  if (days < 7) return `${new Intl.DateTimeFormat('en-GB', { weekday: 'long', timeZone }).format(new Date(t))}'s`;
  return `the ${shortDate(t, timeZone)}`;
}

/** The student's subjects in sheet order, as ids. */
function sheetSubjects(input) {
  return (input.subjects || []).map((s) => (typeof s === 'string' ? s : s?.id)).filter(Boolean);
}

function sortedAttempts(input) {
  return (input.attempts || [])
    .map((a) => ({ ...a, at: time(a.completedAt) }))
    .filter((a) => a.at !== null)
    .sort((a, b) => b.at - a.at);
}

/** The subject for a full mock: the sheet subject whose last mock is oldest (never mocked first). */
function mockSubject(input, attempts) {
  const sheet = sheetSubjects(input);
  const pool = sheet.length ? sheet : [...new Set(attempts.map((a) => a.subject).filter(Boolean))];
  if (!pool.length) return null;
  const lastMock = (s) => attempts.find((a) => a.subject === s && isMock(a.mode))?.at ?? -Infinity;
  return [...pool].sort((a, b) => lastMock(a) - lastMock(b))[0];
}

/** The subject for a quick set: the first sheet subject, else the latest session's subject. */
function quickSubject(input, attempts) {
  return sheetSubjects(input)[0] || attempts[0]?.subject || null;
}

/** Every rule that matches, in rule order. Each candidate is complete; nextMove() picks the first. */
export function candidates(input = {}) {
  const now = time(input.now) ?? Date.now();
  const timeZone = input.timeZone || 'Asia/Kolkata';
  const pro = input.plan === 'pro';
  const balance = input.practiceCredits ?? null;
  const caps = { mistakeRepair: true, freshCheck: false, ...(input.capabilities || {}) };
  const attempts = sortedAttempts(input);
  const out = [];

  // 1. An open session the server (or this device) reports.
  const open = input.openSession;
  if (open && Number(open.total) > 0) {
    const answered = Math.max(0, Math.min(Number(open.answered) || 0, Number(open.total)));
    out.push({ id: 'resume', rule: 1, title: `Resume ${nameOf(open.subject, open.subjectName)} ${kindWord(open.mode)}, ${answered} of ${Number(open.total)}`,
      detail: null, cost: null, primary: { label: 'Resume', href: safeHref(open.href, { prefixes: ['/test'] }) || PRACTICE_HREF } });
  }

  // 2. A result not yet opened.
  const unopened = input.unopenedResult;
  if (unopened?.attemptId) {
    out.push({ id: 'unopened', rule: 2, title: `Your ${nameOf(unopened.subject, unopened.subjectName)} result is ready`,
      detail: null, cost: null, primary: { label: 'Open your result', href: `/result/${encodeURIComponent(unopened.attemptId)}` } });
  }

  // 3. Unrepaired mistakes from the latest mock.
  const repair = input.repair;
  const openMistakes = Math.trunc(Number(repair?.open) || 0);
  if (caps.mistakeRepair && repair?.attemptId && openMistakes > 0) {
    const at = time(repair.completedAt);
    const from = at === null ? `your last ${kindWord(repair.mode)}` : `${whenWord(at, now, timeZone)} ${kindWord(repair.mode)}`;
    out.push({ id: 'repair', rule: 3, title: `Repair ${plural(openMistakes, 'mistake')} from ${from}, about ${repairMinutes(openMistakes)} minutes`,
      detail: null, cost: repairCostLine({ aiBalance: input.aiCredits ?? null }),
      // The result page opens on the hero whose one filled button starts the repair (Repair v3 B.5).
      primary: { label: 'Start repair', href: `/result/${encodeURIComponent(repair.attemptId)}` } });
  }

  // 4. A fresh check, only once the check exists (A.9). Never promised before.
  const due = Math.trunc(Number(input.freshCheck?.due) || 0);
  if (caps.freshCheck && due > 0) {
    out.push({ id: 'check', rule: 4, title: `Check ${plural(due, 'repaired question')}, free`, detail: null, cost: null,
      primary: { label: 'Start check', href: safeHref(input.freshCheck.href) || REVIEW_HREF } });
  }

  // 5. A weak chapter: the SWOT's plan[0] first, otherwise the weakest chapter on record.
  const weak = input.weakChapter;
  if (weak?.chapter && weak?.subject) {
    const count = Number(weak.count) > 0 ? Math.trunc(Number(weak.count)) : 10;
    const href = safeHref(weak.href, { prefixes: [PRACTICE_HREF] }) || practiceHref({ subject: weak.subject, mode: 'quick', count, chapter: weak.chapter });
    out.push({ id: 'practise', rule: 5, title: `Practise ${weak.chapter}, ${plural(count, 'question')}`,
      detail: weak.reason ? String(weak.reason) : null, cost: costLine('quick', { pro, balance }), primary: { label: 'Set up', href } });
  }

  // 6. No full mock in 7 days, for a student who has started.
  if (attempts.length) {
    const lastMock = attempts.find((a) => isMock(a.mode));
    if (!lastMock || now - lastMock.at >= MOCK_DUE_DAYS * DAY_MS) {
      const subject = mockSubject(input, attempts);
      if (subject) {
        out.push({ id: 'mock', rule: 6, title: `Full mock, ${nameOf(subject)}, ${PLAN_FACTS.sessions.fullMinutes.value} minutes`,
          detail: null, cost: costLine('full', { pro, balance }), primary: { label: 'Set up', href: practiceHref({ subject, mode: 'full' }) } });
      }
    }
  }

  // 7. Day one.
  if (!attempts.length) {
    const subject = quickSubject(input, attempts);
    const where = subject ? ` in ${nameOf(subject)}` : '';
    out.push({ id: 'first', rule: 7, label: 'Your first move', title: `10 questions${where}, about ${quickMinutes(10)} minutes`,
      detail: null, cost: costLine('quick', { pro, balance }), primary: { label: 'Start now', href: practiceHref({ subject, mode: 'quick', count: 10 }) },
      secondary: { label: `Sit a full mock instead (${PLAN_FACTS.sessions.fullQuestions.value} questions, ${PLAN_FACTS.sessions.fullMinutes.value} minutes)`, href: practiceHref({ subject, mode: 'full' }) } });
  }

  // 8. Fallback: keep going in the next subject.
  if (attempts.length) {
    const subject = quickSubject(input, attempts);
    out.push({ id: 'quick', rule: 8, title: `10 questions${subject ? ` in ${nameOf(subject)}` : ''}, about ${quickMinutes(10)} minutes`,
      detail: null, cost: costLine('quick', { pro, balance }), primary: { label: 'Set up', href: practiceHref({ subject, mode: 'quick', count: 10 }) } });
  }
  return out;
}

/** "Your last mock was on 9 Oct" after 3 or more days away, else null. */
export function awayLine(input = {}) {
  const now = time(input.now) ?? Date.now();
  const last = sortedAttempts(input)[0];
  if (!last) return null;
  const days = Math.floor((now - last.at) / DAY_MS);
  if (days < AWAY_AFTER_DAYS) return null;
  return { days, line: `Your last ${kindWord(last.mode)} was on ${shortDate(last.at, input.timeZone || 'Asia/Kolkata')}` };
}

/**
 * The move for this student. Always returns a move (rule 8 is the fallback; rule 7 covers day one).
 * {
 *   id, rule, label ("Tonight's move" | "Today's move" | "Your first move"), title, detail, cost,
 *   primary: { label, href }, secondary?: { label, href },
 *   away: { days, line } | null, others: [{ id, title, label, href }] (at most 3),
 *   othersLabel: 'Something else instead', more: { label: 'Choose your own in Practice', href: '/dashboard' }
 * }
 */
export function nextMove(input = {}) {
  const all = candidates(input);
  const [first, ...rest] = all;
  const now = time(input.now) ?? Date.now();
  return {
    version: NEXT_STEP_RULES_VERSION,
    ...first,
    label: first.label || moveLabel(now, { timeZone: input.timeZone || 'Asia/Kolkata' }),
    away: awayLine(input),
    others: rest.slice(0, 3).map((c) => ({ id: c.id, title: c.title, label: c.primary.label, href: c.primary.href })),
    othersLabel: OTHERS_LABEL,
    more: MORE,
  };
}

/**
 * Builds the rules' input from the SWOT (Repair v3 C.2): plan[0] becomes the weak chapter, with its
 * own href and reason. Returns null when the SWOT is not ready or has no plan.
 */
export function weakChapterFromSwot(swot) {
  if (!swot || swot.state !== 'ready' || !Array.isArray(swot.plan) || !swot.plan.length) return null;
  const p = swot.plan[0];
  if (!p?.practice?.subject || !p.practice.chapter) return null;
  return { subject: p.practice.subject, chapter: p.practice.chapter, count: p.practice.count, href: p.href, reason: p.reason, source: 'swot' };
}
