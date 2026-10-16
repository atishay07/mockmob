// The Mob's server logic (SOCIAL-SPEC sections 5 and 6). No 'server-only' and no '@/' imports on purpose, so
// node:test drives it against the real migration on PGlite (data/tests/mob.test.mjs); src/lib/server/mob/deps.js wires
// the production pieces (Supabase, the question bank, the practice session engine).
//
// Every write goes through one of the migration's functions, which take the acting user id from here and hold a
// per-Mob lock. User ids never leave the server: members are addressed by memberId, an HMAC of (mobId, userId).
// Nothing here grants, spends or rewards credits or money; a Mob paper is started by startPractice, which applies the
// same charge as any quick 10 (D-S2 default).
// TODO(owner D-S4): an invite tied to credits is the owner's decision and is not built. Do not add one here.
import { createHmac } from 'node:crypto';
import {
  CODE_ALPHABET, INVITE_DAYS, MobError, PAPER_COUNT, REPORT_REASONS, buildView, checkColour, checkName, codeFromBytes,
  computeTrap, finishedInWindow, mobWeek, normalizeCode, picksFromAttempt, tooLateToStart, trapPayload,
} from '../../mob/model.mjs';

const DAY_MS = 86_400_000;
const missingSchema = (e) => /PGRST20[25]|42883|42P01|does not exist|schema cache|Could not find the function/i.test(`${e?.code || ''} ${e?.message || ''}`);

/** memberId: the first 12 Crockford characters of HMAC-SHA256(secret, mobId:userId). */
export function memberIdFor(secret, mobId, userId) {
  const digest = createHmac('sha256', String(secret || 'mob')).update(`${mobId}:${userId}`).digest();
  let out = '';
  for (let i = 0; i < 12; i += 1) out += CODE_ALPHABET[digest[i] & 31];
  return out;
}

/**
 * deps: {
 *   rpc(name, params) -> data            the migration's functions (throws { code, message } on failure)
 *   now() -> ms, randomBytes(n) -> Uint8Array, secret
 *   blocklist                              data/mob_name_blocklist.json
 *   subjectInfo(subject) -> { ok, id, name }   a launchable subject, stored id and its official name
 *   loadUser(userId) -> { isPremium, creditBalance } | null
 *   allowanceEnabled, readAllowanceUsed(userId) -> true | false | null
 *   pickQuestionIds(subject, { mobId, week }) -> string[]   from the central bank, no personal exclusions
 *   loadQuestions(ids) -> questions in that order (missing ones left out)
 *   trapNameFor(question, optionIndex) -> string | null
 *   findAttempts(userIds, { mobId, week }) -> [{ id, userId, correct, total, details, completedAt }]
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

  async function readState(userId, week) {
    const state = await call('mob_state', { p_user_id: userId, p_week: week });
    if (!state || !state.mob) return null;
    return { ...state, week };
  }

  /**
   * A paper finished through the durable session path (finishSession) never passes finishPractice, so a read records
   * any finished Mob paper of this week the members have not been credited with yet. Idempotent; a failure here only
   * leaves the ring as it was.
   */
  async function syncSittings(state, userId) {
    const ids = state.paper?.question_ids;
    if (!Array.isArray(ids) || !deps.findAttempts) return state;
    const sat = new Set((state.sittings || []).map((s) => s.user_id));
    const missing = (state.members || []).map((m) => m.user_id).filter((u) => !sat.has(u));
    if (!missing.length) return state;
    let recorded = 0;
    try {
      const attempts = await deps.findAttempts(missing, { mobId: state.mob.id, week: state.week });
      for (const a of attempts || []) {
        if (!missing.includes(a.userId) || !finishedInWindow(state.week, a.completedAt)) continue;
        const r = await call('mob_record_sitting', sittingParams(a.userId, state.mob.id, state.week, ids, a));
        if (r === 'recorded') recorded += 1;
      }
    } catch { return state; }
    return recorded ? readState(userId, state.week) : state;
  }

  const sittingParams = (userId, mobId, week, questionIds, attempt) => ({
    p_user_id: userId, p_mob_id: mobId, p_week: week, p_session_id: String(attempt.id),
    p_score: Number(attempt.correct) || 0, p_max_score: Math.max(1, Number(attempt.total) || questionIds.length),
    p_picks: picksFromAttempt(questionIds, attempt), p_sat_at: new Date(attempt.completedAt || now()).toISOString(),
  });

  async function cost(userId) {
    const user = deps.loadUser ? await deps.loadUser(userId).catch(() => null) : null;
    if (!user) return null;
    if (user.isPremium === true) return { type: 'included' };
    if (deps.allowanceEnabled && deps.readAllowanceUsed) {
      const used = await deps.readAllowanceUsed(userId).catch(() => null);
      if (used === false) return { type: 'allowance' };
    }
    return { type: 'credits', credits: 10, balance: Math.max(0, Number(user.creditBalance) || 0) };
  }

  async function trapFor(state, userId) {
    const sittings = state.sittings || [];
    const mine = sittings.find((s) => s.user_id === userId);
    const ids = state.paper?.question_ids;
    if (!mine || sittings.length < 3 || !Array.isArray(ids) || !deps.loadQuestions) return null;
    try {
      const questions = await deps.loadQuestions(ids);
      const byId = new Map(questions.map((q) => [q.id, q]));
      const keys = ids.map((id) => (Number.isInteger(byId.get(id)?.correctIndex) ? byId.get(id).correctIndex : -1));
      const raw = computeTrap(sittings, keys);
      if (!raw) return null;
      const question = byId.get(ids[raw.questionIndex]);
      const trapName = deps.trapNameFor ? await Promise.resolve(deps.trapNameFor(question, raw.optionIndex)).catch(() => null) : null;
      return trapPayload(raw, { questionId: ids[raw.questionIndex], trapName, youPicked: mine.picks?.[raw.questionIndex], key: keys[raw.questionIndex] });
    } catch { return null; }
  }

  async function view(userId, { sync = true } = {}) {
    const week = mobWeek(now());
    let state = await readState(userId, week);
    if (!state) return { mob: null };
    if (sync) state = await syncSittings(state, userId);
    const youSat = (state.sittings || []).some((s) => s.user_id === userId);
    const [paperCost, trap] = await Promise.all([youSat ? null : cost(userId), trapFor(state, userId)]);
    const subject = deps.subjectInfo ? deps.subjectInfo(state.mob.subject) : null;
    return buildView(state, { userId, now: now(), memberIdFor: idFor(state.mob.id), cost: paperCost, trap, subjectName: subject?.name || null });
  }

  async function mustState(userId, { sync = false } = {}) {
    const state = await readState(userId, mobWeek(now()));
    if (!state) throw new MobError('NOT_IN_MOB');
    return sync ? syncSittings(state, userId) : state;
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

  return {
    view,

    async create(userId, body) {
      const subject = deps.subjectInfo(body.subject);
      if (!subject?.ok) throw new MobError('SUBJECT_INVALID');
      const { name, colour } = nameAndColour(body, { required: true });
      const r = await call('mob_create', { p_user_id: userId, p_subject: subject.id, p_name: name, p_colour: colour });
      if (r === 'already') throw new MobError('ALREADY_IN_MOB');
      return view(userId, { sync: false });
    },

    async invite(userId) {
      const expires = new Date(now() + INVITE_DAYS * DAY_MS).toISOString();
      for (let attempt = 0; attempt < 3; attempt += 1) {
        const code = codeFromBytes(deps.randomBytes(5));
        let r;
        try {
          r = await deps.rpc('mob_invite_new', { p_user_id: userId, p_code: code, p_expires_at: expires });
        } catch (error) {
          if (/23505|duplicate key/.test(`${error?.code || ''} ${error?.message || ''}`)) continue; // a 40-bit collision: draw again
          throw new MobError(missingSchema(error) ? 'MIGRATION' : 'UNAVAILABLE', { cause: error });
        }
        if (r === 'not_member') throw new MobError('NOT_IN_MOB');
        if (r === 'full') throw new MobError('MOB_FULL');
        const out = await view(userId, { sync: false });
        if (!out.mob?.invite) throw new MobError('UNAVAILABLE');
        return out.mob.invite;
      }
      throw new MobError('UNAVAILABLE');
    },

    /** Public: never a name, never a member id. */
    async lookup(rawCode) {
      const code = normalizeCode(rawCode);
      if (!code) throw new MobError('INVITE_INVALID');
      const r = await call('mob_invite_lookup', { p_code: code });
      if (r?.status === 'expired') throw new MobError('INVITE_EXPIRED');
      if (r?.status !== 'valid') throw new MobError('INVITE_INVALID');
      const subject = deps.subjectInfo ? deps.subjectInfo(r.subject) : null;
      return { valid: true, code, subject: r.subject, subjectName: subject?.name || r.subject, size: Number(r.size), seatsLeft: Number(r.seats_left), expiresAt: new Date(r.expires_at).toISOString() };
    },

    async join(userId, body) {
      const code = normalizeCode(body.code);
      if (!code) throw new MobError('INVITE_INVALID');
      const { name, colour } = nameAndColour(body, { required: true });
      const r = await call('mob_join', { p_user_id: userId, p_code: code, p_name: name, p_colour: colour });
      // P10: a block either way reads exactly like a bad code, so the joiner learns nothing.
      if (r === 'invalid' || r === 'blocked') throw new MobError('INVITE_INVALID');
      if (r === 'expired') throw new MobError('INVITE_EXPIRED');
      if (r === 'full') throw new MobError('MOB_FULL');
      if (r === 'already') throw new MobError('ALREADY_IN_MOB');
      return view(userId, { sync: false });
    },

    async patchMe(userId, body) {
      const { name, colour } = nameAndColour(body, { required: false });
      const flags = {};
      for (const key of ['showScore', 'nudgesMuted']) {
        if (body[key] === undefined) continue;
        if (typeof body[key] !== 'boolean') throw new MobError('BODY_INVALID');
        flags[key] = body[key];
      }
      if (name === undefined && colour === undefined && !Object.keys(flags).length) throw new MobError('BODY_INVALID');
      const r = await call('mob_patch_me', {
        p_user_id: userId, p_name: name ?? null, p_colour: colour ?? null,
        p_show_score: flags.showScore ?? null, p_nudges_muted: flags.nudgesMuted ?? null,
      });
      if (r === 'not_member') throw new MobError('NOT_IN_MOB');
      return view(userId, { sync: false });
    },

    async leave(userId, body = {}) {
      const state = await mustState(userId);
      if (body.block !== undefined && body.block !== null) {
        const target = memberByMemberId(state, body.block);
        if (!target || target.user_id === userId) throw new MobError('NOT_FOUND');
        await call('mob_block', { p_blocker: userId, p_blocked: target.user_id });
      }
      const r = await call('mob_leave', { p_user_id: userId });
      if (r === 'not_member') throw new MobError('NOT_IN_MOB');
      return { left: true };
    },

    async remove(userId, body = {}) {
      const state = await mustState(userId);
      const target = memberByMemberId(state, body.memberId);
      if (!target) throw new MobError('NOT_FOUND');
      const r = await call('mob_remove', { p_actor: userId, p_mob_id: state.mob.id, p_target: target.user_id });
      if (r === 'not_owner') throw new MobError('NOT_OWNER');
      if (r !== 'removed') throw new MobError(r === 'not_member' ? 'NOT_IN_MOB' : 'NOT_FOUND');
      return view(userId, { sync: false });
    },

    async report(userId, body = {}) {
      if (!REPORT_REASONS.includes(body.reason)) throw new MobError('REASON_INVALID');
      for (const key of ['alsoLeave', 'block']) if (body[key] !== undefined && typeof body[key] !== 'boolean') throw new MobError('BODY_INVALID');
      const state = await mustState(userId);
      const target = memberByMemberId(state, body.memberId);
      if (!target || target.user_id === userId) throw new MobError('NOT_FOUND');
      const r = await call('mob_report', { p_reporter: userId, p_reported: target.user_id, p_reason: body.reason });
      if (r !== 'reported') throw new MobError('NOT_FOUND');
      if (body.block === true) await call('mob_block', { p_blocker: userId, p_blocked: target.user_id });
      if (body.alsoLeave === true || body.block === true) await call('mob_leave', { p_user_id: userId });
      return { reported: true, left: body.alsoLeave === true || body.block === true };
    },

    async nudge(userId) {
      const state = await mustState(userId, { sync: true });
      const r = await call('mob_nudge', { p_user_id: userId, p_week: state.week });
      if (r?.status === 'not_member') throw new MobError('NOT_IN_MOB');
      if (r?.status === 'not_sat') throw new MobError('NOT_SAT_YET');
      if (r?.status === 'already') throw new MobError('ALREADY_NUDGED');
      return { sent: true, to: Math.max(0, Number(r?.to) || 0) };
    },

    async nudgeSeen(userId) {
      const r = await call('mob_nudge_seen_mark', { p_user_id: userId, p_week: mobWeek(now()) });
      if (r === -1) throw new MobError('NOT_IN_MOB');
      return { ok: true };
    },

    /** Start (or resume) this week's paper: the same 10 questions in the same option order for every member. */
    async startPaper(userId, body = {}) {
      const state = await mustState(userId, { sync: true });
      if ((state.sittings || []).some((s) => s.user_id === userId)) throw new MobError('PAPER_ALREADY_SAT');
      if (tooLateToStart(state.week, now())) throw new MobError('WEEK_CLOSED');
      let ids = state.paper?.question_ids;
      if (!Array.isArray(ids)) {
        const picked = await deps.pickQuestionIds(state.mob.subject, { mobId: state.mob.id, week: state.week }).catch(() => []);
        if (!Array.isArray(picked) || picked.length < PAPER_COUNT) throw new MobError('PAPER_UNAVAILABLE');
        ids = await call('mob_paper_put', { p_mob_id: state.mob.id, p_week: state.week, p_subject: state.mob.subject, p_ids: picked.slice(0, PAPER_COUNT) });
      }
      const questions = await deps.loadQuestions(ids).catch(() => []);
      if (!Array.isArray(questions) || questions.length !== ids.length) throw new MobError('PAPER_UNAVAILABLE');
      // One key per member and week: a retry resumes the same session and is never charged twice.
      const generationKey = `mob_${createHmac('sha256', String(deps.secret || 'mob')).update(`paper:${state.mob.id}:${state.week}:${userId}`).digest('hex').slice(0, 40)}`;
      const input = { experience: 'practice', mode: 'quick', count: questions.length, subject: state.mob.subject, generationKey };
      if (typeof body.startReceipt === 'string' && body.startReceipt.length <= 2000) input.startReceipt = body.startReceipt;
      try {
        return await deps.startPractice(userId, input, { mobPaper: { mobId: state.mob.id, weekStart: state.week, questions } });
      } catch (error) {
        const m = String(error?.message || '');
        if (/CREDITS/.test(m)) throw new MobError('CREDITS');
        if (/SESSION_EXPIRED/.test(m)) throw new MobError('PAPER_EXPIRED');
        if (/ALREADY_SUBMITTED/.test(m)) throw new MobError('PAPER_ALREADY_SAT');
        if (/INSUFFICIENT_PRACTICE_CONTENT|SUBJECT_NOT_SUPPORTED/.test(m)) throw new MobError('PAPER_UNAVAILABLE');
        if (/MIGRATION/.test(m)) throw new MobError('MIGRATION');
        throw new MobError('UNAVAILABLE', { cause: error });
      }
    },

    /**
     * finishPractice's hook: record a finished Mob paper. Returns 'recorded' | 'exists' | 'late' | 'skipped'.
     * Never throws: a Mob that is gone (left, undone migration) leaves an ordinary finished practice.
     */
    async recordFromAttempt(userId, attempt) {
      try {
        const tag = attempt?.selectionMeta?.mobPaper;
        if (!tag?.mobId || !tag?.weekStart) return 'skipped';
        if (!finishedInWindow(tag.weekStart, attempt.completedAt)) return 'late';
        const state = await readState(userId, tag.weekStart);
        if (!state || state.mob.id !== tag.mobId || !Array.isArray(state.paper?.question_ids)) return 'skipped';
        return await call('mob_record_sitting', sittingParams(userId, tag.mobId, tag.weekStart, state.paper.question_ids, attempt));
      } catch { return 'skipped'; }
    },
  };
}
