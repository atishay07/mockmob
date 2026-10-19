// Mob v3 on the server (MOB-BUILD-SPEC-V3 sections 3 and 5.9): games, runs, answers, podium, review, Fix it together,
// the quest, the Mob chain, stickers, the mic, step-outs, settings, the seat Fold, the shelf and the unlock checks.
// No 'server-only' and no '@/' imports, so node:test drives it on PGlite with the real migrations
// (data/tests/mob_v3.test.mjs). Every write goes through a migration function; every number shown comes from here.
//
// Safety rules that live here:
//   F1  No correct option or explanation for a game before closes_at, on any route. Questions sent while a game is open
//       go through publicQuestion (no key, no explanation). The answer route returns only your own right or wrong.
//   F2  Runs are finished runs with times; nothing names or counts a member who has not played.
//   F3  The trap is "most of you"; no other member's pick is ever returned.
//   Plan status: the API never says another member's plan; starts are decided from server facts only.
import { MobError, UUID_RE, mobWeek } from '../../mob/model.mjs';
import { mobName, validNameKey } from '../../mob/names.mjs';
import { FOIL_DAYS, FOLDS, FOLD_KEYS, FINISHES, STARTERS, isFold, mobShelf, parcelFor, ruleProgress } from '../../mob/folds.mjs';
import { MAX_OPEN_GAMES, MICS_PER_WEEK, inLiveHours, startRight, startsView } from '../../mob/starts.mjs';
import { COUNTS, assignMoments, checkWindow, gameTrap, ghostOf, placeRuns, publicQuestion, tieFor } from '../../mob/games.mjs';
import { gameTitle, questLabels, questView } from '../../mob/quest.mjs';
import { computeMobChain } from '../../mob/mobChain.mjs';
import { cameBack, chainChip } from '../../chain/chain.mjs';
import { createChainService } from '../chain.js';
import { memberIdFor } from './memberId.js';

export const STICKERS = Object.freeze(['nice_one', 'so_close', 'teach_me', 'again', 'good_luck', 'lets_go', 'one_sec', 'ready']);
export const FIXED_FOR_CRANE = 3;
const missingSchema = (e) => /PGRST20[25]|42883|42P01|does not exist|schema cache|Could not find the function/i.test(`${e?.code || ''} ${e?.message || ''}`);
const iso = (v) => (v ? new Date(v).toISOString() : null);
const validId = (v) => typeof v === 'string' && UUID_RE.test(v);

/**
 * deps: the Mob service deps (rpc, now, secret, loadUser, subjectInfo, validChapter, pickQuestionIds, loadQuestions,
 * randomBytes) plus billingOn() -> boolean (PLAY_BILLING_ENABLED, read every request) and liveEnabled() -> boolean
 * (MOB_LIVE_ENABLED). helpers: { view(userId, opts) (the GET /api/mob view), thinBank(...) }.
 */
export function createMobV3Service(deps, helpers = {}) {
  const now = () => (deps.now ? deps.now() : Date.now());
  const nowIso = () => new Date(now()).toISOString();
  const call = async (name, params) => {
    try { return await deps.rpc(name, params); } catch (error) {
      if (error instanceof MobError) throw error;
      throw new MobError(missingSchema(error) ? 'MIGRATION' : 'UNAVAILABLE', { cause: error });
    }
  };
  const chains = createChainService({ rpc: deps.rpc, now });
  const billingOn = () => (deps.billingOn ? deps.billingOn() === true : false);
  const liveOn = () => (deps.liveEnabled ? deps.liveEnabled() === true : false);
  const isPro = async (userId) => (deps.loadUser ? (await deps.loadUser(userId).catch(() => null))?.isPremium === true : false);
  const subjectName = (subject) => (deps.subjectInfo ? deps.subjectInfo(subject)?.name || subject : subject);

  async function readState(userId, mobId) {
    const state = await call('mob_state', { p_user_id: userId, p_week: mobWeek(now()), p_mob_id: mobId || null, p_now: nowIso() });
    if (!state || !state.mob) return null;
    return state;
  }
  async function mustState(userId, mobId) {
    if (mobId !== undefined && mobId !== null && !validId(mobId)) throw new MobError('NOT_IN_MOB');
    const state = await readState(userId, mobId || null);
    if (!state) throw new MobError('NOT_IN_MOB');
    if (!mobId && (state.mobs || []).length > 1) throw new MobError('MOB_REQUIRED');
    return state;
  }

  // Members as everyone else sees them: memberId, first name, colour, Fold. Never a user id or a plan.
  const memberMap = (state, userId) => {
    const ids = (u) => memberIdFor(deps.secret, state.mob.id, u);
    const ownerId = (state.members || []).find((m) => m.role === 'owner')?.user_id;
    return new Map((state.members || []).map((m) => [m.user_id, {
      memberId: ids(m.user_id), name: m.display_name, colour: m.colour, fold: m.fold || 'dart', finish: m.finish || 'plain',
      you: m.user_id === userId, owner: m.user_id === ownerId, showScore: m.show_score !== false, joinedAt: m.joined_at,
    }]));
  };

  // ------------------------------------------------------------------ games

  /** Settle a closed game once: the trap from every pick (server-only) and the bank key, then mob_game_settle. */
  async function ensureSettled(g) {
    if (!g?.closed || g.closed_settled_at) return;
    const picks = await call('mob_game_picks_closed', { p_game_id: g.id, p_now: nowIso() });
    let trap = null;
    if (Array.isArray(picks) && picks.length >= 3) {
      const questions = await deps.loadQuestions(g.question_ids).catch(() => []);
      const byId = new Map((questions || []).map((x) => [x.id, x]));
      const keys = g.question_ids.map((id) => (Number.isInteger(byId.get(id)?.correctIndex) ? byId.get(id).correctIndex : -1));
      const t = gameTrap(picks.map((p) => p.picks), keys);
      if (t) {
        const w = checkWindow(Date.parse(g.closes_at));
        trap = { q: t.q, question_id: g.question_ids[t.q], check_opens_at: w.opensAt, check_closes_at: w.closesAt };
      }
    }
    await call('mob_game_settle', { p_game_id: g.id, p_now: nowIso(), p_trap: trap });
    g.closed_settled_at = nowIso();
  }

  const finishedRuns = (g) => (g.runs || []).filter((r) => r.finished_at).sort((a, b) => Date.parse(a.finished_at) - Date.parse(b.finished_at));

  /** The den's compact game (3.1 games[]). */
  function denGame(g, members, userId) {
    const host = members.get(g.created_by);
    const mine = (g.runs || []).find((r) => r.user_id === userId);
    const yourRun = !mine ? 'none' : mine.finished_at ? 'finished' : 'playing';
    return {
      id: g.id, format: g.format, mode: g.mode, count: g.question_ids.length, chapter: g.chapter || null, subjectName: subjectName(g.subject),
      title: gameTitle(host?.name, g.format, g.created_by === userId),
      host: host ? { memberId: host.memberId, name: host.name } : null,
      openedAt: iso(g.opened_at), closesAt: iso(g.closes_at), closed: g.closed === true,
      room: g.room_state ? { state: g.room_state, startsAt: iso(g.room_starts_at) } : null,
      runs: finishedRuns(g).filter((r) => members.has(r.user_id)).map((r) => ({ memberId: members.get(r.user_id).memberId, name: members.get(r.user_id).name, at: iso(r.finished_at) })),
      yourRun, podiumReady: yourRun === 'finished' || g.closed === true,
    };
  }

  /** The game view (3.4). ghosts: finished runs of others, plus your own earlier run on a rematch. */
  async function gameView(g, members, userId) {
    const host = members.get(g.created_by);
    const mine = (g.runs || []).find((r) => r.user_id === userId);
    const runs = finishedRuns(g).filter((r) => members.has(r.user_id)).map((r) => {
      const m = members.get(r.user_id);
      return { memberId: m.memberId, name: m.name, colour: m.colour, fold: m.fold, at: iso(r.finished_at), finished: true };
    });
    if (g.room_state === 'running') {
      for (const r of (g.runs || []).filter((x) => x.live && !x.finished_at && members.has(x.user_id))) {
        const m = members.get(r.user_id);
        runs.push({ memberId: m.memberId, name: m.name, colour: m.colour, fold: m.fold, at: null, finished: false, answered: Number(r.answered) || 0 });
      }
    }
    const ghosts = finishedRuns(g).filter((r) => r.user_id !== userId && members.has(r.user_id)).map((r) => ghostOf({ arrivals: r.arrivals, finishedAt: r.finished_at, startedAt: r.started_at }, members.get(r.user_id)));
    if (g.rematch_of) {
      const prev = await call('mob_game_json', { p_game_id: g.rematch_of, p_user_id: userId, p_now: nowIso() }).catch(() => null);
      const own = prev ? finishedRuns(prev).find((r) => r.user_id === userId) : null;
      if (own && members.has(userId)) ghosts.push(ghostOf({ arrivals: own.arrivals, finishedAt: own.finished_at, startedAt: own.started_at }, members.get(userId)));
    }
    const yourRun = !mine ? 'none' : mine.finished_at ? 'finished' : 'playing';
    return {
      id: g.id, mobId: g.mob_id, format: g.format, mode: g.mode, count: g.question_ids.length, secondsPerQuestion: g.seconds_per_question,
      subjectName: subjectName(g.subject), chapter: g.chapter || null, title: gameTitle(host?.name, g.format, g.created_by === userId),
      host: host ? { memberId: host.memberId, name: host.name, you: g.created_by === userId } : null,
      openedAt: iso(g.opened_at), closesAt: iso(g.closes_at), closed: g.closed === true, serverNow: nowIso(),
      room: g.room_state ? { state: g.room_state, startsAt: iso(g.room_starts_at), endsAt: iso(g.room_ends_at) } : null,
      runs, you: { run: yourRun, marks: mine ? Number(mine.marks) : null, answered: mine ? Number(mine.answered) || 0 : 0 },
      ghosts, podiumReady: yourRun === 'finished' || g.closed === true,
    };
  }

  /** A game of a Mob you are in, with its Mob's members. GAME_NOT_FOUND otherwise. Settles a closed game once. */
  async function loadGame(userId, gameId) {
    if (!validId(gameId)) throw new MobError('GAME_NOT_FOUND');
    const g = await call('mob_game_json', { p_game_id: gameId, p_user_id: userId, p_now: nowIso() });
    if (!g) throw new MobError('GAME_NOT_FOUND');
    const state = await readState(userId, g.mob_id);
    if (!state) throw new MobError('GAME_NOT_FOUND');
    await ensureSettled(g);
    return { g, state, members: memberMap(state, userId) };
  }

  async function openGame(userId, body = {}) {
    const state = await mustState(userId, body.mob);
    const mode = body.mode === undefined ? 'async' : body.mode;
    if (!['live', 'async'].includes(mode) || !['sprint', 'round', 'rematch'].includes(body.format)) throw new MobError('BODY_INVALID');
    let format = body.format; let count; let chapter = null; let rematchOf = null;
    if (format === 'rematch') {
      if (!validId(body.rematchOf)) throw new MobError('GAME_NOT_FOUND');
      const prev = await call('mob_game_json', { p_game_id: body.rematchOf, p_user_id: userId, p_now: nowIso() });
      if (!prev || prev.mob_id !== state.mob.id) throw new MobError('GAME_NOT_FOUND');
      count = prev.question_ids.length; chapter = prev.chapter || null; rematchOf = prev.id;
    } else {
      count = body.count === undefined ? (format === 'sprint' ? 5 : 10) : body.count;
      if (!COUNTS[format].includes(count)) throw new MobError('LENGTH_INVALID');
      if (body.chapter !== undefined && body.chapter !== null && typeof body.chapter !== 'string') throw new MobError('CHAPTER_INVALID');
      chapter = typeof body.chapter === 'string' && body.chapter.trim() ? body.chapter.trim() : null;
      if (chapter && (chapter.length > 120 || !deps.validChapter || !deps.validChapter(state.mob.subject, chapter))) throw new MobError('CHAPTER_INVALID');
    }
    const week = mobWeek(now());
    const pro = billingOn() ? await isPro(userId) : false;
    const status = await call('mob_start_status', { p_user_id: userId, p_mob_id: state.mob.id, p_week: week });
    const right = startRight({ billingOn: billingOn(), pro, mode, format, claimUsed: status?.claim_used === true, micsHeld: Number(status?.mics) || 0, liveOn: liveOn(), inLiveHours: inLiveHours(now()) });
    if (!right.ok) throw new MobError(right.code);
    const key = `g${Array.from(deps.randomBytes(6), (b) => b.toString(16).padStart(2, '0')).join('')}`;
    const picked = await deps.pickQuestionIds(state.mob.subject, { mobId: state.mob.id, week, count, chapter, key }).catch(() => []);
    if (!Array.isArray(picked) || picked.length < count) {
      throw helpers.thinBank ? helpers.thinBank({ ready: Array.isArray(picked) ? picked.length : 0, count, chapter, subjectName: subjectName(state.mob.subject) }) : new MobError('BANK_THIN');
    }
    const r = await call('mob_game_open', {
      p_user_id: userId, p_mob_id: state.mob.id, p_format: format, p_mode: mode, p_subject: state.mob.subject, p_chapter: chapter,
      p_ids: picked.slice(0, count), p_via: right.via, p_week: week, p_rematch_of: rematchOf, p_now: nowIso(), p_max_open: MAX_OPEN_GAMES,
    });
    const map = { not_member: 'NOT_IN_MOB', rematch_invalid: 'GAME_NOT_FOUND', open_limit: 'GAMES_OPEN_LIMIT', room_open: 'ROOM_OPEN_ALREADY', start_used: 'START_USED', mic_none: 'START_USED' };
    if (r?.status !== 'ok') throw new MobError(map[r?.status] || 'UNAVAILABLE');
    try {
      const { g, members } = await loadGame(userId, r.id);
      return { game: await gameView(g, members, userId) };
    } catch (error) {
      throw new MobError(error instanceof MobError ? error.code : 'UNAVAILABLE', { committed: true });
    }
  }

  async function getGame(userId, gameId) {
    const { g, members } = await loadGame(userId, gameId);
    return { game: await gameView(g, members, userId) };
  }

  const runOut = (r) => ({
    startedAt: iso(r.started_at), endsAt: iso(r.ends_at), serverNow: nowIso(), live: r.live === true,
    answers: (r.answers || []).map((a) => ({ q: a.q, pick: a.pick, correct: a.correct, elapsedMs: a.elapsed_ms })),
  });

  async function startRun(userId, gameId) {
    const { g, members } = await loadGame(userId, gameId);
    const r = await call('mob_run_start', { p_user_id: userId, p_game_id: g.id, p_now: nowIso() });
    if (r?.status === 'not_member') throw new MobError('GAME_NOT_FOUND');
    if (r?.status === 'closed') throw new MobError('GAME_CLOSED');
    if (r?.status === 'finished') throw new MobError('RUN_DONE');
    if (r?.status !== 'started' && r?.status !== 'resumed') throw new MobError('UNAVAILABLE');
    const questions = await deps.loadQuestions(g.question_ids).catch(() => []);
    if (!Array.isArray(questions) || questions.length !== g.question_ids.length) throw new MobError('UNAVAILABLE');
    const view = await gameView(g, members, userId);
    return { run: runOut(r), questions: questions.map((q, i) => publicQuestion(q, i)), ghosts: view.ghosts };
  }

  async function answer(userId, gameId, body = {}) {
    if (!Number.isInteger(body.q) || !Number.isInteger(body.pick) || body.pick < -1 || body.pick > 3) throw new MobError('Q_INVALID');
    if (!validId(gameId)) throw new MobError('GAME_NOT_FOUND');
    const g = await call('mob_game_json', { p_game_id: gameId, p_user_id: userId, p_now: nowIso() });
    if (!g) throw new MobError('GAME_NOT_FOUND');
    if (body.q < 0 || body.q >= g.question_ids.length) throw new MobError('Q_INVALID');
    let key = null;
    if (body.pick >= 0) {
      const [question] = await deps.loadQuestions([g.question_ids[body.q]]).catch(() => []);
      key = question?.correctIndex;
      if (!Number.isInteger(key) || key < 0) throw new MobError('UNAVAILABLE');
      if (body.pick >= (question.options || []).length) throw new MobError('Q_INVALID');
    }
    const memberId = memberIdFor(deps.secret, g.mob_id, userId);
    const r = await call('mob_game_answer', { p_user_id: userId, p_game_id: g.id, p_q: body.q, p_pick: body.pick, p_correct_index: key, p_member_id: memberId, p_now: nowIso() });
    if (r?.status === 'no_run') throw new MobError('NO_RUN');
    if (r?.status === 'q_invalid') throw new MobError('Q_INVALID');
    if (r?.status === 'expired') throw new MobError('RUN_EXPIRED', { detail: { run: { finished: true, marks: Number(r.marks) || 0, answered: r.answered, count: r.count } } });
    if (r?.status === 'finished') throw new MobError('RUN_DONE');
    if (r?.status !== 'ok' && r?.status !== 'exists') throw new MobError('UNAVAILABLE');
    if (r.finished) await checkUnlocks(userId).catch(() => null);
    return {
      correct: r.correct, delta: r.correct === true ? 5 : r.correct === false ? -1 : 0, marks: Number(r.marks) || 0, elapsedMs: r.elapsed_ms,
      answered: r.answered, count: r.count, finished: r.finished === true, serverNow: nowIso(),
    };
  }

  async function finish(userId, gameId) {
    if (!validId(gameId)) throw new MobError('GAME_NOT_FOUND');
    const g = await call('mob_game_json', { p_game_id: gameId, p_user_id: userId, p_now: nowIso() });
    if (!g) throw new MobError('GAME_NOT_FOUND');
    const r = await call('mob_run_finish', { p_user_id: userId, p_game_id: g.id, p_member_id: memberIdFor(deps.secret, g.mob_id, userId), p_now: nowIso() });
    if (r?.status !== 'finished') throw new MobError('NO_RUN');
    await checkUnlocks(userId).catch(() => null);
    return { run: { finished: true, marks: Number(r.marks) || 0 } };
  }

  /** The trap as the podium and review show it (after close only). */
  async function trapFor(g, userId) {
    if (!g.closed) return null;
    const t = await call('mob_trap_get', { p_game_id: g.id, p_user_id: userId });
    return t ? { ...t, number: t.q + 1 } : null;
  }

  async function podium(userId, gameId) {
    const { g, state, members } = await loadGame(userId, gameId);
    const mine = (g.runs || []).find((r) => r.user_id === userId);
    if (!g.closed && !mine?.finished_at) throw new MobError('PODIUM_NOT_YET');
    const count = g.question_ids.length;
    const showPodium = state.mob.show_podium !== false;
    const finished = finishedRuns(g).filter((r) => members.has(r.user_id));
    const detail = await call('mob_game_marks_detail', { p_game_id: g.id });
    const answersBy = new Map();
    for (const a of detail || []) answersBy.set(a.user_id, [...(answersBy.get(a.user_id) || []), { q: a.q, correct: a.correct, elapsedMs: a.elapsed_ms, pick: a.answered ? 0 : -1 }]);
    const trap = await trapFor(g, userId);
    const placed = placeRuns(finished.map((r) => ({ userId: r.user_id, marks: Number(r.marks), private: !members.get(r.user_id).showScore, finishedAt: r.finished_at, right: Number(r.right_n), wrong: Number(r.wrong_n) })));
    const ordered = [...placed].sort((a, b) => (showPodium ? (a.place ?? 99) - (b.place ?? 99) : 0) || Date.parse(a.finishedAt) - Date.parse(b.finishedAt));
    const places = ordered.map((r) => {
      const m = members.get(r.userId);
      const out = { memberId: m.memberId, name: m.name, fold: m.fold, colour: m.colour, marks: r.private && !m.you ? null : r.marks, you: m.you };
      if (r.private) out.private = true;
      if (showPodium && r.place) { out.place = r.place; if (r.place > 3) out.floor = true; }
      return out;
    });
    const nameOf = (u) => members.get(u)?.name || '';
    const moments = assignMoments(placed.map((r) => ({ ...r, memberId: members.get(r.userId).memberId, place: showPodium ? r.place : null, answers: answersBy.get(r.userId) || [] })), { count, trapQ: trap ? trap.q : null });
    return {
      soFar: !g.closed, closesAt: iso(g.closes_at), showPodium,
      headline: { kind: 'together', right: finished.reduce((s, r) => s + Number(r.right_n), 0), of: finished.length * count },
      places, tie: showPodium ? tieFor(placed, userId, nameOf) : null, moments,
      trap: trap ? { q: trap.q, number: trap.number, caught: 'most' } : null,
    };
  }

  async function review(userId, gameId) {
    const { g } = await loadGame(userId, gameId);
    if (!g.closed) throw new MobError('REVIEW_NOT_YET', { detail: { opensAt: iso(g.closes_at) } });
    const questions = await deps.loadQuestions(g.question_ids).catch(() => []);
    if (!Array.isArray(questions) || questions.length !== g.question_ids.length) throw new MobError('UNAVAILABLE');
    const picks = new Map((g.mine || []).map((a) => [a.q, a.pick]));
    const trap = await trapFor(g, userId);
    return {
      questions: questions.map((q, i) => ({
        ...publicQuestion(q, i), correctIndex: Number.isInteger(q.correctIndex) ? q.correctIndex : null, explanation: q.explanation || null,
        yourPick: Number.isInteger(picks.get(i)) && picks.get(i) >= 0 ? picks.get(i) : null,
      })),
      trap: trap ? {
        q: trap.q, number: trap.number, caught: 'most',
        fix: {
          now: trap.now?.answered ? 'done' : 'open',
          check: { opensAt: iso(trap.check_opens_at), closesAt: iso(trap.check_closes_at), state: trap.check?.answered ? 'done' : Date.parse(trap.check_opens_at) > now() ? 'not_yet' : Date.parse(trap.check_closes_at) < now() ? 'closed' : 'open' },
          fixed: { count: Number(trap.fixed_count) || 0, of: FIXED_FOR_CRANE },
        },
      } : null,
    };
  }

  // ------------------------------------------------------------------ Fix it together

  const validStage = (s) => s === 'now' || s === 'check';
  /** A fresh question like the trap one, only for you: the same chapter, never one of the game's own questions. */
  async function freshQuestionId(g, q, userId, stage) {
    const [trapQ] = await deps.loadQuestions([g.question_ids[q]]).catch(() => []);
    const chapter = trapQ?.chapter && deps.validChapter && deps.validChapter(g.subject, trapQ.chapter) ? trapQ.chapter : null;
    const key = `fix_${g.id}_${q}_${stage}_${memberIdFor(deps.secret, g.mob_id, userId)}`;
    for (const ch of chapter ? [chapter, null] : [null]) {
      // A draw longer than the game, so at least one question is not one of the game's own.
      const ids = await deps.pickQuestionIds(g.subject, { mobId: g.mob_id, week: g.week_start, count: Math.min(20, g.question_ids.length + 5), chapter: ch, key }).catch(() => []);
      const fresh = (ids || []).find((id) => !g.question_ids.includes(id));
      if (fresh) return fresh;
    }
    return null;
  }

  async function fixIssue(userId, body) {
    if (!validId(body.game)) throw new MobError('GAME_NOT_FOUND');
    if (!Number.isInteger(body.q) || !validStage(body.stage)) throw new MobError('Q_INVALID');
    const g = await call('mob_game_json', { p_game_id: body.game, p_user_id: userId, p_now: nowIso() });
    if (!g) throw new MobError('GAME_NOT_FOUND');
    if (!g.closed) throw new MobError('FIX_NOT_YET', { detail: { opensAt: iso(g.closes_at) } });
    await ensureSettled(g);
    const probe = { p_user_id: userId, p_game_id: g.id, p_q: body.q, p_stage: body.stage, p_now: nowIso() };
    let r = await call('mob_fix_issue', { ...probe, p_question_id: null });
    if (r?.status === 'no_trap') throw new MobError('Q_INVALID');
    if (r?.status === 'not_member') throw new MobError('GAME_NOT_FOUND');
    if (r?.status === 'not_yet') throw new MobError('FIX_NOT_YET', { detail: { opensAt: iso(r.opens_at) } });
    if (r?.status === 'closed') throw new MobError('FIX_CLOSED');
    if (r?.status === 'open') {
      const fresh = await freshQuestionId(g, body.q, userId, body.stage);
      if (!fresh) throw new MobError('BANK_THIN');
      r = await call('mob_fix_issue', { ...probe, p_question_id: fresh });
    }
    if (r?.status !== 'ok' && r?.status !== 'had') throw new MobError('UNAVAILABLE');
    return { g, issued: r };
  }

  async function fixStart(userId, body = {}) {
    const { g, issued } = await fixIssue(userId, body);
    const [question, trapQ] = await Promise.all([
      deps.loadQuestions([issued.question_id]).then((x) => x?.[0]).catch(() => null),
      deps.loadQuestions([g.question_ids[body.q]]).then((x) => x?.[0]).catch(() => null),
    ]);
    if (!question || !trapQ) throw new MobError('UNAVAILABLE');
    const mine = (g.mine || []).find((a) => a.q === body.q);
    const fresh = publicQuestion(question, 0);
    return {
      question: { stem: fresh.stem, options: fresh.options, passage: fresh.passage, answered: issued.answered === true },
      trap: { q: body.q, number: body.q + 1, why: trapQ.explanation || null, yourPick: mine && mine.pick >= 0 ? mine.pick : null, correctIndex: Number.isInteger(trapQ.correctIndex) ? trapQ.correctIndex : null },
    };
  }

  async function fixAnswer(userId, body = {}) {
    if (!Number.isInteger(body.pick) || body.pick < 0 || body.pick > 3) throw new MobError('Q_INVALID');
    const { g, issued } = await fixIssue(userId, body);
    const [question] = await deps.loadQuestions([issued.question_id]).catch(() => []);
    if (!question || !Number.isInteger(question.correctIndex)) throw new MobError('UNAVAILABLE');
    const correct = body.pick === question.correctIndex;
    const r = await call('mob_fix_answer', { p_user_id: userId, p_game_id: g.id, p_q: body.q, p_stage: body.stage, p_correct: correct, p_now: nowIso() });
    if (r?.status === 'closed') throw new MobError('FIX_CLOSED');
    if (r?.status !== 'ok' && r?.status !== 'exists') throw new MobError('UNAVAILABLE');
    await checkUnlocks(userId).catch(() => null);
    return {
      correct: r.correct === true, correctIndex: question.correctIndex, explanation: question.explanation || null,
      fixedTogether: r.fixed_now === true, fixed: { count: Number(r.fixed_count) || 0, of: FIXED_FOR_CRANE },
    };
  }

  // ------------------------------------------------------------------ Folds and unlocks

  /** Grants every Fold the facts earn, once (mob_fold_grant is idempotent). Returns the facts and the unlock rows. */
  async function checkUnlocks(userId, { daily = null, chainBest = null } = {}) {
    const facts = await call('mob_unlock_facts', { p_user_id: userId });
    const mobs = facts?.mobs || [];
    const best = (pick) => mobs.reduce((b, m) => (pick(m) > b.v ? { v: pick(m), mob: m } : b), { v: 0, mob: null });
    const days = daily || (await chains.read(userId).catch(() => ({ daily: [] }))).daily;
    const chainBestDays = chainBest ?? Number(facts?.chain_best) ?? 0;
    const grants = [];
    const questMob = mobs.find((m) => m.quest_done);
    if (questMob) grants.push(['hop', 'plain', 'mob_quest', questMob.mob_id]);
    const crane = best((m) => Number(m.traps_fixed) || 0);
    if (crane.v >= FOLDS.crane.need) grants.push(['crane', 'plain', 'mob_traps', crane.mob.mob_id]);
    const weeks = best((m) => Number(m.best_weeks) || 0);
    if (weeks.v >= FOLDS.stamp.need) grants.push(['stamp', 'plain', 'mob_weeks', weeks.mob.mob_id]);
    if ((Number(facts?.full_mocks) || 0) >= 1) grants.push(['naav', 'plain', 'first_full_mock', null]);
    if ((Number(facts?.clean_games) || 0) >= FOLDS.tally.need) grants.push(['tally', 'plain', 'clean_games', null]);
    if (facts?.beat_best === true) grants.push(['patang', 'plain', 'beat_best', null]);
    if ((Number(facts?.fixes_held) || 0) >= FOLDS.sticky.need) grants.push(['sticky', 'plain', 'fixes_held', null]);
    if (cameBack(days)) grants.push(['cutting', 'plain', 'came_back', null]);
    const owned = new Set((facts?.unlocks || []).map((u) => `${u.fold}:${u.finish}`));
    if (chainBestDays >= FOIL_DAYS && !(facts?.unlocks || []).some((u) => u.finish === 'foil')) grants.push([facts?.seat?.fold || 'dart', 'foil', 'chain_30', null]);
    const fresh = [];
    for (const [fold, finish, source, mobId] of grants) {
      if (owned.has(`${fold}:${finish}`)) continue;
      const r = await call('mob_fold_grant', { p_user_id: userId, p_fold: fold, p_finish: finish, p_source: source, p_mob_id: mobId });
      if (r === 'new') { fresh.push({ fold, finish, mob_id: mobId }); owned.add(`${fold}:${finish}`); }
    }
    return { facts, unlocks: [...(facts?.unlocks || []), ...fresh], daily: days };
  }

  const ownsFold = (unlocks, fold, finish = 'plain') => (finish === 'plain' && STARTERS.includes(fold)) || (unlocks || []).some((u) => u.fold === fold && u.finish === finish);

  /** The seat Fold check for create and join: a starter or an earned Fold. Throws FOLD_INVALID or FOLD_LOCKED. */
  async function checkFold(userId, fold) {
    if (fold === undefined || fold === null) return null;
    if (!isFold(fold)) throw new MobError('FOLD_INVALID');
    if (STARTERS.includes(fold)) return fold;
    const facts = await call('mob_unlock_facts', { p_user_id: userId });
    if (!ownsFold(facts?.unlocks, fold)) throw new MobError('FOLD_LOCKED');
    return fold;
  }
  const sitAs = (userId, fold) => (fold ? call('mob_profile_set', { p_user_id: userId, p_fold: fold, p_finish: 'plain' }) : null);

  async function profile(userId, body = {}) {
    const finish = body.finish === undefined ? 'plain' : body.finish;
    if (!isFold(body.fold) || !FINISHES.includes(finish)) throw new MobError('FOLD_INVALID');
    const r = await call('mob_profile_set', { p_user_id: userId, p_fold: body.fold, p_finish: finish });
    if (r === 'locked') throw new MobError('FOLD_LOCKED');
    return { fold: body.fold, finish };
  }

  async function shelf(userId) {
    const { body: chain, daily } = await chains.read(userId);
    const { facts, unlocks } = await checkUnlocks(userId, { daily, chainBest: chain.best });
    const mobs = facts?.mobs || [];
    const nameFor = (m) => mobName(m.name_key, subjectName(m.subject)).text;
    const bestMob = (pick) => mobs.reduce((b, m) => (pick(m) > b.v ? { v: pick(m), mob: m } : b), { v: 0, mob: mobs[0] || null });
    const progressFacts = {
      questsDone: mobs.some((m) => m.quest_done) ? 1 : 0, trapsFixed: bestMob((m) => Number(m.traps_fixed) || 0).v,
      mobWeeks: bestMob((m) => Number(m.best_weeks) || 0).v, fullMocks: Number(facts?.full_mocks) || 0, cleanGames: Number(facts?.clean_games) || 0,
      beatBest: facts?.beat_best ? 1 : 0, fixesHeld: Number(facts?.fixes_held) || 0, cameBack: cameBack(daily) ? 1 : 0,
    };
    const mobFor = { hop: bestMob((m) => (m.quest_done ? 1 : 0)), crane: bestMob((m) => Number(m.traps_fixed) || 0), stamp: bestMob((m) => Number(m.best_weeks) || 0) };
    const seat = facts?.seat ? { fold: facts.seat.fold, finish: facts.seat.finish } : null;
    return {
      seat,
      folds: FOLD_KEYS.map((key) => {
        const f = FOLDS[key];
        const owned = ownsFold(unlocks, key);
        const foil = ownsFold(unlocks, key, 'foil')
          ? { owned: true }
          : { owned: false, rule: 'chain_30', have: Math.min(FOIL_DAYS, chain.best), need: FOIL_DAYS };
        if (f.scope === 'starter') return { key, owned: true, starter: true, folds: f.folds, finishes: { foil } };
        const p = ruleProgress(key, progressFacts);
        const out = { key, owned, folds: f.folds, rule: f.source, have: owned ? p.need : p.have, need: p.need, finishes: { foil } };
        if (f.scope === 'mob' && mobFor[key]?.mob) out.mob = nameFor(mobFor[key].mob);
        return out;
      }),
      mobItems: mobs.map((m) => {
        const s = mobShelf(Number(m.best_weeks) || 0);
        return {
          mobId: m.mob_id, name: nameFor(m),
          items: [...s.items.map((item) => ({ item, owned: true })), ...(s.nextItem ? [{ item: s.nextItem.item, owned: false, have: Number(m.best_weeks) || 0, need: s.nextItem.at }] : [])],
        };
      }),
    };
  }

  // ------------------------------------------------------------------ the v3 block of GET /api/mob

  async function mobChainFor(mobId, storedBest) {
    const weeks = await call('mob_weeks_list', { p_mob_id: mobId });
    const c = computeMobChain({ weeks: weeks || [], currentWeek: mobWeek(now()), storedBest });
    if (c.best > (Number(storedBest) || 0)) await call('mob_chain_best_bump', { p_mob_id: mobId, p_weeks: c.best });
    return { chain: c, weeks: weeks || [] };
  }

  /**
   * state: mob_state for the Mob in view; pro: the student's plan. Returns the `v3` object (3.1). Every number is the
   * server's. Old keys of the view are untouched.
   */
  async function v3Block(userId, state, { pro = false } = {}) {
    const members = memberMap(state, userId);
    const me = members.get(userId);
    const week = mobWeek(now());
    // Close what has closed (the trap and the sticker cleanup), once.
    for (const g of state.games || []) await ensureSettled(g).catch(() => null);
    const q = await call('mob_quest_week', { p_mob_id: state.mob.id, p_week: week, p_now: nowIso() });
    const factsBefore = await call('mob_unlock_facts', { p_user_id: userId });
    const thisMob = (factsBefore?.mobs || []).find((m) => m.mob_id === state.mob.id);
    const { chain: mobChain } = await mobChainFor(state.mob.id, Number(thisMob?.best_weeks) || 0);
    const { body: chain, daily } = await chains.read(userId);
    const { facts, unlocks } = await checkUnlocks(userId, { daily, chainBest: chain.best });
    const startStatus = await call('mob_start_status', { p_user_id: userId, p_mob_id: state.mob.id, p_week: week });
    const games = new Map((state.games || []).map((g) => [String(g.id), { hostName: members.get(g.created_by)?.name, format: g.format, hostIsYou: g.created_by === userId }]));
    const extras = new Map((state.extras || []).map((x) => [String(x.id), x.chapter]));
    // The parcel shows what finishing THIS week brings: Hop until a quest before this week was done.
    const hopBeforeThisWeek = (Number(thisMob?.quests_done) || 0) - (q?.done_at ? 1 : 0) > 0;
    const weeksIfStitched = mobChain.stitchedThisWeek ? mobChain.weeks : mobChain.weeks + 1;
    const parcel = parcelFor({ mobOwnsHop: hopBeforeThisWeek, weeksIfStitched });
    const seen = new Set(facts?.seen || []);
    const moments = [];
    if (q?.done_at && !seen.has(`quest_done:${state.mob.id}:${week}`)) moments.push(`quest_done:${state.mob.id}:${week}`);
    if (mobChain.stitchedThisWeek && !seen.has(`stitch:${state.mob.id}:${week}`)) moments.push(`stitch:${state.mob.id}:${week}`);
    for (const u of unlocks) if (u.finish === 'plain' && !seen.has(`reveal:${u.fold}`)) moments.push(`reveal:${u.fold}`);
    for (const d of chain.due) moments.push(d);
    const micFrom = startStatus?.mic_from ? members.get(startStatus.mic_from) : null;
    const starts = startsView({ billingOn: billingOn(), pro, claimUsed: startStatus?.claim_used === true, micsHeld: Number(startStatus?.mics) || 0, micsGiven: Number(startStatus?.mics_given) || 0, liveOn: liveOn() });
    if (starts.mics > 0 && micFrom) starts.micFrom = { memberId: micFrom.memberId, name: micFrom.name };
    return {
      name: mobName(state.mob.name_key, subjectName(state.mob.subject)),
      showPodium: state.mob.show_podium !== false,
      youOwn: me?.owner === true,
      members: [...members.values()].map((m) => ({ memberId: m.memberId, name: m.name, colour: m.colour, fold: m.fold, finish: m.finish, you: m.you, owner: m.owner })),
      games: (state.games || []).map((g) => denGame(g, members, userId)),
      quest: questView(q, { week, youSteppedOut: state.you_stepped_out === true, labels: questLabels(q?.by_source, { games, extras }), parcel }),
      mobChain: { weeks: mobChain.weeks, best: mobChain.best, passes: mobChain.passes, stitchedThisWeek: mobChain.stitchedThisWeek, restarted: mobChain.restarted, next: mobChain.next },
      shelf: mobShelf(mobChain.best),
      starts,
      chainChip: chainChip(chain),
      reactions: (state.reactions || []).filter((r) => members.has(r.from_user)).map((r) => ({ memberId: members.get(r.from_user).memberId, kind: r.kind, at: iso(r.created_at), ...(r.game_id ? { game: r.game_id } : {}) })),
      moments,
      live: { enabled: liveOn(), hoursOk: inLiveHours(now()) },
    };
  }

  // ------------------------------------------------------------------ small writes

  const view = (userId, mobId) => (helpers.view ? helpers.view(userId, { mobId, sync: false }) : { ok: true });

  return {
    v3Block, checkUnlocks, checkFold, sitAs, chains,
    openGame, getGame, startRun, answer, finish, podium, review, fixStart, fixAnswer, profile, shelf,

    async settings(userId, body = {}) {
      if (body.nameKey !== undefined && body.nameKey !== null && !validNameKey(body.nameKey)) throw new MobError('NAME_KEY_INVALID');
      if (body.showPodium !== undefined && typeof body.showPodium !== 'boolean') throw new MobError('BODY_INVALID');
      if (body.showPodium === undefined && (body.nameKey === undefined || body.nameKey === null)) throw new MobError('BODY_INVALID');
      const state = await mustState(userId, body.mob);
      const r = await call('mob_settings_set', { p_user_id: userId, p_mob_id: state.mob.id, p_show_podium: body.showPodium ?? null, p_name_key: body.nameKey ?? null });
      if (r === 'not_owner') throw new MobError('NOT_OWNER_SETTINGS');
      if (r !== 'ok') throw new MobError('NOT_IN_MOB');
      return view(userId, state.mob.id);
    },

    async sticker(userId, body = {}) {
      if (!STICKERS.includes(body.kind)) throw new MobError('STICKER_INVALID');
      const state = await mustState(userId, body.mob);
      let gameId = null;
      if (body.game !== undefined && body.game !== null) {
        const g = validId(body.game) ? await call('mob_game_json', { p_game_id: body.game, p_user_id: userId, p_now: nowIso() }) : null;
        if (!g || g.mob_id !== state.mob.id) throw new MobError('GAME_NOT_FOUND');
        gameId = g.id;
      }
      const r = await call('mob_sticker', { p_user_id: userId, p_mob_id: state.mob.id, p_game_id: gameId, p_kind: body.kind, p_member_id: memberIdFor(deps.secret, state.mob.id, userId) });
      if (r !== 'ok') throw new MobError('NOT_IN_MOB');
      return { ok: true };
    },

    async mic(userId, body = {}) {
      if (!billingOn()) throw new MobError('BILLING_OFF');
      const state = await mustState(userId, body.mob);
      if (!(await isPro(userId))) throw new MobError('START_PRO');
      const members = memberMap(state, userId);
      const target = [...members.entries()].find(([, m]) => m.memberId === body.to);
      if (!target) throw new MobError('NOT_FOUND');
      if (target[0] === userId) throw new MobError('MIC_SELF');
      const week = mobWeek(now());
      const r = await call('mob_mic_give', { p_giver: userId, p_mob_id: state.mob.id, p_receiver: target[0], p_week: week, p_max: MICS_PER_WEEK });
      if (r === 'self') throw new MobError('MIC_SELF');
      if (r === 'limit') throw new MobError('MIC_LIMIT');
      if (r !== 'ok') throw new MobError('NOT_FOUND');
      const s = await call('mob_start_status', { p_user_id: userId, p_mob_id: state.mob.id, p_week: week });
      return { micsToGive: Math.max(0, MICS_PER_WEEK - (Number(s?.mics_given) || 0)) };
    },

    async stepOut(userId, body = {}) {
      if (typeof body.on !== 'boolean') throw new MobError('BODY_INVALID');
      const state = await mustState(userId, body.mob);
      const week = mobWeek(now());
      await call('mob_quest_week', { p_mob_id: state.mob.id, p_week: week, p_now: nowIso() });
      const r = await call('mob_step_out', { p_user_id: userId, p_mob_id: state.mob.id, p_week: week, p_on: body.on });
      if (r === 'done') throw new MobError('STEP_OUT_DONE');
      if (r !== 'ok') throw new MobError('NOT_IN_MOB');
      await call('mob_quest_week', { p_mob_id: state.mob.id, p_week: week, p_now: nowIso() });
      return view(userId, state.mob.id);
    },

    async seen(userId, body = {}) {
      const keys = Array.isArray(body.keys) ? body.keys : null;
      if (!keys || !keys.length || keys.length > 20 || keys.some((k) => typeof k !== 'string' || !k || k.length > 80)) throw new MobError('BODY_INVALID');
      await call('mob_seen_mark', { p_user_id: userId, p_keys: keys });
      return { ok: true };
    },
  };
}
