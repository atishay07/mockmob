// One handler for every /api/mob route (SOCIAL-SPEC section 6). No '@/' imports, so node:test drives it with a fake
// session and limiter (data/tests/mob.test.mjs). The route files pass the production deps (src/lib/server/mob/deps.js).
//   - MOB_ENABLED not 'true': every route answers 404 MOB_DISABLED, the public lookup included.
//   - Signed out: 401, except the public code lookup.
//   - Errors: { error: { code, message } }. Successes: JSON, Cache-Control: no-store.
//   - Rate limits (P11), persistent through checkPersistentRateLimit; a 429 carries Retry-After and says the real wait in
//     plain words. Starting a Mob and making an extra paper count only when they succeed: a request that fails (a typo
//     in the name, a thin chapter, any error) gives its count back, so mistakes never lock a student out.
import { MobError, errorBody, errorStatus, waitPhrase } from '../../mob/model.mjs';

const MIN = 60_000;
const HOUR = 60 * MIN;
const DAY = 24 * HOUR;
const WEEK = 7 * DAY;
export const LIMITS = Object.freeze({
  read: { limit: 120, windowMs: 10 * MIN, by: 'user' },
  write: { limit: 60, windowMs: HOUR, by: 'user' },
  invite: { limit: 5, windowMs: DAY, by: 'user' },
  lookup: { limit: 30, windowMs: 10 * MIN, by: 'ip' },
  join: { limit: 10, windowMs: HOUR, by: 'user' },
  report: { limit: 10, windowMs: DAY, by: 'user' },
  // Starting Mobs is rare. A cap here is what stops leave-and-start-again from being a way to a fresh weekly paper.
  // Both count successful actions only (success: true).
  create: { limit: 3, windowMs: WEEK, by: 'user', success: true },
  extra: { limit: 6, windowMs: DAY, by: 'user', success: true },
});

/** The 429 sentence for each limit, with the real wait ("in 25 minutes", "on Fri 23 Oct, 9:40 PM"). */
export function limitMessage(name, wait) {
  const l = LIMITS[name];
  switch (name) {
    case 'create': return `You started ${l.limit} Mobs in the last 7 days, the most a week allows. You can start another ${wait}.`;
    case 'extra': return `You made ${l.limit} extra papers today, the most a day allows. You can make another ${wait}.`;
    case 'invite': return `You made ${l.limit} invite links today, the most a day allows. Your latest link still works. You can make a new one ${wait}.`;
    case 'join': return `That was a lot of tries to join in an hour. You can try again ${wait}.`;
    case 'report': return `You sent ${l.limit} reports today, the most a day allows. You can send another ${wait}. To stop sharing a Mob with someone now, use Leave and block.`;
    case 'lookup': return `This invite was checked too many times from your network. Try again ${wait}.`;
    default: return `Too many tries in a short time. Try again ${wait}.`;
  }
}

// action -> [method, limits, service call, success status]
export const ACTIONS = Object.freeze({
  get: ['GET', ['read'], (s, u, _b, p) => s.view(u, { mobId: p.query?.mob })],
  create: ['POST', ['create', 'write'], (s, u, b) => s.create(u, b), 201],
  invite: ['POST', ['invite', 'write'], (s, u, b) => s.invite(u, b)],
  lookup: ['GET', ['lookup'], (s, u, _b, p) => s.lookup(p.code, { viewerId: u }), 200, { public: true }],
  join: ['POST', ['join', 'write'], (s, u, b) => s.join(u, b)],
  patchMe: ['PATCH', ['write'], (s, u, b) => s.patchMe(u, b)],
  leave: ['POST', ['write'], (s, u, b) => s.leave(u, b)],
  remove: ['POST', ['write'], (s, u, b) => s.remove(u, b)],
  report: ['POST', ['report', 'write'], (s, u, b) => s.report(u, b)],
  nudge: ['POST', ['write'], (s, u, b) => s.nudge(u, b)],
  nudgeSeen: ['POST', ['write'], (s, u, b) => s.nudgeSeen(u, b)],
  paperStart: ['POST', ['write'], (s, u, b) => s.startPaper(u, b)],
  // Free and Pro (SOCIAL-SPEC section 15): the service checks the plan on every one of these.
  compare: ['GET', ['read'], (s, u, _b, p) => s.compare(u, p.query || {})],
  history: ['GET', ['read'], (s, u, _b, p) => s.history(u, p.query || {})],
  extra: ['POST', ['extra', 'write'], (s, u, b) => s.createExtra(u, b), 201],
  chapters: ['GET', ['read'], (s, u, _b, p) => s.chapters(u, p.query || {})],
});

const MAX_BODY = 4096;

/**
 * deps: { enabled() -> boolean, auth(request) -> session | null, rateLimit(request, opts) -> { allowed, retryAfterSeconds? },
 *         giveBack(request, opts)  (optional) returns the count a success-only limit took,
 *         waitFor(request, opts) -> seconds | null  (optional) the real wait on a refused limit,
 *         now() -> ms (optional), service, cors(request) -> headers }
 */
export async function handleMob(deps, action, request, params = {}) {
  const spec = ACTIONS[action];
  const query = (() => { try { return Object.fromEntries(new URL(request.url).searchParams); } catch { return {}; } })();
  params = { ...params, query };
  const headers = { ...(deps.cors ? deps.cors(request) : {}), 'Cache-Control': 'no-store' };
  const fail = (code, extra = {}, more = {}) => Response.json(errorBody(code, more), { status: errorStatus(code), headers: { ...headers, ...extra } });
  if (!spec) return fail('UNAVAILABLE');
  const [, limits, run, okStatus = 200, flags = {}] = spec;
  if (!deps.enabled()) return fail('MOB_DISABLED');
  // A public route still reads the session when there is one (the join page greets a signed-in student by who invited them).
  const session = await deps.auth(request).catch(() => null);
  const userId = session?.user?.id || null;
  if (!flags.public && !userId) return fail('UNAUTHENTICATED');
  const optsFor = (name) => {
    const l = LIMITS[name];
    return { route: `/api/mob:${name}`, limit: l.limit, windowMs: l.windowMs, keyParts: l.by === 'user' ? [userId] : [], identityOnly: l.by === 'user' };
  };
  const taken = [];
  const giveBack = async () => {
    for (const name of taken) if (LIMITS[name].success && deps.giveBack) await Promise.resolve(deps.giveBack(request, optsFor(name))).catch(() => null);
  };
  for (const name of limits) {
    const l = LIMITS[name];
    const result = await deps.rateLimit(request, optsFor(name)).catch(() => ({ allowed: false }));
    if (!result?.allowed) {
      await giveBack(); // an earlier limit of this request counted it; the request does not happen
      const read = deps.waitFor ? await Promise.resolve(deps.waitFor(request, optsFor(name))).catch(() => null) : null;
      const seconds = Number.isFinite(read) && read > 0 ? read : Number(result?.retryAfterSeconds) || Math.ceil(l.windowMs / 1000);
      const now = deps.now ? deps.now() : Date.now();
      return fail('RATE_LIMITED', { 'Retry-After': String(Math.ceil(seconds)) }, { message: limitMessage(name, waitPhrase(seconds, now)) });
    }
    taken.push(name);
  }
  let body = {};
  if (request.method !== 'GET') {
    const text = await request.text().catch(() => '');
    if (text.length > MAX_BODY) { await giveBack(); return fail('BODY_INVALID'); }
    if (text.trim()) {
      try { body = JSON.parse(text); } catch { await giveBack(); return fail('BODY_INVALID'); }
      if (!body || typeof body !== 'object' || Array.isArray(body)) { await giveBack(); return fail('BODY_INVALID'); }
    }
  }
  try {
    const out = await run(deps.service, userId, body, params);
    return Response.json(out, { status: okStatus, headers });
  } catch (error) {
    await giveBack();
    if (error instanceof MobError) return fail(error.code, {}, { message: error.extra?.message, detail: error.extra?.detail });
    console.error('[mob]', action, error?.message || error);
    return fail('UNAVAILABLE');
  }
}
