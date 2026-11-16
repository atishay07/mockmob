// Class leagues' server logic (./model.mjs has the rules and the words; ./store.js the two tables). No 'server-only' and no
// alias imports, so node:test drives it on PGlite with the real migration and the real Sunday store
// (data/tests/class_league_routes.test.mjs); ./deps.js wires production.
//
// What keeps it private:
//   - A member is never listed, to anyone, the creator included: the answers carry a member count and nothing about anyone.
//   - A week's figure is computed only after that Sunday's answers open, over the members open at that moment, from the
//     Sunday Mock's own counted sittings (late papers left out by the Sunday store, countsFor on top), and says nothing
//     under 5 sitters, not even how many sat. Never a rank, a percentile or the highest mark.
//   - The public lookup gives the class's name and subjects for a code, nothing else.
import { LAUNCH_WEEK, countsFor, marksOf, sundayOf, sundayWindow } from '../sundayMock.mjs';
import { subjectSpellings } from '../server/sunday/store.js';
import {
  CLASS_MAX_MEMBERS, ClassError, REPORT_REASONS, checkClassName, classCodeFromBytes, classFigure, classUrl, figureWeek, membersAt,
  nextFigure, normalizeClassCode, pickSubjects, weekAllowed,
} from './model.mjs';

const HOUR = 3_600_000;
const iso = (ms) => new Date(ms).toISOString();
// The Sunday store's membersSittings answers 40 rows at most; one sitting a student, so 20 ids a read leaves room.
const CHUNK = 20;

/**
 * deps: {
 *   now() -> ms
 *   store                       ./store.js
 *   sunday                      the Sunday Mock's store (src/lib/server/sunday/store.js): membersSittings, findMine
 *   loadUser(userId) -> { subjects } | null
 *   subjectInfo(raw) -> { ok, id, publicId, name }      a launchable subject (the Sunday Mock's own rule)
 *   randomBytes(n) -> Uint8Array
 *   blocklist                   data/mob_name_blocklist.json (the Mob's name screen)
 *   onReport(info)              (optional) emails support after a report (./reportAlert.js); never awaited for the answer
 * }
 */
export function createClassService(deps) {
  const now = () => (deps.now ? deps.now() : Date.now());
  const store = deps.store;
  const figures = new Map(); // `${leagueId}:${week}:${subject}` -> { until, value }: a closed week's figure is final

  const guard = async (fn) => {
    try { return await fn(); } catch (cause) { throw cause instanceof ClassError ? cause : new ClassError('UNAVAILABLE', { cause }); }
  };
  const loadUser = (userId) => guard(() => deps.loadUser(userId));

  /** The student's own CUET subjects as launchable subjects, in their order, once each. */
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
  const subjectOut = (id) => { const info = deps.subjectInfo(id); return info?.ok ? { id: info.publicId, name: info.name } : null; };

  /** The student's class, open: { membership, league } or null. A membership of a closed class is ended on the way. */
  async function myClass(userId) {
    const membership = await guard(() => store.openMembership(userId));
    if (!membership) return null;
    const league = await guard(() => store.league(membership.leagueId));
    if (league && !league.closedAt) return { membership, league };
    if (league) await guard(() => store.endMembership(league.id, userId, now()));
    return null;
  }

  /** One subject's figure for a closed week: final once the answers are open, so kept six hours per server. */
  async function figureFor(league, week, subject) {
    const key = `${league.id}:${week}:${subject}`;
    const hit = figures.get(key);
    if (hit && hit.until > now()) return hit.value;
    const rows = await guard(() => store.memberRows(league.id));
    const counted = [...membersAt(rows, sundayWindow(week).answersAt)];
    const sittings = [];
    for (let i = 0; i < counted.length; i += CHUNK) {
      const part = counted.slice(i, i + CHUNK);
      sittings.push(...await guard(() => deps.sunday.membersSittings(part, week, subject)));
    }
    const value = classFigure({ week, rows, sittings });
    figures.delete(key);
    figures.set(key, { until: now() + 6 * HOUR, value });
    while (figures.size > 500) figures.delete(figures.keys().next().value);
    return value;
  }

  /** The student's own marks in a week's Sunday Mock, per subject id (the rule the Sunday Mock's own page uses). */
  async function ownMarks(userId, week) {
    const mine = await guard(() => deps.sunday.findMine(userId, sundayWindow(week).opensAt));
    return (subject) => {
      const a = mine.find((x) => x.week === week && subjectSpellings(subject).includes(x.subject) && countsFor(week, x.completedAt));
      return a ? marksOf(a) : null;
    };
  }

  async function weekFigures(userId, league, week) {
    const own = await ownMarks(userId, week);
    const out = [];
    for (const subject of league.subjects) {
      const s = subjectOut(subject);
      if (!s) continue;
      const f = await figureFor(league, week, subject);
      out.push({ subject: s.id, name: s.name, ...f, you: own(subject) });
    }
    return out;
  }

  async function status(userId) {
    const t = now();
    const user = await loadUser(userId);
    const subjects = mySubjects(user).map((s) => ({ id: s.publicId, name: s.name }));
    const mine = await myClass(userId);
    if (!mine) return { class: null, subjects, serverNow: t, next: nextFigure(t) };
    const { league } = mine;
    const members = await guard(() => store.openCount(league.id));
    const week = figureWeek(t, league.createdAt);
    return {
      class: {
        name: league.name, code: league.code, url: classUrl(league.code), members, creator: league.createdBy === userId,
        subjects: league.subjects.map(subjectOut).filter(Boolean),
      },
      subjects,
      week: week ? { week, figures: await weekFigures(userId, league, week) } : null,
      serverNow: t,
      next: nextFigure(t),
    };
  }

  return {
    status,

    /**
     * GET /api/class/lookup?code= (public): the class's name and subjects for its join page. A signed-in viewer also learns
     * whether they are in it already ('member'), in another class ('other') or in none. Never a member count or a name.
     */
    async lookup(raw, { viewerId = null } = {}) {
      const code = normalizeClassCode(raw);
      if (!code) throw new ClassError('CLASS_NOT_FOUND');
      const league = await guard(() => store.leagueByCode(code));
      if (!league || league.closedAt) throw new ClassError('CLASS_NOT_FOUND');
      const out = { code, name: league.name, subjects: league.subjects.map(subjectOut).filter(Boolean).map((s) => s.name) };
      if (!viewerId) return out;
      const mine = await myClass(viewerId);
      return { ...out, you: !mine ? 'none' : mine.league.id === league.id ? 'member' : 'other' };
    },

    /** POST /api/class { name, subjects }: start a class and take its first seat. Answers the status. */
    async create(userId, body = {}) {
      const own = mySubjects(await loadUser(userId));
      if (!own.length) throw new ClassError('NO_SUBJECTS');
      const name = checkClassName(body.name, deps.blocklist);
      if (!name.ok) throw new ClassError(name.code);
      const asked = (Array.isArray(body.subjects) ? body.subjects : []).map((s) => deps.subjectInfo(s)).filter((s) => s?.ok).map((s) => s.id);
      const subjects = pickSubjects(asked, own.map((s) => s.id));
      if (!subjects) throw new ClassError('SUBJECTS_INVALID');
      if (await myClass(userId)) throw new ClassError('ALREADY_IN_CLASS');
      const t = now();
      let league = null;
      for (let i = 0; i < 6 && !league; i += 1) {
        const r = await guard(() => store.insertLeague({ code: classCodeFromBytes(deps.randomBytes(4)), name: name.name, subjects, createdBy: userId, at: t }));
        if (r !== 'code_taken') league = r;
      }
      if (!league) throw new ClassError('UNAVAILABLE');
      const seat = await guard(() => store.insertMember(league.id, userId, t)).catch(async (e) => { await store.deleteLeague(league.id); throw e; });
      if (seat === 'exists') { await store.deleteLeague(league.id); throw new ClassError('ALREADY_IN_CLASS'); }
      // The class exists from here: a failed read after it keeps the create counted (the limit's give-back looks at this).
      try { return await status(userId); } catch (cause) { throw new ClassError('UNAVAILABLE', { committed: true, cause }); }
    },

    /** POST /api/class/join { code }: take a seat. A second tap on the same class answers the status again. */
    async join(userId, body = {}) {
      const code = normalizeClassCode(body.code);
      if (!code) throw new ClassError('CODE_INVALID');
      const league = await guard(() => store.leagueByCode(code));
      if (!league || league.closedAt) throw new ClassError('CLASS_NOT_FOUND');
      const mine = await myClass(userId);
      if (mine && mine.league.id === league.id) return status(userId);
      if (mine) throw new ClassError('ALREADY_IN_CLASS', { detail: { className: mine.league.name } });
      if (await guard(() => store.openCount(league.id)) >= CLASS_MAX_MEMBERS) throw new ClassError('CLASS_FULL');
      const seat = await guard(() => store.insertMember(league.id, userId, now()));
      if (seat === 'exists') {
        const again = await myClass(userId);
        if (!again || again.league.id !== league.id) throw new ClassError('ALREADY_IN_CLASS');
      }
      try { return await status(userId); } catch (cause) { throw new ClassError('UNAVAILABLE', { committed: true, cause }); }
    },

    /** POST /api/class/leave: one tap. The creator closes instead (a class always has someone who can end it). */
    async leave(userId) {
      const mine = await myClass(userId);
      if (!mine) throw new ClassError('NOT_IN_CLASS');
      if (mine.league.createdBy === userId) throw new ClassError('CREATOR_CLOSES');
      await guard(() => store.endMembership(mine.league.id, userId, now()));
      return { left: true };
    },

    /** POST /api/class/close: the creator ends the class for everyone; its code stops working and every seat is freed. */
    async close(userId) {
      const mine = await myClass(userId);
      if (!mine) throw new ClassError('NOT_IN_CLASS');
      if (mine.league.createdBy !== userId) throw new ClassError('NOT_CREATOR');
      const t = now();
      await guard(() => store.closeLeague(mine.league.id, userId, t));
      await guard(() => store.endAll(mine.league.id, t));
      return { closed: true };
    },

    /**
     * POST /api/class/report { reason, code? }: a member (or anyone signed in who opened its link, by code) reports a class.
     * Support gets one email with the class's name and code (./reportAlert.js). Nothing about the reporter leaves the server.
     */
    async report(userId, body = {}) {
      if (!REPORT_REASONS.includes(body.reason)) throw new ClassError('REASON_INVALID');
      let league = null;
      if (body.code !== undefined) {
        const code = normalizeClassCode(body.code);
        league = code ? await guard(() => store.leagueByCode(code)) : null;
        if (!league || league.closedAt) throw new ClassError('CLASS_NOT_FOUND');
      } else {
        league = (await myClass(userId))?.league || null;
        if (!league) throw new ClassError('NOT_IN_CLASS');
      }
      const members = await guard(() => store.openCount(league.id)).catch(() => null);
      if (deps.onReport) {
        try { deps.onReport({ code: league.code, name: league.name, members, reason: body.reason, at: iso(now()) }); } catch { /* the report is taken either way */ }
      }
      return { reported: true };
    },

    /**
     * GET /api/class/week?week=&subject=: one Sunday's figure in one subject, for that paper's result. Null figure when the
     * class does not follow the subject. Only a Sunday whose answers are open and that the class existed for.
     */
    async week(userId, query = {}) {
      const week = String(query.week || '');
      const t = now();
      if (week < LAUNCH_WEEK || week > sundayOf(t)) throw new ClassError('WEEK_INVALID');
      const mine = await myClass(userId);
      if (!mine) throw new ClassError('NOT_IN_CLASS');
      if (!weekAllowed(week, t, mine.league.createdAt)) throw new ClassError('WEEK_INVALID');
      const info = deps.subjectInfo(query.subject);
      if (!info?.ok || !mine.league.subjects.includes(info.id)) return { week, figure: null, className: mine.league.name };
      const f = await figureFor(mine.league, week, info.id);
      const own = (await ownMarks(userId, week))(info.id);
      return { week, className: mine.league.name, figure: { subject: info.publicId, name: info.name, ...f, you: own } };
    },
  };
}
