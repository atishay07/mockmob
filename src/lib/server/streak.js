// The daily streak for every signed-in student (17 Nov 2026, LK296 S1): GET /api/me/streak and POST/DELETE /api/me/streak/pause.
// It is the personal daily chain (src/lib/chain/chain.mjs; the same body as GET /api/me/chain) without the Mob's switches: a
// student who is in no Mob, or who signed up while the Mob is off, has a streak too. The server is the single source of truth;
// the web and the app only format what it returns. Contract (the app ports it):
//   GET    -> 200 the chain body: { hidden, days, best, today: { answered, needed, done }, passes: { held, max, next, full },
//             week: [7 x { day, state }], calendar, milestones, next, makeUp: { day, needed, answeredToday } | null,
//             pause: { days, usedThisSeason, max }, notices, due, run: { from, answered }, streakMilestones, milestone,
//             rule: { answers, makeUp, makeUpEvery, passFirstAt, passEvery, passPerFixes } }   (week states: practised, rested, made_up, paused, open, today, missed, none)
//   POST   { days: ['YYYY-MM-DD'] } -> 200 the body with those exam pause days set (after today, 14 a season)
//   DELETE { days: ['YYYY-MM-DD'] } -> 200 the body with those future pause days cleared
//   Errors: { error: { code, message } } with 401 UNAUTHENTICATED, 400/422 BODY_INVALID, 422 PAUSE_PAST, 409 PAUSE_LIMIT,
//   429 RATE_LIMITED (Retry-After), 503 UNAVAILABLE. Cache-Control: no-store on every answer.
// auth(request) reads the web session or the app's Bearer token, like every other /api/me route.
// No '@/' imports, so node:test drives it with a fake session and service (data/tests/streak_1117.test.mjs).
import { MobError } from '../mob/model.mjs';
import { DAY_GOAL, MAKE_UP_EVERY, MAKE_UP_GOAL, PASS_EVERY, PASS_FIRST_AT, PASS_PER_FIXES, PAUSE_MAX } from '../chain/chain.mjs';

const MIN = 60_000;
export const STREAK_LIMITS = Object.freeze({
  read: { limit: 120, windowMs: 10 * MIN },
  write: { limit: 20, windowMs: 24 * 60 * MIN },
});

const MESSAGES = Object.freeze({
  UNAUTHENTICATED: [401, 'Sign in to see your streak.'],
  BODY_INVALID: [400, 'Something in the request was not right. Try again.'],
  PAUSE_PAST: [422, 'Pause days have to be after today.'],
  PAUSE_LIMIT: [409, `You have used the ${PAUSE_MAX} pause days this season allows.`],
  RATE_LIMITED: [429, 'You changed your pause days a lot today. Try again tomorrow.'],
  READ_LIMITED: [429, 'Your streak was asked for many times just now. Try again in a few minutes.'],
  UNAVAILABLE: [503, 'Your streak did not load. Try again shortly.'],
});

// action -> [method, limit name, service call]
export const STREAK_ACTIONS = Object.freeze({
  get: ['GET', 'read', (s, u) => s.get(u)],
  pauseSet: ['POST', 'write', (s, u, b) => s.pauseSet(u, b)],
  pauseClear: ['DELETE', 'write', (s, u, b) => s.pauseClear(u, b)],
});

/** The body every client reads: the chain body plus the one rule for a day (its number, from the chain's own constant). */
export const streakBody = (chain) => ({
  ...chain,
  rule: { answers: DAY_GOAL, makeUp: MAKE_UP_GOAL, makeUpEvery: MAKE_UP_EVERY, passFirstAt: PASS_FIRST_AT, passEvery: PASS_EVERY, passPerFixes: PASS_PER_FIXES },
});

/**
 * deps: { auth(request) -> session | null, service: { get, pauseSet, pauseClear } (createChainService), rateLimit?(request, opts)
 *         -> { allowed, retryAfterSeconds? }, cors?(request) -> headers }.
 */
export async function handleStreak(deps, action, request) {
  const headers = { ...(deps.cors ? deps.cors(request) : {}), 'Cache-Control': 'no-store' };
  // READ_LIMITED answers with the code RATE_LIMITED (the contract's code) and its own words: a read is not a pause change.
  const fail = (code, extra = {}) => {
    const [status, message] = MESSAGES[code] || MESSAGES.UNAVAILABLE;
    const sent = code === 'READ_LIMITED' ? 'RATE_LIMITED' : MESSAGES[code] ? code : 'UNAVAILABLE';
    return Response.json({ error: { code: sent, message } }, { status, headers: { ...headers, ...extra } });
  };
  const spec = STREAK_ACTIONS[action];
  if (!spec || request.method !== spec[0]) return fail('BODY_INVALID');
  const session = await Promise.resolve().then(() => deps.auth(request)).catch(() => null);
  const userId = session?.user?.id || null;
  if (!userId) return fail('UNAUTHENTICATED');
  const [, limitName, run] = spec;
  if (deps.rateLimit) {
    const l = STREAK_LIMITS[limitName];
    const r = await Promise.resolve().then(() => deps.rateLimit(request, { route: `/api/me/streak:${limitName}`, limit: l.limit, windowMs: l.windowMs, keyParts: [userId], identityOnly: true, fallback: 'memory' }))
      .catch(() => ({ allowed: true }));
    if (!r?.allowed) return fail(limitName === 'read' ? 'READ_LIMITED' : 'RATE_LIMITED', { 'Retry-After': String(Math.ceil(Number(r?.retryAfterSeconds) || l.windowMs / 1000)) });
  }
  let body = {};
  if (request.method !== 'GET') {
    const text = await request.text().catch(() => '');
    if (text.length > 4096) return fail('BODY_INVALID');
    if (text.trim()) {
      try { body = JSON.parse(text); } catch { return fail('BODY_INVALID'); }
      if (!body || typeof body !== 'object' || Array.isArray(body)) return fail('BODY_INVALID');
    }
  }
  try {
    return Response.json(streakBody(await run(deps.service, userId, body)), { status: 200, headers });
  } catch (error) {
    if (error instanceof MobError && MESSAGES[error.code]) return fail(error.code);
    return fail('UNAVAILABLE');
  }
}
