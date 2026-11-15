// /preview/arena: the Sunday Mock against fixtures, in the shapes its routes answer (src/lib/server/sunday/service.js). Development
// only; nothing is written. Each state is drawn at a fixed instant, so it looks the same whatever day it is opened.
//   &sunday=  sat (Saturday evening) | sunmorning (Sunday 8:00 AM) | open (Sunday 11:00 AM, three subjects) | open1 (one subject)
//             | some (one sat, two open) | started (a paper running) | waiting (all sat, answers at 10:00 PM) | closed (Sunday
//             10:30 PM, one sat, 1,240 sat it) | none (closed, not sat) | monday (yesterday's result) | weekday (Wednesday)
//             | nosubjects | off | error | loading. Without it: the real clock, nothing sat.
//   &sundayden=  before | open (default on a real Sunday) | closed | notyours | off — the den's block (?view=mob&mob=den)
//   &sundaystart= closed | notopen | expired | notyours | unavailable — the runner's refusals (?view=test&sunday=1...)
//   &attempt=fixture-sunday with &sundaypaper=held | open (default) | few — a Sunday paper's result; &sundaystats=few|down
import { sundayHoldCopy, sundayOf, sundayState, sundayTag } from '@/lib/sundayMock.mjs';
import { heldAttemptView } from '@/lib/mob/paperHold.mjs';
import { fixtureMock } from './previewMock';

const IST = (s) => Date.parse(`${s}+05:30`);
const SUBJECTS = [['accountancy', 'Accountancy'], ['economics', 'Economics'], ['business_studies', 'Business Studies']];
const AT = {
  sat: '2026-11-21T18:00:00', sunmorning: '2026-11-22T08:00:00', open: '2026-11-22T11:00:00', open1: '2026-11-22T11:00:00', some: '2026-11-22T14:00:00',
  started: '2026-11-22T11:20:00', waiting: '2026-11-22T17:30:00', closed: '2026-11-22T22:30:00', none: '2026-11-22T22:30:00',
  monday: '2026-11-23T08:30:00', weekday: '2026-11-18T12:00:00', nosubjects: '2026-11-22T11:00:00',
};
const iso = (ms) => new Date(ms).toISOString();
const marks = (correct, wrong) => ({ scored: correct * 5 - wrong, max: 250 });

function status(kind) {
  const t = AT[kind] ? IST(AT[kind]) : Date.now();
  const st = sundayState(t);
  const base = { week: st.week, phase: st.phase, dow: st.dow, serverNow: t, opensAt: iso(st.opensAt), closesAt: iso(st.closesAt), next: st.next, previous: null };
  const list = kind === 'open1' ? SUBJECTS.slice(0, 1) : kind === 'nosubjects' ? [] : SUBJECTS;
  const plain = st.phase === 'open' ? 'open' : st.phase === 'before' ? 'soon' : 'closed';
  const subjects = list.map(([id, name], i) => {
    const s = { id, name, state: plain };
    if (kind === 'some' && i === 0) Object.assign(s, { state: 'sat', resultId: 'fixture-sunday', marks: marks(34, 10) });
    if (kind === 'started' && i === 0) Object.assign(s, { state: 'started', resumeUntil: iso(IST('2026-11-22T11:02:00') + 60 * 60_000) });
    if (kind === 'waiting') Object.assign(s, { state: 'sat', resultId: 'fixture-sunday', marks: marks(30 + i * 4, 9 - i) });
    if (kind === 'closed' && i === 0) Object.assign(s, { state: 'sat', resultId: 'fixture-sunday', marks: marks(34, 10), sat: 1240 });
    return s;
  });
  if (kind === 'monday') base.previous = { week: st.previous, subjects: [{ id: 'accountancy', name: 'Accountancy', state: 'sat', resultId: 'fixture-sunday', marks: marks(34, 10), sat: 1240 }] };
  return { ...base, subjects };
}

// The den fixture's own members (data/tests/fixtures/mob_v3/den_get.json), you second.
const DEN_MEMBERS = [['Riya', 3, false], ['Aarav', 1, true], ['Kabir', 1, false], ['Zoya', 1, false]];
function den(kind) {
  const t = { before: IST('2026-11-21T18:00:00'), open: IST('2026-11-22T15:00:00'), notyours: IST('2026-11-22T15:00:00'), closed: IST('2026-11-22T22:30:00') }[kind] ?? Date.now();
  const st = sundayState(t);
  const out = { week: st.week, phase: st.phase, dow: st.dow, serverNow: t, opensAt: iso(st.opensAt), closesAt: iso(st.closesAt), next: st.next, available: true, subject: 'accountancy', subjectName: 'Accountancy' };
  if (st.phase === 'before') return { ...out, members: [], you: { state: 'soon' } };
  // Kabir sat and shows his score; Meera sat and keeps it private; Ravi has not sat. You sat only after the close.
  const youSat = st.phase === 'closed';
  const members = DEN_MEMBERS.map(([name, colour, you], i) => {
    // Riya sat and shows her score; Kabir sat and keeps his private; Zoya has not sat.
    const sat = you ? youSat : i === 0 || i === 2;
    const m = { name, colour, you, sat };
    if (sat && (you || i === 0)) m.marks = you ? marks(34, 10) : marks(38, 6);
    return m;
  });
  return { ...out, members, you: youSat ? { state: 'sat', resultId: 'fixture-sunday' } : { state: kind === 'notyours' ? 'not_yours' : 'open' } };
}

const REFUSALS = {
  closed: ['CLOSED', 409], notopen: ['NOT_OPEN', 409], expired: ['PAPER_EXPIRED', 410], notyours: ['NOT_YOUR_SUBJECT', 403], unavailable: ['PAPER_UNAVAILABLE', 503],
};

function sundayAttempt(kind) {
  const built = fixtureMock('full', { checks: 'ready', lab: 'on' });
  const attempt = JSON.parse(JSON.stringify(built.attempt));
  if (kind === 'held') {
    // Held until tonight's 10:00 PM on the real clock (the hold's timer reads the result again at that moment).
    const now = Date.now();
    const week = sundayOf(now);
    // The next 10:00 PM IST from now, so the held page reads as it does on a Sunday afternoon.
    const tonight = Date.parse(`${new Date(now + 330 * 60_000).toISOString().slice(0, 10)}T22:00:00+05:30`);
    const until = tonight > now ? tonight : tonight + 86_400_000;
    attempt.selectionMeta = { ...(attempt.selectionMeta || {}), mobPaper: sundayTag(week) };
    const hold = { until: iso(until), kind: 'sunday', mobId: attempt.selectionMeta.mobPaper.mobId, weekStart: week, ...sundayHoldCopy(until) };
    return heldAttemptView(attempt, hold);
  }
  attempt.selectionMeta = { ...(attempt.selectionMeta || {}), mobPaper: sundayTag('2026-11-15') };
  return { ...attempt, answerReviews: built.answerReviews, swot: built.swot, mistakeInsights: built.mistakeInsights, lab: built.lab, missedBefore: {}, answerReviewState: built.answerReviewState };
}

/** The Sunday Mock's preview answers, or null for a path that is not its own. */
export function previewSunday(url, method, init, fixture, json) {
  const path = url.pathname;
  if (path === '/api/attempts/fixture-sunday') return json(sundayAttempt(fixture.get('sundaypaper') || 'open'));
  if (path !== '/api/sunday' && !path.startsWith('/api/sunday/')) return null;
  const kind = fixture.get('sunday') || '';
  if (kind === 'off') return json({ error: 'SUNDAY_OFF' }, 404);
  if (path === '/api/sunday') {
    if (kind === 'loading') return new Promise(() => {});
    if (kind === 'error') return json({ error: 'UNAVAILABLE' }, 503);
    return json(status(kind));
  }
  if (path === '/api/sunday/mob') {
    const d = fixture.get('sundayden') || '';
    if (d === 'off') return json({ error: 'SUNDAY_OFF' }, 404);
    return json(den(d || (sundayState(Date.now()).phase === 'before' ? 'before' : 'open')));
  }
  if (path === '/api/sunday/stats') {
    if (fixture.get('sundaystats') === 'down') return json({ error: 'UNAVAILABLE' }, 503);
    const few = fixture.get('sundaystats') === 'few' || fixture.get('sundaypaper') === 'few';
    const ids = (fixtureMock('full', { checks: 'ready', lab: 'on' }).attempt.questionsSnapshot || []).map((q) => q.id);
    const shares = few ? null : Object.fromEntries(ids.map((id, i) => [id, 22 + ((i * 37) % 71)]));
    return json({ week: url.searchParams.get('week'), subject: url.searchParams.get('subject'), sat: few ? 18 : 1240, shares, floor: 30, final: true });
  }
  if (path === '/api/sunday/start' && method === 'POST') {
    const refusal = REFUSALS[fixture.get('sundaystart') || ''];
    const st = sundayState(IST('2026-11-22T22:30:00'));
    if (refusal) {
      const [code, statusCode] = refusal;
      const detail = code === 'NOT_YOUR_SUBJECT' || code === 'PAPER_UNAVAILABLE' ? { subjectName: 'Economics' }
        : { week: code === 'NOT_OPEN' ? '2026-11-22' : st.week, opensAt: iso(st.opensAt), closesAt: iso(st.closesAt), next: st.next };
      return json({ error: code, detail }, statusCode);
    }
    const body = JSON.parse(init.body || '{}');
    // The practice start fixture for a 50-question full paper (the same one /api/sessions answers in this preview).
    return window.fetch('/api/sessions', { method: 'POST', body: JSON.stringify({ mode: 'full', count: 50, subject: body.subject }) });
  }
  return json({ error: 'NOT_FOUND' }, 404);
}
