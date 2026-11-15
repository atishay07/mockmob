// The Sunday Mock's server logic (src/lib/sundayMock.mjs has the rules and the words). No 'server-only' and no alias imports,
// so node:test drives it with in-memory fakes (data/tests/sunday_mock.test.mjs); ./deps.js wires production.
//
// The free start, and why it cannot open any other paper:
//   - The practice engine's free Mob-paper path (startPractice's third argument, server.mobPaper) is never reachable from a
//     request: POST /api/sessions does not pass it. This service is its only other caller, and it passes exactly one thing:
//     this week's frozen Sunday paper for one of the student's own subjects, tagged with SUNDAY_TAG.
//   - From the request it takes the subject and the start receipt, nothing else. The week comes from the server's clock, the
//     questions from the frozen paper, the mode and count are the Full mock's, and the generation key is an HMAC of the
//     student, the Sunday and the subject made here, so each student has one session id per Sunday and subject.
//   - A first start is allowed only inside the window (Sunday 10:00 AM to 9:59 PM IST). A start already on record resumes
//     (another device, a lost draft) until its own deadline, which the engine keeps from the first start (practiceStart.js).
//   - One sitting: the session id is the same on every start, so once sent the engine answers SESSION_ALREADY_SUBMITTED, and
//     an abandoned sitting past its 60 minutes answers SESSION_EXPIRED. The claim row (learning_allowances) records the start.
//   - The send: finishPractice and finishSession refuse a paper more than 2 minutes past its deadline (SESSION_EXPIRED), and
//     the counts take only sittings finished inside the window's last legal minute (countsFor).
import { createHmac } from 'node:crypto';
import {
  MIN_FROZEN, PAPER_COUNT, SHARE_FLOOR, claimPeriod, claimReference, countsFor, isWeekKey, marksOf, startRefusal,
  subjectState, sundayState, sundayStats, sundayTag, sundayWindow,
} from '../../sundayMock.mjs';
import { subjectSpellings } from './store.js';

const MINUTE = 60_000;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const STATUS = {
  BODY_INVALID: 400, SUBJECT_NOT_SUPPORTED: 400, INVALID_START_RECEIPT: 400, NOT_YOUR_SUBJECT: 403, NOT_IN_MOB: 404,
  NOT_OPEN: 409, CLOSED: 409, NOT_CLOSED: 409, SESSION_ALREADY_SUBMITTED: 409, PAPER_EXPIRED: 410, PAPER_UNAVAILABLE: 503, UNAVAILABLE: 503,
};

export class SundayError extends Error {
  constructor(code, { message = null, detail = null, cause = null } = {}) {
    super(code);
    this.code = code;
    this.status = STATUS[code] || 500;
    this.publicMessage = message;
    this.detail = detail;
    if (cause) this.cause = cause;
  }
}

/** The practice session's generation key for one student, Sunday and subject: the same on every start, unguessable without the secret. */
export function sundayGenerationKey(secret, userId, week, subject) {
  return `sunday_${createHmac('sha256', String(secret || 'sunday')).update(`sunday:${week}:${subject}:${userId}`).digest('hex').slice(0, 40)}`;
}

const iso = (ms) => new Date(ms).toISOString();
const same = (a, b) => Array.isArray(a) && Array.isArray(b) && a.length === b.length && a.every((x, i) => x === b[i]);

/**
 * deps: {
 *   now() -> ms, secret
 *   store                                    ./store.js (or an in-memory one in tests)
 *   loadUser(userId) -> { subjects } | null  the student's goal subjects
 *   subjectInfo(raw) -> { ok, id, publicId, name }   a launchable subject: its stored id, public id and official name
 *   pickPaper(subject, week, { exclude }) -> ids     the Full mock selector over the central bank, no personal exclusions
 *   loadQuestions(ids) -> questions in that order (withdrawn ones left out)
 *   serve(question) -> question              the stable option order every surface serves (data/option_order.js servedOut)
 *   startPractice(userId, input, server)     src/lib/server/practiceSessions.js
 * }
 */
export function createSundayService(deps) {
  const now = () => (deps.now ? deps.now() : Date.now());
  const store = deps.store;
  const papers = new Map(); // period -> frozen ids, once a start served them (per server, never changes for a period)
  const cache = new Map(); // `${kind}:${week}:${subject}` -> { until, value }

  const remember = (map, key, value, max = 64) => {
    map.delete(key);
    map.set(key, value);
    while (map.size > max) map.delete(map.keys().next().value);
  };
  const cached = async (key, ttl, read) => {
    const hit = cache.get(key);
    if (hit && hit.until > now()) return hit.value;
    const value = await read();
    remember(cache, key, { until: now() + ttl, value }, 200);
    return value;
  };

  /** The student's goal subjects as launchable subjects, in their own order, once each. */
  function mySubjects(user) {
    const out = [];
    const seen = new Set();
    for (const raw of Array.isArray(user?.subjects) ? user.subjects : []) {
      const info = deps.subjectInfo(raw);
      if (!info?.ok || seen.has(info.id)) continue;
      seen.add(info.id);
      out.push(info);
    }
    return out;
  }
  const loadUser = async (userId) => {
    try { return await deps.loadUser(userId); } catch (cause) { throw new SundayError('UNAVAILABLE', { cause }); }
  };
  const store_ = async (fn) => {
    try { return await fn(); } catch (cause) { throw cause instanceof SundayError ? cause : new SundayError('UNAVAILABLE', { cause }); }
  };

  /** How many sat a closed week's paper in a subject (cached; null when the read failed). */
  async function satCount(week, subject) {
    const win = sundayWindow(week);
    const ttl = now() < win.lastFinishAt + 5 * MINUTE ? 5 * MINUTE : 6 * 60 * MINUTE;
    try { return await cached(`count:${week}:${subject}`, ttl, () => store.countSat(week, subject)); } catch { return null; }
  }

  async function pick(subject, week, exclude = []) {
    let ids;
    try { ids = await deps.pickPaper(subject, week, { exclude }); } catch (cause) { throw new SundayError('PAPER_UNAVAILABLE', { cause }); }
    return [...new Set((Array.isArray(ids) ? ids : []).filter((id) => typeof id === 'string' && id && !exclude.includes(id)))];
  }

  /** The questions of the frozen paper, with withdrawn ones replaced from the bank while MIN_FROZEN or more still serve. */
  async function paperQuestions(subject, week, ids) {
    let questions = [];
    try { questions = await deps.loadQuestions(ids); } catch (cause) { throw new SundayError('UNAVAILABLE', { cause }); }
    questions = (questions || []).filter(Boolean);
    if (questions.length >= ids.length) return questions.slice(0, PAPER_COUNT);
    if (questions.length < MIN_FROZEN) throw new SundayError('PAPER_UNAVAILABLE');
    const extra = (await pick(subject, week, ids)).slice(0, PAPER_COUNT - questions.length);
    const more = extra.length ? await deps.loadQuestions(extra).catch(() => []) : [];
    const have = new Set(questions.map((q) => q.id));
    for (const q of more || []) if (q && !have.has(q.id) && questions.length < PAPER_COUNT) { have.add(q.id); questions.push(q); }
    if (questions.length < PAPER_COUNT) throw new SundayError('PAPER_UNAVAILABLE');
    return questions;
  }

  function startError(error) {
    if (error instanceof SundayError) return error;
    const m = String(error?.message || '');
    if (/SESSION_ALREADY_SUBMITTED/.test(m)) return new SundayError('SESSION_ALREADY_SUBMITTED', { message: 'You already sent this paper.', detail: error.publicDetail || null, cause: error });
    if (/SESSION_EXPIRED/.test(m)) return new SundayError('PAPER_EXPIRED', { cause: error });
    if (/INVALID_START_RECEIPT/.test(m)) return new SundayError('INVALID_START_RECEIPT', { cause: error });
    if (/INSUFFICIENT_PRACTICE_CONTENT|SUBJECT_NOT_SUPPORTED/.test(m)) return new SundayError('PAPER_UNAVAILABLE', { cause: error });
    return new SundayError('UNAVAILABLE', { cause: error });
  }

  return {
    mySubjects,

    /**
     * GET /api/sunday: this week's Sunday Mock for the signed-in student. { week, phase, dow, serverNow, opensAt, closesAt,
     * next, subjects: [{ id, name, state, resultId?, marks?, resumeUntil?, sat? }], previous: { week, subjects } | null }.
     * `sat` (how many sat) only once the week has closed and only for a subject the student sat.
     */
    async status(userId) {
      const t = now();
      const st = sundayState(t);
      const subjects = mySubjects(await loadUser(userId));
      const [mine, claims] = await store_(() => Promise.all([
        store.findMine(userId, sundayWindow(st.previous).opensAt),
        store.readClaims(userId, subjects.map((s) => claimPeriod(st.week, s.id))),
      ]));
      const sentFor = (week, s) => mine.find((a) => a.week === week && subjectSpellings(s.id).includes(a.subject) && countsFor(week, a.completedAt)) || null;
      const current = await Promise.all(subjects.map(async (s) => {
        const attempt = sentFor(st.week, s);
        const claim = claims.get(claimPeriod(st.week, s.id)) || null;
        const state = subjectState({ state: st, attempt, claim, now: t });
        const out = { id: s.publicId, name: s.name, state };
        if (attempt) Object.assign(out, { resultId: attempt.id, marks: marksOf(attempt) });
        if (state === 'started') out.resumeUntil = iso(claim.startedAt + 62 * MINUTE);
        if (attempt && st.phase === 'closed') { const n = await satCount(st.week, s.id); if (n !== null) out.sat = n; }
        return out;
      }));
      const previous = (await Promise.all(subjects.map(async (s) => {
        const attempt = sentFor(st.previous, s);
        if (!attempt) return null;
        const n = await satCount(st.previous, s.id);
        return { id: s.publicId, name: s.name, state: 'sat', resultId: attempt.id, marks: marksOf(attempt), ...(n !== null ? { sat: n } : {}) };
      }))).filter(Boolean);
      return {
        week: st.week, phase: st.phase, dow: st.dow, serverNow: t, opensAt: iso(st.opensAt), closesAt: iso(st.closesAt), next: st.next,
        subjects: current, previous: previous.length ? { week: st.previous, subjects: previous } : null,
      };
    },

    /** POST /api/sunday/start { subject, startReceipt? }: the practice start response for this week's paper in that subject. */
    async start(userId, body) {
      if (!body || typeof body !== 'object' || Array.isArray(body)) throw new SundayError('BODY_INVALID');
      const t = now();
      const st = sundayState(t);
      const info = deps.subjectInfo(body.subject);
      if (!info?.ok) throw new SundayError('SUBJECT_NOT_SUPPORTED');
      if (!mySubjects(await loadUser(userId)).some((s) => s.id === info.id)) throw new SundayError('NOT_YOUR_SUBJECT', { detail: { subjectName: info.name } });
      const week = st.week;
      const period = claimPeriod(week, info.id);
      const when = { week, opensAt: iso(st.opensAt), closesAt: iso(st.closesAt), next: st.next };
      let mine = await store_(() => store.readClaim(userId, period));
      // A first start only inside the window; a sitting already started resumes until its own deadline (the engine's).
      if (!mine) { const refusal = startRefusal(st); if (refusal) throw new SundayError(refusal, { detail: when }); }
      let ids = mine?.ids || null;
      let inserted = false;
      if (!ids) {
        let fresh = false;
        ids = papers.get(period) || await store_(() => store.readPaper(period));
        if (!ids) {
          ids = (await pick(info.id, week)).slice(0, PAPER_COUNT);
          if (ids.length < PAPER_COUNT) throw new SundayError('PAPER_UNAVAILABLE', { detail: { subjectName: info.name } });
          fresh = true;
        }
        const r = await store_(() => store.insertClaim(userId, period, claimReference({ startedAt: t, ids })));
        if (r === 'exists') {
          mine = await store_(() => store.readClaim(userId, period));
          if (!mine) throw new SundayError('UNAVAILABLE');
          ids = mine.ids;
        } else {
          inserted = true;
          // Two first starts at the same moment may each have drawn a paper: the earliest row is the week's paper for everyone.
          if (fresh) {
            const first = await store_(() => store.readPaper(period));
            if (first && !same(first, ids)) {
              ids = first;
              await store_(() => store.updateClaim(userId, period, claimReference({ startedAt: t, ids })));
            }
          }
        }
      }
      try {
        const questions = await paperQuestions(info.id, week, ids);
        const served = questions.map((q) => (deps.serve ? deps.serve(q) : q));
        const input = { experience: 'practice', mode: 'full', count: PAPER_COUNT, subject: info.id, generationKey: sundayGenerationKey(deps.secret, userId, week, info.id) };
        if (typeof body.startReceipt === 'string' && body.startReceipt.length <= 2000) input.startReceipt = body.startReceipt;
        const out = await deps.startPractice(userId, input, { mobPaper: { ...sundayTag(week), questions: served } });
        remember(papers, period, ids);
        return out;
      } catch (error) {
        const e = startError(error);
        if (e.code === 'PAPER_UNAVAILABLE') e.detail = { ...(e.detail || {}), subjectName: info.name };
        // A first start that never served a paper leaves no row, so trying again is a first start (inside the window).
        if (inserted && !['SESSION_ALREADY_SUBMITTED', 'PAPER_EXPIRED', 'INVALID_START_RECEIPT'].includes(e.code)) await store.deleteClaim(userId, period);
        throw e;
      }
    },

    /**
     * GET /api/sunday/stats?week=&subject=: after the close, how many sat and, once SHARE_FLOOR or more did, the share who got
     * each question right. { week, subject, sat, shares, floor, final }. Never a rank, a percentile or a place.
     */
    async stats(userId, query = {}) {
      const week = String(query.week || '');
      if (!isWeekKey(week)) throw new SundayError('BODY_INVALID');
      const info = deps.subjectInfo(query.subject);
      if (!info?.ok) throw new SundayError('SUBJECT_NOT_SUPPORTED');
      const t = now();
      const win = sundayWindow(week);
      if (t < win.closesAt) throw new SundayError('NOT_CLOSED', { detail: { closesAt: iso(win.closesAt) } });
      const ttl = t < win.lastFinishAt + 5 * MINUTE ? 5 * MINUTE : 6 * 60 * MINUTE;
      const value = await store_(() => cached(`stats:${week}:${info.id}`, ttl, async () => sundayStats(await store.findSittings(week, info.id), { week })));
      return { week, subject: info.publicId, sat: value.sat, shares: value.shares, floor: SHARE_FLOOR, final: t >= win.lastFinishAt };
    },

    /**
     * GET /api/sunday/mob?mob=: this week's Sunday Mock in the Mob's subject, for the den. The Mob's own privacy: every member
     * sees who sat, and a member's marks only when that member shows their score (show_score); your own always. No user ids.
     */
    async mob(userId, query = {}) {
      const mobId = String(query.mob || '');
      if (!UUID_RE.test(mobId)) throw new SundayError('NOT_IN_MOB');
      const mob = await store_(() => store.mobMembers(mobId));
      if (!mob || !mob.members.some((m) => m.userId === userId)) throw new SundayError('NOT_IN_MOB');
      const t = now();
      const st = sundayState(t);
      const info = deps.subjectInfo(mob.subject);
      const base = { week: st.week, phase: st.phase, dow: st.dow, serverNow: t, opensAt: iso(st.opensAt), closesAt: iso(st.closesAt), next: st.next };
      if (!info?.ok) return { ...base, available: false, members: [], you: { state: 'closed' } };
      const out = { ...base, available: true, subject: info.publicId, subjectName: info.name };
      if (st.phase === 'before') return { ...out, members: [], you: { state: 'soon' } };
      const [sittings, claim, user] = await Promise.all([
        store_(() => store.membersSittings(mob.members.map((m) => m.userId), st.week, info.id)),
        store_(() => store.readClaim(userId, claimPeriod(st.week, info.id))),
        loadUser(userId),
      ]);
      const sat = new Map(sittings.filter((s) => countsFor(st.week, s.completedAt)).map((s) => [s.userId, s]));
      const members = mob.members.map((m) => {
        const s = sat.get(m.userId);
        const you = m.userId === userId;
        return { name: m.name, colour: m.colour, you, sat: Boolean(s), ...(s && (m.showScore || you) ? { marks: marksOf(s) } : {}) };
      });
      const mineSent = sat.get(userId) || null;
      const yours = mySubjects(user).some((s) => s.id === info.id);
      const state = subjectState({ state: st, attempt: mineSent, claim, now: t });
      return { ...out, members, you: { state: !mineSent && !claim && state === 'open' && !yours ? 'not_yours' : state, ...(mineSent ? { resultId: mineSent.id } : {}) } };
    },
  };
}
