// One handler for every /api/class route. No '@/' imports, so node:test drives it with a fake session and limiter
// (data/tests/class_league_routes.test.mjs); the route files pass the production deps (./deps.js).
//   - CLASS_LEAGUES_ENABLED not 'true': every route answers 404 CLASS_OFF before it reads a session or a table.
//   - Signed out: 401, except the public lookup (the join page).
//   - Errors: { error: { code, message } } (the Mob's shape). Successes: JSON, Cache-Control: no-store.
//   - Writes are POST and sit under /api/, so the same-origin rule of src/proxy.js (A4) covers every one of them.
//   - Limits (the Mob's, src/lib/server/mob/http.js): starting a class counts only when it happens (3 in 7 days). Guessing codes
//     is held back three ways: every join try counts per network (persistent, across servers), a code that matches no class
//     counts per student (10 an hour; a join that works or fails for another reason gives its count back), and every public
//     lookup counts per network and per signed-in student. With about a billion codes, that is no way to find a class.
import { ClassError, classErrorBody, classErrorStatus, classLimitMessage, waitPhrase } from './model.mjs';

const MIN = 60_000;
const HOUR = 60 * MIN;
const DAY = 24 * HOUR;
export const CLASS_LIMITS = Object.freeze({
  read: { limit: 120, windowMs: 10 * MIN, by: 'user' },
  write: { limit: 60, windowMs: HOUR, by: 'user' },
  // Kept in the database (persistent), so they hold across every server instance (review, 16 Nov 2026).
  create: { limit: 3, windowMs: 7 * DAY, by: 'user', success: true, persistent: true },
  // A class joining at once from one school connection stays far under 120 an hour.
  joinNet: { limit: 120, windowMs: HOUR, by: 'ip', persistent: true },
  // Counted only for a code that matched no class (`miss`): a mistyped code or two is fine, a run of guesses is not.
  joinMiss: { limit: 10, windowMs: HOUR, by: 'user', miss: true, persistent: true },
  lookup: { limit: 120, windowMs: 10 * MIN, by: 'ip', persistent: true },
  lookupUser: { limit: 60, windowMs: HOUR, by: 'user', persistent: true },
  report: { limit: 5, windowMs: DAY, by: 'user', persistent: true },
});

const MISS = new Set(['CODE_INVALID', 'CLASS_NOT_FOUND']);

// action -> [method, limits, service call, success status, flags]
export const CLASS_ACTIONS = Object.freeze({
  get: ['GET', ['read'], (s, u) => s.status(u)],
  create: ['POST', ['write', 'create'], (s, u, b) => s.create(u, b), 201],
  lookup: ['GET', ['lookup', 'lookupUser'], (s, u, _b, q) => s.lookup(q.code, { viewerId: u }), 200, { public: true }],
  join: ['POST', ['write', 'joinNet', 'joinMiss'], (s, u, b) => s.join(u, b)],
  leave: ['POST', ['write'], (s, u) => s.leave(u)],
  close: ['POST', ['write'], (s, u) => s.close(u)],
  report: ['POST', ['report', 'write'], (s, u, b) => s.report(u, b)],
  week: ['GET', ['read'], (s, u, _b, q) => s.week(u, q)],
});

const MAX_BODY = 2048;

/**
 * deps: { enabled() -> boolean, auth(request) -> session | null, rateLimit(request, opts) -> { allowed, retryAfterSeconds? },
 *         giveBack(request, opts) (optional), waitFor(request, opts) -> seconds | null (optional), now() (optional),
 *         service, cors(request) -> headers }
 */
export async function handleClass(deps, action, request) {
  const spec = CLASS_ACTIONS[action];
  const headers = { ...(deps.cors ? deps.cors(request) : {}), 'Cache-Control': 'no-store' };
  const fail = (code, extra = {}, more = {}) => Response.json(classErrorBody(code, more), { status: classErrorStatus(code), headers: { ...headers, ...extra } });
  if (!spec) return fail('UNAVAILABLE');
  if (!deps.enabled()) return fail('CLASS_OFF');
  const [method, limits, run, okStatus = 200, flags = {}] = spec;
  if (request.method !== method) return fail('BODY_INVALID');
  const session = await Promise.resolve(deps.auth(request)).catch(() => null);
  const userId = session?.user?.id || null;
  if (!flags.public && !userId) return fail('UNAUTHENTICATED');
  const query = (() => { try { return Object.fromEntries(new URL(request.url).searchParams); } catch { return {}; } })();

  const optsFor = (name) => {
    const l = CLASS_LIMITS[name];
    return {
      route: `/api/class:${name}`, limit: l.limit, windowMs: l.windowMs, keyParts: l.by === 'user' ? [userId] : [], identityOnly: l.by === 'user',
      ...(l.persistent ? { persistent: true, fallback: 'memory' } : {}),
    };
  };
  const taken = [];
  // success: a limit counted only when the action happens; miss: counted only when the code matched no class.
  const giveBack = async (outcome) => {
    for (const name of taken) {
      const l = CLASS_LIMITS[name];
      const back = (l.success && outcome !== 'done') || (l.miss && outcome !== 'miss');
      if (back && deps.giveBack) await Promise.resolve(deps.giveBack(request, optsFor(name))).catch(() => null);
    }
  };
  for (const name of limits) {
    const l = CLASS_LIMITS[name];
    if (l.by === 'user' && !userId) continue;
    const result = await Promise.resolve(deps.rateLimit(request, optsFor(name))).catch(() => ({ allowed: false }));
    if (!result?.allowed) {
      await giveBack('limited');
      const read = deps.waitFor ? await Promise.resolve(deps.waitFor(request, optsFor(name))).catch(() => null) : null;
      const seconds = Number.isFinite(read) && read > 0 ? read : Number(result?.retryAfterSeconds) || Math.ceil(l.windowMs / 1000);
      const at = deps.now ? deps.now() : Date.now();
      return fail('RATE_LIMITED', { 'Retry-After': String(Math.ceil(seconds)) }, { message: classLimitMessage(name, waitPhrase(seconds, at)) });
    }
    taken.push(name);
  }

  let body = {};
  if (method !== 'GET') {
    const text = await request.text().catch(() => '');
    if (text.length > MAX_BODY) { await giveBack('bad'); return fail('BODY_INVALID'); }
    if (text.trim()) {
      try { body = JSON.parse(text); } catch { await giveBack('bad'); return fail('BODY_INVALID'); }
      if (!body || typeof body !== 'object' || Array.isArray(body)) { await giveBack('bad'); return fail('BODY_INVALID'); }
    }
  }
  try {
    const out = await run(deps.service, userId, body, query);
    await giveBack('done');
    return Response.json(out, { status: okStatus, headers });
  } catch (error) {
    if (error instanceof ClassError) {
      // The write happened and only the read after it failed: the create stays counted.
      await giveBack(error.extra?.committed === true ? 'done' : MISS.has(error.code) ? 'miss' : 'failed');
      if (error.status >= 500 && error.extra?.cause) console.warn(`[class] ${action} ${error.code}:`, error.extra.cause?.message || error.extra.cause);
      return fail(error.code, {}, { message: error.extra?.message, detail: error.extra?.detail });
    }
    await giveBack('failed');
    console.warn(`[class] ${action} failed:`, error?.message || error);
    return fail('UNAVAILABLE');
  }
}
