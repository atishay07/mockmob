// One handler for every /api/mob route (SOCIAL-SPEC section 6). No '@/' imports, so node:test drives it with a fake
// session and limiter (data/tests/mob.test.mjs). The route files pass the production deps (src/lib/server/mob/deps.js).
//   - MOB_ENABLED not 'true': every route answers 404 MOB_DISABLED, the public lookup included.
//   - Signed out: 401, except the public code lookup.
//   - Errors: { error: { code, message } }. Successes: JSON, Cache-Control: no-store.
//   - Rate limits (P11), persistent through checkPersistentRateLimit; a 429 carries Retry-After.
import { MobError, errorBody, errorStatus } from '../../mob/model.mjs';

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
  create: { limit: 3, windowMs: WEEK, by: 'user' },
  extra: { limit: 6, windowMs: DAY, by: 'user' },
});

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
});

const MAX_BODY = 4096;

/**
 * deps: { enabled() -> boolean, auth(request) -> session | null, rateLimit(request, opts) -> { allowed, retryAfterSeconds? },
 *         service, cors(request) -> headers }
 */
export async function handleMob(deps, action, request, params = {}) {
  const spec = ACTIONS[action];
  const query = (() => { try { return Object.fromEntries(new URL(request.url).searchParams); } catch { return {}; } })();
  params = { ...params, query };
  const headers = { ...(deps.cors ? deps.cors(request) : {}), 'Cache-Control': 'no-store' };
  const fail = (code, extra = {}) => Response.json(errorBody(code), { status: errorStatus(code), headers: { ...headers, ...extra } });
  if (!spec) return fail('UNAVAILABLE');
  const [, limits, run, okStatus = 200, flags = {}] = spec;
  if (!deps.enabled()) return fail('MOB_DISABLED');
  // A public route still reads the session when there is one (the join page greets a signed-in student by who invited them).
  const session = await deps.auth(request).catch(() => null);
  const userId = session?.user?.id || null;
  if (!flags.public && !userId) return fail('UNAUTHENTICATED');
  for (const name of limits) {
    const l = LIMITS[name];
    const result = await deps.rateLimit(request, {
      route: `/api/mob:${name}`, limit: l.limit, windowMs: l.windowMs,
      keyParts: l.by === 'user' ? [userId] : [], identityOnly: l.by === 'user',
    }).catch(() => ({ allowed: false }));
    if (!result?.allowed) return fail('RATE_LIMITED', { 'Retry-After': String(result?.retryAfterSeconds || Math.ceil(l.windowMs / 1000)) });
  }
  let body = {};
  if (request.method !== 'GET') {
    const text = await request.text().catch(() => '');
    if (text.length > MAX_BODY) return fail('BODY_INVALID');
    if (text.trim()) {
      try { body = JSON.parse(text); } catch { return fail('BODY_INVALID'); }
      if (!body || typeof body !== 'object' || Array.isArray(body)) return fail('BODY_INVALID');
    }
  }
  try {
    const out = await run(deps.service, userId, body, params);
    return Response.json(out, { status: okStatus, headers });
  } catch (error) {
    if (error instanceof MobError) return fail(error.code);
    console.error('[mob]', action, error?.message || error);
    return fail('UNAVAILABLE');
  }
}
