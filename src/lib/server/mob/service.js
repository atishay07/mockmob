// The Mob's server logic (SOCIAL-SPEC sections 5, 6 and 15). No 'server-only' and no '@/' imports on purpose, so
// node:test drives it against the real migration on PGlite (data/tests/mob.test.mjs); src/lib/server/mob/deps.js wires
// the production pieces (Supabase, the question bank, the practice session engine).
//
// Every write goes through one of the migration's functions, which take the acting user id from here and hold a
// per-Mob lock. User ids never leave the server: members are addressed by memberId, an HMAC of (mobId, userId).
// Free and Pro (section 15) are decided here and nowhere else, from the account's plan, never from anything the client
// sent:
//   Free   start one Mob and join any number by invite (17 Oct CTO decision), sit the weekly paper without credits (one
//          a week, whichever Mob), the ring, your own result, a one-line teaser, and one free side-by-side (the sample).
//   Pro    the full side-by-side, past weeks, extra papers on a chosen chapter and length (3 a Mob and week), start up
//          to 3 Mobs. Every plan joins up to MAX_MEMBERSHIPS Mobs (a safety ceiling, not a plan limit).
// Sharing inside a Mob is on by default (show_score, migration 20261017190000), with a per-member switch to turn it off.
// A Mob paper is started by startPractice, which charges no credits and uses no daily allowance for it (the Mob calls
// no AI model: its cost is a few rows a week). The one exception is a Free member sitting a Full mock together (owner
// D174): 50 credits, through the solo Full mock's own charge (startMock below, src/lib/mob/mockPrice.mjs).
// TODO(owner D-S4): an invite tied to credits is the owner's decision and is not built. Do not add one here.
import { createHmac } from 'node:crypto';
import {
  EXTRA_LENGTHS, EXTRA_MAX_PER_WEEK, EXTRA_OPEN_DAYS, FREE_MAX_MOBS, INVITE_DAYS, MAX_MEMBERSHIPS, MobError, PAPER_COUNT, PRO_MAX_MOBS,
  REPORT_REASONS, SECONDS_PER_QUESTION, UUID_RE, buildView, checkColour, checkName, closesAt, codeFromBytes, computeTogether, computeTrap,
  displayCode, finishedInWindow, mobWeek, normalizeCode, picksFromAttempt, tooLateToStart, trapPayload,
} from '../../mob/model.mjs';
import { mobName, validNameKey } from '../../mob/names.mjs';
import { buildCompare, compareSummary, sharingSet } from '../../mob/compare.mjs';
import { detailFromAttempt } from './detail.js';
import { memberIdFor } from './memberId.js';
import { createMobV3Service } from './games.js';
import { attemptHold, heldCompare, holdStamp } from '../../mob/paperHold.mjs';
import { mockGamePrice, mockSitAction } from '../../mob/mockPrice.mjs';

const DAY_MS = 86_400_000;
const WEEK_RE = /^\d{4}-\d{2}-\d{2}$/;
const missingSchema = (e) => /PGRST20[25]|42883|42P01|does not exist|schema cache|Could not find the function/i.test(`${e?.code || ''} ${e?.message || ''}`);
const validMobId = (v) => typeof v === 'string' && UUID_RE.test(v);

/** The longest extra-paper length `ready` questions can fill, or null when even the shortest cannot be. */
export const longestFor = (ready) => [...EXTRA_LENGTHS].reverse().find((n) => n <= ready) || null;
const questionsWord = (n) => (n === 0 ? 'no questions' : n === 1 ? '1 question' : `${n} questions`);

/**
 * The bank cannot fill the paper asked for: say how many questions are ready and offer the nearest paper that can be
 * made (a shorter one on the same chapter, else the whole subject at the same length). Never a bare "unavailable".
 */
export function thinBank({ ready, count, chapter = null, subjectName = 'This subject' }) {
  const fits = longestFor(ready);
  const where = chapter || subjectName;
  if (fits) {
    return new MobError('BANK_THIN', {
      message: `${where} has ${questionsWord(ready)} ready right now, enough for a ${fits}-question paper. Make a ${fits}-question paper instead${chapter ? ', or use the whole subject' : ''}.`,
      detail: { ready, asked: count, suggest: { chapter, count: fits } },
    });
  }
  return new MobError('BANK_THIN', {
    message: chapter
      ? `${where} has ${questionsWord(ready)} ready right now, too few for a paper. Make it from the whole subject, or choose a chapter with more.`
      : `${where} has ${questionsWord(ready)} ready right now, too few for a paper. Try again in a few days.`,
    detail: { ready, asked: count, suggest: chapter ? { chapter: null, count } : null },
  });
}

export { memberIdFor };

/**
 * deps: {
 *   rpc(name, params) -> data            the migration's functions (throws { code, message } on failure)
 *   now() -> ms, randomBytes(n) -> Uint8Array, secret
 *   blocklist                              data/mob_name_blocklist.json
 *   subjectInfo(subject) -> { ok, id, name }   a launchable subject, stored id and its official name
 *   loadUser(userId) -> { isPremium, subjects } | null   the plan (Pro is isPremium === true, anything else is Free)
 *                                                        and the subjects the student studies (a Mob is for one of them)
 *   invitesEnabled() -> boolean                  false pauses new invites and joining by link (the spec's stop rule)
 *   chapterCounts(subject) -> [{ chapter, ready }]   questions ready per chapter, for the extra-paper chooser
 *   validChapter(subject, chapter) -> boolean    a chapter of that subject's official syllabus
 *   pickQuestionIds(subject, { mobId, week, count, chapter, key }) -> string[]   from the central bank, no personal exclusions
 *   loadQuestions(ids) -> questions in that order (missing ones left out): { id, stem, correctIndex, options }
 *   trapNameFor(question, optionIndex) -> string | null
 *   findAttempts(userIds, { mobId, week, extraId }) -> [{ id, userId, correct, total, details, selectionMeta, completedAt }]
 *   startPractice(userId, input, server) -> the POST /api/sessions practice-start response
 * }
 */
export function createMobService(deps) {
  const now = () => (deps.now ? deps.now() : Date.now());
  const call = async (name, params) => {
    try {
      return await deps.rpc(name, params);
    } catch (error) {
      if (error instanceof MobError) throw error;
      throw new MobError(missingSchema(error) ? 'MIGRATION' : 'UNAVAILABLE', { cause: error });
    }
  };
  const idFor = (mobId) => (userId) => memberIdFor(deps.secret, mobId, userId);
  const memberByMemberId = (state, memberId) => {
    if (typeof memberId !== 'string' || !/^[0-9A-Z]{12}$/.test(memberId)) return null;
    const ids = idFor(state.mob.id);
    return (state.members || []).find((m) => ids(m.user_id) === memberId) || null;
  };
  const nameIn = (state) => (u) => (state.members || []).find((m) => m.user_id === u)?.display_name || null;

  // The plan. A failed read is Free: the safe side for every gate below.
  const loadUser = async (userId) => (deps.loadUser ? deps.loadUser(userId).catch(() => null) : null);
  async function isPro(userId) {
    return (await loadUser(userId))?.isPremium === true;
  }
  const invitesOn = () => (deps.invitesEnabled ? deps.invitesEnabled() !== false : true);
  // Mob v3 (MOB-BUILD-SPEC-V3): everything new needs MOB_V3_ENABLED=true and its migrations. Off, every route keeps the
  // exact behaviour build 9 apps and today's web know.
  const v3On = () => (deps.v3Enabled ? deps.v3Enabled() === true : false);
  let v3;
  // How many Mobs the student started and is still in. Null when the count cannot be read (the view falls back).
  const startedCount = async (userId) => {
    try {
      const n = Number(await deps.rpc('mob_started_count', { p_user_id: userId }));
      return Number.isInteger(n) ? n : null;
    } catch { return null; }
  };

  async function readState(userId, week, mobId = null) {
    const state = await call('mob_state', { p_user_id: userId, p_week: week, p_mob_id: mobId || null, p_now: new Date(now()).toISOString() });
    if (!state || !state.mob) return null;
    return { ...state, week };
  }

  const sittingParams = (userId, mobId, week, questionIds, attempt) => ({
    p_user_id: userId, p_mob_id: mobId, p_week: week, p_session_id: String(attempt.id),
    p_score: Number(attempt.correct) || 0, p_max_score: Math.max(1, Number(attempt.total) || questionIds.length),
    p_picks: picksFromAttempt(questionIds, attempt), p_sat_at: new Date(attempt.completedAt || now()).toISOString(),
    p_detail: detailFromAttempt(questionIds, attempt),
  });
  const extraParams = (userId, extra, attempt) => ({
    p_user_id: userId, p_extra_id: extra.id, p_session_id: String(attempt.id),
    p_score: Number(attempt.correct) || 0, p_max_score: Math.max(1, Number(attempt.total) || extra.question_ids.length),
    p_picks: picksFromAttempt(extra.question_ids, attempt), p_sat_at: new Date(attempt.completedAt || now()).toISOString(),
    p_detail: detailFromAttempt(extra.question_ids, attempt),
  });
  const extraClosed = (extra) => Date.parse(extra.closes_at) <= now();
  const extraTooLate = (extra) => now() + (extra.question_ids?.length || PAPER_COUNT) * SECONDS_PER_QUESTION * 1000 > Date.parse(extra.closes_at);

  /**
   * A paper finished through the durable session path (finishSession) never passes finishPractice, so a read records
   * any finished Mob paper of this week (and any open extra paper) the members have not been credited with yet.
   * Idempotent; a failure here only leaves the ring as it was.
   */
  async function syncSittings(state, userId) {
    if (!deps.findAttempts) return state;
    let recorded = 0;
    try {
      const ids = state.paper?.question_ids;
      if (Array.isArray(ids)) {
        const sat = new Set((state.sittings || []).map((s) => s.user_id));
        const missing = (state.members || []).map((m) => m.user_id).filter((u) => !sat.has(u));
        if (missing.length) {
          const attempts = await deps.findAttempts(missing, { mobId: state.mob.id, week: state.week });
          for (const a of attempts || []) {
            if (!missing.includes(a.userId) || !finishedInWindow(state.week, a.completedAt)) continue;
            const r = await call('mob_record_sitting', sittingParams(a.userId, state.mob.id, state.week, ids, a));
            if (r === 'recorded') recorded += 1;
          }
        }
      }
      for (const x of state.extras || []) {
        const sat = new Set((x.sittings || []).map((s) => s.user_id));
        const missing = (state.members || []).map((m) => m.user_id).filter((u) => !sat.has(u));
        if (!missing.length || extraClosed(x)) continue;
        const attempts = await deps.findAttempts(missing, { mobId: state.mob.id, week: x.week_start, extraId: x.id });
        for (const a of attempts || []) {
          if (!missing.includes(a.userId) || !Number.isFinite(a.completedAt) || a.completedAt >= Date.parse(x.closes_at)) continue;
          const r = await call('mob_extra_record', extraParams(a.userId, x, a));
          if (r === 'recorded') recorded += 1;
        }
      }
    } catch { return state; }
    return recorded ? readState(userId, state.week, state.mob.id) : state;
  }

  // The trap (P7, 3 or more sitters) and Together (2 or more sitters who show their score) read the same keys once.
  async function comparisonsFor(state, userId) {
    const none = { trap: null, together: null };
    const sittings = state.sittings || [];
    const mine = sittings.find((s) => s.user_id === userId);
    const ids = state.paper?.question_ids;
    if (!mine || sittings.length < 2 || !Array.isArray(ids) || !deps.loadQuestions) return none;
    const optedIn = sharingSet(state.members);
    const wantsTogether = optedIn.has(userId) && sittings.some((s) => s.user_id !== userId && optedIn.has(s.user_id));
    if (sittings.length < 3 && !wantsTogether) return none;
    try {
      const questions = await deps.loadQuestions(ids);
      const byId = new Map(questions.map((q) => [q.id, q]));
      const keys = ids.map((id) => (Number.isInteger(byId.get(id)?.correctIndex) ? byId.get(id).correctIndex : -1));
      const together = wantsTogether ? computeTogether(sittings, keys, { userId, optedIn }) : null;
      const raw = sittings.length >= 3 ? computeTrap(sittings, keys) : null;
      if (!raw) return { trap: null, together };
      const question = byId.get(ids[raw.questionIndex]);
      const trapName = deps.trapNameFor ? await Promise.resolve(deps.trapNameFor(question, raw.optionIndex)).catch(() => null) : null;
      return { trap: trapPayload(raw, { questionId: ids[raw.questionIndex], trapName, youPicked: mine.picks?.[raw.questionIndex], key: keys[raw.questionIndex] }), together };
    } catch { return none; }
  }

  const subjectName = (subject) => (deps.subjectInfo ? deps.subjectInfo(subject)?.name || null : null);

  /** Extra papers as a student sees them: the paper, its window and your own place in it. Never another member's picks. */
  function extrasFor(state, userId, { pro }) {
    const nameOf = nameIn(state);
    return (state.extras || []).map((x) => {
      const mine = (x.sittings || []).find((s) => s.user_id === userId);
      const count = x.question_ids?.length || 0;
      const summary = mine ? compareSummary({ pro, sample: state.sample, mobId: state.mob.id, week: String(x.week_start).slice(0, 10), sittings: x.sittings, userId, members: state.members, nameOf, count }) : null;
      return {
        id: x.id, chapter: x.chapter || null, count, createdByYou: x.created_by === userId,
        createdAt: new Date(x.created_at).toISOString(), closesAt: new Date(x.closes_at).toISOString(), closed: extraTooLate(x),
        sat: (x.sittings || []).length, youSat: Boolean(mine), yourResultId: mine ? mine.session_id : null,
        // The answers of an extra paper open at its close (src/lib/mob/paperHold.mjs): until then the result shows the marks.
        answersOpen: extraClosed(x),
        compare: summary && summary.available ? summary : null,
      };
    });
  }

  async function view(userId, { mobId = null, sync = true } = {}) {
    const week = mobWeek(now());
    const wanted = validMobId(mobId) ? mobId : null;
    let state = await readState(userId, week, wanted);
    if (!state && wanted) state = await readState(userId, week, null); // a Mob you have since left: show the one you have
    // v3Available: the capability flag the app reads to switch the new Mob on (also with no Mob). Absent while v3 is off.
    if (!state) return v3On() ? { mob: null, v3Available: true } : { mob: null };
    if (sync) state = await syncSittings(state, userId);
    const pro = await isPro(userId);
    const youSat = (state.sittings || []).some((s) => s.user_id === userId);
    const { trap, together } = await comparisonsFor(state, userId);
    const ids = state.paper?.question_ids;
    const summary = youSat && Array.isArray(ids)
      ? compareSummary({ pro, sample: state.sample, mobId: state.mob.id, week: state.week, sittings: state.sittings, userId, members: state.members, nameOf: nameIn(state), count: ids.length })
      : null;
    // The weekly paper costs no credits, for anyone. A free student gets one a week, whichever Mob it is in.
    const freeBlocked = !pro && !youSat && Boolean(state.free_claim && state.free_claim.mob_id !== state.mob.id);
    // The Mob's shared trap and the together line are part of the side-by-side: Pro, or the sample week. A free student
    // gets the teaser, which says where the Mob split and nothing more.
    const unlocked = pro || summary?.access === 'sample';
    const mobs = (state.mobs || []).map((m) => ({ id: m.id, subject: m.subject, subjectName: subjectName(m.subject) }));
    const started = await startedCount(userId);
    // The shared trap names a wrong option and whether you got it right, so it waits for the paper to close like the answers
    // (src/lib/mob/paperHold.mjs; MOB-BUILD-SPEC-V3 F3). This view is always the open week: the trap shows in the side-by-side
    // of that week once it has closed. Together (counts only, never a key) and the teaser stay.
    const weekHeld = attemptHold({ mobPaper: { mobId: state.mob.id, weekStart: state.week } }, now()) !== null;
    const out = buildView(state, {
      userId, now: now(), memberIdFor: idFor(state.mob.id), cost: youSat ? null : { type: 'free' }, trap: unlocked && !weekHeld ? trap : null, together: unlocked ? together : null,
      subjectName: subjectName(state.mob.subject), plan: { pro }, mobs, freeBlocked, started, invitesPaused: !invitesOn(),
      compare: summary && summary.available ? summary : null, extras: extrasFor(state, userId, { pro }),
    });
    // v3: "Free members join and play everything" lifts the one free Mob paper a week (C-dec 2 item 9).
    if (v3On() && out.mob) {
      out.mob.week.paper.blocked = null;
      out.mob.v3 = await v3.v3Block(userId, state, { pro });
    }
    if (v3On()) out.v3Available = true;
    return out;
  }

  /** The follow-up read after a write that already went through. If only this read fails, the write stays done: the error says
   *  so (`committed`), and the route then keeps the success-only count the write took instead of giving it back. */
  async function viewAfterWrite(userId, opts) {
    try { return await view(userId, opts); } catch (error) {
      if (error instanceof MobError) throw new MobError(error.code, { ...error.extra, committed: true });
      throw new MobError('UNAVAILABLE', { cause: error, committed: true });
    }
  }

  /** The student's Mob for a write. Several Mobs and none named is MOB_REQUIRED: a write never guesses which one. */
  async function mustState(userId, mobId, { sync = false, week = null, lenient = false } = {}) {
    if (mobId !== undefined && mobId !== null && !validMobId(mobId)) throw new MobError('NOT_IN_MOB');
    const state = await readState(userId, week || mobWeek(now()), mobId || null);
    if (!state) throw new MobError('NOT_IN_MOB');
    if (!mobId && !lenient && (state.mobs || []).length > 1) throw new MobError('MOB_REQUIRED');
    return sync ? syncSittings(state, userId) : state;
  }

  /**
   * L-09 (20 Oct): a block separates the two students in EVERY Mob they share, in the same request as the block. Member
   * ids differ per Mob, so the blocker could never find those Mobs alone. In a Mob the blocker owns, the blocked member
   * is removed (the owner keeps their Mob); in any other Mob the blocker leaves. From then on the block row keeps either
   * of them out of a Mob the other is in (mob_join). `state` is the blocker's state in the Mob they blocked from (it is
   * left by the caller). Returns how many other Mobs were separated.
   */
  async function separateEverywhere(userId, blockedId, state) {
    let separated = 0;
    for (const other of state.mobs || []) {
      const otherId = other?.id;
      if (!validMobId(otherId) || otherId === state.mob.id) continue;
      const there = await readState(userId, state.week || mobWeek(now()), otherId);
      if (!there?.mob || there.mob.id !== otherId) continue;
      const members = there.members || [];
      if (!members.some((m) => m.user_id === blockedId)) continue;
      const owner = members.find((m) => m.user_id === userId)?.role === 'owner';
      const r = owner
        ? await call('mob_remove', { p_actor: userId, p_mob_id: otherId, p_target: blockedId })
        : await call('mob_leave', { p_user_id: userId, p_mob_id: otherId });
      if (r === 'removed' || r === 'left' || r === 'left_and_closed') separated += 1;
    }
    return separated;
  }

  const nameAndColour = (body, { required }) => {
    const out = {};
    if (body.name !== undefined || required) {
      const checked = checkName(body.name, deps.blocklist);
      if (!checked.ok) throw new MobError(checked.code);
      out.name = checked.name;
    }
    if (body.colour !== undefined || required) {
      const colour = body.colour === undefined ? 0 : body.colour;
      if (!checkColour(colour)) throw new MobError('COLOUR_INVALID');
      out.colour = colour;
    }
    return out;
  };

  const startLimit = (user) => (user?.isPremium === true ? { max: PRO_MAX_MOBS, code: 'MOB_LIMIT_PRO' } : { max: FREE_MAX_MOBS, code: 'MOB_LIMIT' });
  // A Mob is for one of the student's own subjects: the ones on their account, resolved the way the server stores them.
  const ownSubjects = (user) => new Set((Array.isArray(user?.subjects) ? user.subjects : []).map((s) => deps.subjectInfo(s)).filter((x) => x?.ok).map((x) => x.id));

  const service = {
    view,

    /**
     * Run BEFORE the create rate limit (http.js gate). A student already at their plan's cap of Mobs they started hears
     * the plan's own sentence, never the rate limit's: for Pro the weekly create limit (3) equals the cap (3), so the
     * wait ("start another on Sun 25 Oct") would be wrong for someone who must leave a Mob first. A failed read of the
     * account or the count says nothing here: create decides.
     */
    async createGate(userId) {
      const user = await loadUser(userId);
      if (!user) return;
      const plan = startLimit(user);
      const n = await startedCount(userId);
      if (n !== null && n >= plan.max) throw new MobError(plan.code);
    },

    async create(userId, body) {
      const user = await loadUser(userId);
      if (!user) throw new MobError('UNAVAILABLE'); // the account did not load: never blame the student's subjects for it
      const own = ownSubjects(user);
      if (!own.size) throw new MobError('NO_SUBJECTS');
      const subject = typeof body.subject === 'string' ? deps.subjectInfo(body.subject) : null;
      if (!subject?.ok || !own.has(subject.id)) throw new MobError('SUBJECT_INVALID');
      const { name, colour } = nameAndColour(body, { required: true });
      const plan = startLimit(user);
      let r;
      if (v3On()) {
        if (body.nameKey !== undefined && body.nameKey !== null && !validNameKey(body.nameKey)) throw new MobError('NAME_KEY_INVALID');
        const fold = await v3.checkFold(userId, body.fold);
        r = await call('mob_create_named', { p_user_id: userId, p_subject: subject.id, p_name: name, p_colour: colour, p_max_mobs: plan.max, p_name_key: body.nameKey ?? null });
        if (r?.status === 'created' && fold) await v3.sitAs(userId, fold);
      } else {
        r = await call('mob_create', { p_user_id: userId, p_subject: subject.id, p_name: name, p_colour: colour, p_max_mobs: plan.max });
      }
      if (r?.status === 'limit') throw new MobError(plan.code);
      if (r?.status === 'ceiling') throw new MobError('MOB_CEILING');
      if (r?.status !== 'created') throw new MobError('UNAVAILABLE');
      return viewAfterWrite(userId, { mobId: r.mob_id, sync: false });
    },

    async invite(userId, body = {}) {
      const state = await mustState(userId, body.mob);
      if (!invitesOn()) throw new MobError('INVITES_PAUSED');
      const expires = new Date(now() + INVITE_DAYS * DAY_MS).toISOString();
      for (let attempt = 0; attempt < 3; attempt += 1) {
        const code = v3On() ? codeFromBytes(deps.randomBytes(4), 6) : codeFromBytes(deps.randomBytes(5));
        let r;
        try {
          r = await deps.rpc('mob_invite_new', { p_user_id: userId, p_mob_id: state.mob.id, p_code: code, p_expires_at: expires });
        } catch (error) {
          if (/23505|duplicate key/.test(`${error?.code || ''} ${error?.message || ''}`)) continue; // a 40-bit collision: draw again
          throw new MobError(missingSchema(error) ? 'MIGRATION' : 'UNAVAILABLE', { cause: error });
        }
        if (r === 'not_member') throw new MobError('NOT_IN_MOB');
        if (r === 'full') throw new MobError('MOB_FULL');
        const out = await view(userId, { mobId: state.mob.id, sync: false });
        if (!out.mob?.invite) throw new MobError('UNAVAILABLE');
        return v3On() ? { ...out.mob.invite, display: displayCode(out.mob.invite.code) } : out.mob.invite;
      }
      throw new MobError('UNAVAILABLE');
    },

    /** Public: never a name, never a member id. A signed-in student (viewerId) also gets who made the link: "Riya invited you". */
    async lookup(rawCode, { viewerId = null } = {}) {
      const code = normalizeCode(rawCode);
      if (!code) throw new MobError('INVITE_INVALID');
      if (!invitesOn()) throw new MobError('JOIN_PAUSED');
      const r = await call('mob_invite_lookup', { p_code: code, p_now: new Date(now()).toISOString() });
      if (r?.status === 'expired') throw new MobError('INVITE_EXPIRED');
      if (r?.status === 'full') throw new MobError('MOB_FULL');
      if (r?.status !== 'valid') throw new MobError('INVITE_INVALID');
      const out = { valid: true, code, subject: r.subject, subjectName: subjectName(r.subject) || r.subject, size: Number(r.size), seatsLeft: Number(r.seats_left), expiresAt: new Date(r.expires_at).toISOString(), ...(viewerId && r.inviter ? { inviter: r.inviter } : {}) };
      // v3 adds the Mob's name and the status word (judge F7: still no member names on the preview).
      return v3On() ? { status: 'valid', ...out, name: mobName(r.name_key, out.subjectName).text } : out;
    },

    async join(userId, body) {
      const code = normalizeCode(body.code);
      if (!code) throw new MobError('INVITE_INVALID');
      if (!invitesOn()) throw new MobError('JOIN_PAUSED');
      const { name, colour } = nameAndColour(body, { required: true });
      const fold = v3On() ? await v3.checkFold(userId, body.fold) : null;
      // Joining is not a plan limit: every plan joins up to the safety ceiling (the migration counts every membership).
      const r = await call('mob_join', { p_user_id: userId, p_code: code, p_name: name, p_colour: colour, p_max_mobs: MAX_MEMBERSHIPS, p_now: new Date(now()).toISOString() });
      const status = r?.status;
      // P10: a block either way reads exactly like a bad code, so the joiner learns nothing.
      if (status === 'invalid' || status === 'blocked') throw new MobError('INVITE_INVALID');
      if (status === 'expired') throw new MobError('INVITE_EXPIRED');
      if (status === 'full') throw new MobError('MOB_FULL');
      if (status === 'limit') throw new MobError('MOB_CEILING');
      if (status !== 'joined' && status !== 'already') throw new MobError('UNAVAILABLE');
      if (fold) await v3.sitAs(userId, fold).catch(() => null);
      // Opening the link of a Mob you are already in just takes you there.
      return viewAfterWrite(userId, { mobId: r?.mob_id, sync: false });
    },

    async patchMe(userId, body) {
      const { name, colour } = nameAndColour(body, { required: false });
      const flags = {};
      for (const key of ['showScore', 'nudgesMuted']) {
        if (body[key] === undefined) continue;
        if (typeof body[key] !== 'boolean') throw new MobError('BODY_INVALID');
        flags[key] = body[key];
      }
      // Mob hours (D174): { share_study_time: boolean } is the member's own switch, off for everyone until they turn it on.
      // It is a v3 feature (MOB_V3_ENABLED and migration 20261020151000_mob_hours); a body with it and anything else not a
      // boolean is refused whole, before anything is written.
      const share = body.share_study_time;
      if (share !== undefined && typeof share !== 'boolean') throw new MobError('BODY_INVALID');
      if (share !== undefined && !v3On()) throw new MobError('MOB_DISABLED');
      const others = name !== undefined || colour !== undefined || Object.keys(flags).length > 0;
      if (!others && share === undefined) throw new MobError('BODY_INVALID');
      const state = await mustState(userId, body.mob);
      // The switch goes first: it is the only call that can fail for a schema reason (migration missing, 503) and it proves
      // membership too, so a body that fails here has written nothing, and the app can retry it whole.
      if (share !== undefined) {
        const r = await call('mob_share_study_time_set', { p_user_id: userId, p_mob_id: state.mob.id, p_share: share });
        if (r !== 'ok') throw new MobError('NOT_IN_MOB');
      }
      if (others) {
        const r = await call('mob_patch_me', {
          p_user_id: userId, p_mob_id: state.mob.id, p_name: name ?? null, p_colour: colour ?? null,
          p_show_score: flags.showScore ?? null, p_nudges_muted: flags.nudgesMuted ?? null,
        });
        if (r === 'not_member') throw new MobError('NOT_IN_MOB');
      }
      return view(userId, { mobId: state.mob.id, sync: false });
    },

    async leave(userId, body = {}) {
      const state = await mustState(userId, body.mob);
      let separated = 0;
      if (body.block !== undefined && body.block !== null) {
        const target = memberByMemberId(state, body.block);
        if (!target || target.user_id === userId) throw new MobError('NOT_FOUND');
        await call('mob_block', { p_blocker: userId, p_blocked: target.user_id });
        separated = await separateEverywhere(userId, target.user_id, state);
      }
      const r = await call('mob_leave', { p_user_id: userId, p_mob_id: state.mob.id });
      if (r === 'not_member') throw new MobError('NOT_IN_MOB');
      return separated ? { left: true, separatedMobs: separated } : { left: true };
    },

    async remove(userId, body = {}) {
      const state = await mustState(userId, body.mob);
      const target = memberByMemberId(state, body.memberId);
      if (!target) throw new MobError('NOT_FOUND');
      const r = await call('mob_remove', { p_actor: userId, p_mob_id: state.mob.id, p_target: target.user_id });
      if (r === 'not_owner') throw new MobError('NOT_OWNER');
      if (r !== 'removed') throw new MobError(r === 'not_member' ? 'NOT_IN_MOB' : 'NOT_FOUND');
      return view(userId, { mobId: state.mob.id, sync: false });
    },

    async report(userId, body = {}) {
      if (!REPORT_REASONS.includes(body.reason)) throw new MobError('REASON_INVALID');
      for (const key of ['alsoLeave', 'block']) if (body[key] !== undefined && typeof body[key] !== 'boolean') throw new MobError('BODY_INVALID');
      const state = await mustState(userId, body.mob);
      const target = memberByMemberId(state, body.memberId);
      if (!target || target.user_id === userId) throw new MobError('NOT_FOUND');
      const r = await call('mob_report', { p_reporter: userId, p_mob_id: state.mob.id, p_reported: target.user_id, p_reason: body.reason });
      if (r !== 'reported') throw new MobError('NOT_FOUND');
      let separated = 0;
      if (body.block === true) {
        await call('mob_block', { p_blocker: userId, p_blocked: target.user_id });
        separated = await separateEverywhere(userId, target.user_id, state);
      }
      if (body.alsoLeave === true || body.block === true) await call('mob_leave', { p_user_id: userId, p_mob_id: state.mob.id });
      const out = { reported: true, left: body.alsoLeave === true || body.block === true };
      return separated ? { ...out, separatedMobs: separated } : out;
    },

    async nudge(userId, body = {}) {
      const state = await mustState(userId, body.mob, { sync: true });
      const r = await call('mob_nudge', { p_user_id: userId, p_mob_id: state.mob.id, p_week: state.week });
      if (r?.status === 'not_member') throw new MobError('NOT_IN_MOB');
      if (r?.status === 'not_sat') throw new MobError('NOT_SAT_YET');
      if (r?.status === 'already') throw new MobError('ALREADY_NUDGED');
      return { sent: true, to: Math.max(0, Number(r?.to) || 0) };
    },

    async nudgeSeen(userId, body = {}) {
      const state = await mustState(userId, body.mob);
      const r = await call('mob_nudge_seen_mark', { p_user_id: userId, p_mob_id: state.mob.id, p_week: state.week });
      if (r === -1) throw new MobError('NOT_IN_MOB');
      return { ok: true };
    },

    /**
     * Start (or resume) this week's paper, or one of the Mob's extra papers (body.extra): the same questions in the same
     * option order for every member. No credits and no daily allowance, ever. A free student gets one weekly Mob paper a
     * week, whichever Mob it is in (the claim outlives the membership, so leaving and joining another Mob mid-week cannot
     * be used to sit a second one); Pro has no such limit. Extra papers belong to the Mob: any member sits them.
     */
    async startPaper(userId, body = {}) {
      const state = await mustState(userId, body.mob, { sync: true });
      if (body.game !== undefined && body.game !== null) return startMock(userId, state, body);
      if (body.extra !== undefined && body.extra !== null) return startExtra(userId, state, body);
      if ((state.sittings || []).some((s) => s.user_id === userId)) throw new MobError('PAPER_ALREADY_SAT');
      if (tooLateToStart(state.week, now())) throw new MobError('WEEK_CLOSED');
      const pro = await isPro(userId);
      let claimed = false;
      // v3 lifts the one free weekly paper across Mobs: mob_free_claim stays for old rows and the undo, but is not called.
      if (!pro && !v3On()) {
        const c = await call('mob_free_claim', { p_user_id: userId, p_mob_id: state.mob.id, p_week: state.week });
        if (c === 'used') throw new MobError('FREE_PAPER_USED');
        claimed = c === 'new';
      }
      const release = async () => { if (claimed) await deps.rpc('mob_free_release', { p_user_id: userId, p_mob_id: state.mob.id, p_week: state.week }).catch(() => null); };
      try {
        let ids = state.paper?.question_ids;
        if (!Array.isArray(ids)) {
          const picked = await deps.pickQuestionIds(state.mob.subject, { mobId: state.mob.id, week: state.week, count: PAPER_COUNT }).catch(() => []);
          if (!Array.isArray(picked) || picked.length < PAPER_COUNT) throw new MobError('PAPER_UNAVAILABLE');
          ids = await call('mob_paper_put', { p_mob_id: state.mob.id, p_week: state.week, p_subject: state.mob.subject, p_ids: picked.slice(0, PAPER_COUNT) });
        }
        const questions = await deps.loadQuestions(ids).catch(() => []);
        if (!Array.isArray(questions) || questions.length !== ids.length) throw new MobError('PAPER_UNAVAILABLE');
        // One key per member and week: a retry resumes the same session and is never charged twice (it is never charged).
        const generationKey = `mob_${createHmac('sha256', String(deps.secret || 'mob')).update(`paper:${state.mob.id}:${state.week}:${userId}`).digest('hex').slice(0, 40)}`;
        const input = { experience: 'practice', mode: 'quick', count: questions.length, subject: state.mob.subject, generationKey };
        if (typeof body.startReceipt === 'string' && body.startReceipt.length <= 2000) input.startReceipt = body.startReceipt;
        // holdUntil: the answers stay on the server until the paper closes (src/lib/mob/paperHold.mjs).
        return await runStart(userId, input, { mobPaper: { mobId: state.mob.id, weekStart: state.week, holdUntil: holdStamp({ weekStart: state.week }), questions } });
      } catch (error) {
        await release();
        throw error;
      }
    },

    /** The side-by-side (Pro, or the one free sample). GET /api/mob/compare?mob=&week= or ?extra=. */
    async compare(userId, q = {}) {
      let state; let ids; let sittings; let week; let extra = null; let kind = 'weekly';
      let past = false;
      if (q.extra !== undefined && q.extra !== null && q.extra !== '') {
        if (!validMobId(q.extra)) throw new MobError('EXTRA_NOT_FOUND');
        extra = await call('mob_extra_get', { p_user_id: userId, p_extra_id: q.extra });
        if (!extra) throw new MobError('EXTRA_NOT_FOUND');
        state = await mustState(userId, extra.mob_id);
        ids = extra.question_ids; sittings = extra.sittings || []; week = String(extra.week_start).slice(0, 10); kind = 'extra';
      } else {
        const current = mobWeek(now());
        week = q.week ? String(q.week) : current;
        // A week that is not a Monday, is in the future, or is not a date at all names no paper.
        if (!WEEK_RE.test(week) || week > current || mobWeek(Date.parse(`${week}T12:00:00+05:30`)) !== week) throw new MobError('WEEK_INVALID');
        past = week < current;
        state = await mustState(userId, q.mob, { sync: week === current, week, lenient: true });
        ids = state.paper?.question_ids; sittings = state.sittings || [];
        if (past && !Array.isArray(ids)) throw new MobError('WEEK_INVALID');
      }
      if (!sittings.some((s) => s.user_id === userId)) throw new MobError(past ? 'NOT_SAT_THAT_WEEK' : 'COMPARE_SIT_FIRST');
      if (!Array.isArray(ids) || sittings.length < 2) throw new MobError(past ? 'COMPARE_PAST_ALONE' : 'COMPARE_UNAVAILABLE');
      const pro = await isPro(userId);
      let access = 'full';
      if (!pro) {
        const sum = compareSummary({ pro: false, sample: state.sample, mobId: state.mob.id, week, sittings, userId, members: state.members, nameOf: nameIn(state), count: ids.length });
        if (sum.access === 'locked') throw new MobError('PRO_REQUIRED');
        access = 'sample';
        if (sum.access === 'offer') {
          // The one free side-by-side is spent only when there is something to read: you share and someone else does.
          if (!sum.youShare) throw new MobError('SHARE_FIRST');
          if (sum.needsShare) throw new MobError('COMPARE_WAITING');
          const claim = await call('mob_sample_claim', { p_user_id: userId, p_mob_id: state.mob.id, p_week: week });
          if (!claim?.allowed) throw new MobError('PRO_REQUIRED');
        }
      }
      const questions = await deps.loadQuestions(ids).catch(() => []);
      if (!Array.isArray(questions) || !questions.length) throw new MobError('UNAVAILABLE');
      const byId = new Map(questions.map((x) => [x.id, x]));
      const keys = ids.map((id) => (Number.isInteger(byId.get(id)?.correctIndex) ? byId.get(id).correctIndex : -1));
      const raw = sittings.length >= 3 ? computeTrap(sittings, keys) : null;
      const trapName = raw && deps.trapNameFor ? await Promise.resolve(deps.trapNameFor(byId.get(ids[raw.questionIndex]), raw.optionIndex)).catch(() => null) : null;
      const out = buildCompare({
        members: state.members, sittings, ids, questions: questions.map((x) => ({ id: x.id, stem: x.stem ?? x.question ?? x.body ?? '', correctIndex: x.correctIndex })),
        userId, memberIdFor: idFor(state.mob.id), access, kind, week, extra, trapName, nameOf: nameIn(state),
      });
      const mine = sittings.find((s) => s.user_id === userId);
      // While the paper is open for the Mob, the side-by-side shows picks, splits and time but no key, no right or wrong and
      // no trap, and says when they open (src/lib/mob/paperHold.mjs). A past week or a closed extra paper is shown whole.
      const hold = attemptHold({ mobPaper: { mobId: state.mob.id, weekStart: week, ...(extra ? { extraId: extra.id, holdUntil: new Date(extra.closes_at).toISOString() } : {}) } }, now());
      return { compare: { ...(hold ? heldCompare(out, hold) : out), mobId: state.mob.id, yourResultId: mine?.session_id || null } };
    },

    /** Past weekly papers (Pro). GET /api/mob/history?mob=. */
    async history(userId, q = {}) {
      const state = await mustState(userId, q.mob, { lenient: true });
      if (!(await isPro(userId))) throw new MobError('PRO_REQUIRED');
      const rows = await call('mob_history', { p_user_id: userId, p_mob_id: state.mob.id, p_before: mobWeek(now()), p_limit: 26 });
      if (rows === null || rows === undefined) throw new MobError('NOT_IN_MOB');
      return {
        mobId: state.mob.id,
        weeks: rows.map((w) => ({
          week: String(w.week_start).slice(0, 10), closedAt: closesAt(String(w.week_start).slice(0, 10)), sat: Number(w.sat), extras: Number(w.extras),
          you: w.mine ? { sat: true, score: { value: Number(w.mine.score), of: Number(w.mine.max_score) }, resultId: w.mine.session_id } : { sat: false },
        })),
      };
    },

    /** Make an extra paper on a chosen chapter and length (Pro). POST /api/mob/extra { mob, chapter?, count }. */
    async createExtra(userId, body = {}) {
      const state = await mustState(userId, body.mob);
      if (!(await isPro(userId))) throw new MobError('PRO_REQUIRED');
      const count = body.count === undefined ? PAPER_COUNT : body.count;
      if (!EXTRA_LENGTHS.includes(count)) throw new MobError('LENGTH_INVALID');
      const chapter = typeof body.chapter === 'string' && body.chapter.trim() ? body.chapter.trim() : null;
      if (body.chapter !== undefined && body.chapter !== null && typeof body.chapter !== 'string') throw new MobError('CHAPTER_INVALID');
      if (chapter && (chapter.length > 120 || !deps.validChapter || !deps.validChapter(state.mob.subject, chapter))) throw new MobError('CHAPTER_INVALID');
      const key = `x${Array.from(deps.randomBytes(6), (b) => b.toString(16).padStart(2, '0')).join('')}`;
      const picked = await deps.pickQuestionIds(state.mob.subject, { mobId: state.mob.id, week: state.week, count, chapter, key }).catch(() => []);
      if (!Array.isArray(picked) || picked.length < count) {
        // The selector answers all or nothing for a length it cannot fill, so its count says little. The chooser's
        // probe says the longest paper this chapter can build; if even that claimed this length, it is stale: drop it
        // and say what really happened.
        let ready = Array.isArray(picked) ? picked.length : 0;
        if (chapter && deps.chapterCounts) {
          const known = (await deps.chapterCounts(state.mob.subject).catch(() => null))?.find((r) => r.chapter === chapter);
          if (known && Number(known.ready) < count) ready = Number(known.ready) || 0;
          else if (deps.forgetChapterCounts) deps.forgetChapterCounts(state.mob.subject);
        }
        throw thinBank({ ready, count, chapter, subjectName: subjectName(state.mob.subject) || 'This subject' });
      }
      const r = await call('mob_extra_put', {
        p_user_id: userId, p_mob_id: state.mob.id, p_week: state.week, p_chapter: chapter, p_ids: picked.slice(0, count),
        p_closes_at: new Date(now() + EXTRA_OPEN_DAYS * DAY_MS).toISOString(), p_max_per_week: EXTRA_MAX_PER_WEEK,
      });
      if (r?.status === 'limit') throw new MobError('EXTRA_LIMIT');
      if (r?.status !== 'ok') throw new MobError('NOT_IN_MOB');
      return { ...(await viewAfterWrite(userId, { mobId: state.mob.id, sync: false })), extraId: r.id };
    },

    /**
     * The extra-paper chooser (Pro): each chapter of the Mob's subject with how many questions are ready in the bank,
     * so a student picks a chapter that can make the paper. GET /api/mob/extra?mob=.
     */
    async chapters(userId, q = {}) {
      const state = await mustState(userId, q.mob, { lenient: true });
      if (!(await isPro(userId))) throw new MobError('PRO_REQUIRED');
      const rows = deps.chapterCounts ? await deps.chapterCounts(state.mob.subject).catch(() => null) : null;
      if (!Array.isArray(rows)) throw new MobError('UNAVAILABLE');
      const min = Math.min(...EXTRA_LENGTHS);
      return {
        mobId: state.mob.id,
        lengths: [...EXTRA_LENGTHS],
        chapters: rows.map((r) => ({ chapter: r.chapter, ready: Number(r.ready) || 0, longest: longestFor(Number(r.ready) || 0) }))
          .filter((r) => r.ready >= min && (!deps.validChapter || deps.validChapter(state.mob.subject, r.chapter))).sort((a, b) => b.ready - a.ready || a.chapter.localeCompare(b.chapter)),
      };
    },

    /**
     * finishPractice's hook: record a finished Mob paper. Returns 'recorded' | 'exists' | 'late' | 'skipped'.
     * Never throws: a Mob that is gone (left, undone migration) leaves an ordinary finished practice.
     */
    async recordFromAttempt(userId, attempt) {
      try {
        const tag = attempt?.selectionMeta?.mobPaper;
        if (!tag?.mobId || !tag?.weekStart) return 'skipped';
        // A Mob game's full mock (Full mock together) is recorded on its game, not as the week's paper.
        if (tag.gameId) return v3On() ? await v3.recordMock(userId, tag, attempt) : 'skipped';
        if (tag.extraId) {
          const extra = await call('mob_extra_get', { p_user_id: userId, p_extra_id: tag.extraId });
          if (!extra || extra.mob_id !== tag.mobId) return 'skipped';
          if (!Number.isFinite(attempt.completedAt) || attempt.completedAt >= Date.parse(extra.closes_at)) return 'late';
          return await call('mob_extra_record', extraParams(userId, extra, attempt));
        }
        if (!finishedInWindow(tag.weekStart, attempt.completedAt)) return 'late';
        const state = await readState(userId, tag.weekStart, tag.mobId);
        if (!state || state.mob.id !== tag.mobId || !Array.isArray(state.paper?.question_ids)) return 'skipped';
        return await call('mob_record_sitting', sittingParams(userId, tag.mobId, tag.weekStart, state.paper.question_ids, attempt));
      } catch { return 'skipped'; }
    },
  };

  v3 = createMobV3Service(deps, { view, thinBank });
  service.v3 = v3;
  service.v3On = v3On;
  return service;

  async function startExtra(userId, state, body) {
    if (!validMobId(body.extra)) throw new MobError('EXTRA_NOT_FOUND');
    const extra = await call('mob_extra_get', { p_user_id: userId, p_extra_id: body.extra });
    if (!extra || extra.mob_id !== state.mob.id) throw new MobError('EXTRA_NOT_FOUND');
    if ((extra.sittings || []).some((s) => s.user_id === userId)) throw new MobError('EXTRA_ALREADY_SAT');
    if (extraTooLate(extra)) throw new MobError('EXTRA_CLOSED');
    const questions = await deps.loadQuestions(extra.question_ids).catch(() => []);
    if (!Array.isArray(questions) || questions.length !== extra.question_ids.length) throw new MobError('PAPER_UNAVAILABLE');
    const generationKey = `mob_${createHmac('sha256', String(deps.secret || 'mob')).update(`extra:${extra.id}:${userId}`).digest('hex').slice(0, 40)}`;
    const input = { experience: 'practice', mode: 'quick', count: questions.length, subject: state.mob.subject, generationKey };
    if (typeof body.startReceipt === 'string' && body.startReceipt.length <= 2000) input.startReceipt = body.startReceipt;
    return runStart(userId, input, { mobPaper: { mobId: state.mob.id, weekStart: String(extra.week_start).slice(0, 10), extraId: extra.id, holdUntil: holdStamp({ extraClosesAt: extra.closes_at }), questions } }, { extra: true });
  }

  /**
   * Full mock together: sit the Mob's frozen 50-question paper in the practice runner (mode full, 60 minutes). The same
   * questions in the same order for every member, never the first free full mock (a Mob paper), the answers held until
   * the game closes. A Pro member starts the game; everyone in the Mob sits it.
   * The price (owner D174, src/lib/mob/mockPrice.mjs): Pro sits free; a Free member pays the solo Full mock's 50 credits.
   * The charge is the solo Full mock's, made by startPractice after every check here has passed and the paper is built:
   * the credit action 'attempt_full' on the one ledger, atomic with the session (start_learning_session) or as the last
   * step of a device-held start, under a reference made from the session id. That id comes from a key fixed per game and
   * member, so a retry (or a resume) finds the same reference and is never charged twice. A start refused before the
   * charge (closed, too late, already sat, paper not built, too few credits) charges nothing; there is nothing to refund.
   */
  async function startMock(userId, state, body) {
    if (!v3On()) throw new MobError('MOB_DISABLED');
    const { g, questions } = await v3.mockPaper(userId, state, body.game);
    const generationKey = `mob_${createHmac('sha256', String(deps.secret || 'mob')).update(`game:${g.id}:${userId}`).digest('hex').slice(0, 40)}`;
    const input = { experience: 'practice', mode: 'full', count: questions.length, subject: g.subject, generationKey };
    if (typeof body.startReceipt === 'string' && body.startReceipt.length <= 2000) input.startReceipt = body.startReceipt;
    // The plan, read here on the server (a failed read is Free). practiceCharge re-checks isPremium before charging.
    const pro = await isPro(userId);
    const creditAction = mockSitAction({ pro });
    const out = await runStart(userId, input, { mobPaper: { mobId: state.mob.id, weekStart: String(g.week_start).slice(0, 10), gameId: g.id, holdUntil: new Date(g.closes_at).toISOString(), questions, creditAction } }, { game: true, pro });
    await v3.mockBegin(userId, g.id);
    return out;
  }

  async function runStart(userId, input, server, { extra = false, game = false, pro = false } = {}) {
    try {
      return await deps.startPractice(userId, input, server);
    } catch (error) {
      const m = String(error?.message || '');
      // A Full mock together a Free member cannot pay for: the price, so a client can offer the wallet or Pro.
      if (/CREDITS/.test(m) && game && !pro) throw new MobError('MOCK_CREDITS', { detail: mockGamePrice({ pro: false }) });
      if (/CREDITS/.test(m)) throw new MobError('CREDITS');
      if (/SESSION_EXPIRED/.test(m)) throw new MobError('PAPER_EXPIRED');
      if (/ALREADY_SUBMITTED/.test(m)) throw new MobError(game ? 'RUN_DONE' : extra ? 'EXTRA_ALREADY_SAT' : 'PAPER_ALREADY_SAT');
      if (/INSUFFICIENT_PRACTICE_CONTENT|SUBJECT_NOT_SUPPORTED/.test(m)) throw new MobError('PAPER_UNAVAILABLE');
      if (/MIGRATION/.test(m)) throw new MobError('MIGRATION');
      if (error instanceof MobError) throw error;
      throw new MobError('UNAVAILABLE', { cause: error });
    }
  }
}
