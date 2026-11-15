// One handler for every /api/sunday route. No alias imports, so node:test drives it with a fake session and limiter
// (data/tests/sunday_mock.test.mjs); the route files pass the production deps (./deps.js).
//   - SUNDAY_MOCK_ENABLED=false: every route answers 404 SUNDAY_OFF (the kill switch; anything else leaves it on).
//   - Signed out: 401. Errors: { error: CODE, message?, detail? } (the shape the runner's start already reads).
//   - Successes: JSON with Cache-Control: no-store.
import { SundayError } from './service.js';

const LIMITS = Object.freeze({
  read: { limit: 120, windowMs: 10 * 60_000 },
  start: { limit: 30, windowMs: 60 * 60_000 },
});

const ACTIONS = {
  status: { method: 'GET', limit: 'read', call: (service, userId) => service.status(userId) },
  start: { method: 'POST', limit: 'start', body: true, call: (service, userId, body) => service.start(userId, body) },
  stats: { method: 'GET', limit: 'read', query: true, call: (service, userId, q) => service.stats(userId, q) },
  mob: { method: 'GET', limit: 'read', query: true, call: (service, userId, q) => service.mob(userId, q) },
};

export async function handleSunday(deps, action, request) {
  const spec = ACTIONS[action];
  const headers = { ...(deps.cors ? deps.cors(request) : {}), 'Cache-Control': 'no-store' };
  const fail = (status, error, extra = {}) => Response.json({ error, ...extra }, { status, headers });
  if (!spec) return fail(404, 'NOT_FOUND');
  if (!deps.enabled()) return fail(404, 'SUNDAY_OFF');
  try {
    const session = await deps.auth(request);
    const userId = session?.user?.id;
    if (!userId) return fail(401, 'Unauthorized');
    const l = LIMITS[spec.limit];
    const limited = await deps.rateLimit(request, { route: `/api/sunday/${action}`, limit: l.limit, windowMs: l.windowMs, keyParts: [userId] });
    if (!limited?.allowed) return fail(429, 'Too many requests', { message: 'Too many tries in a short time. Wait a minute, then try again.' });
    let input;
    if (spec.body) {
      const text = await request.text();
      if (text.length > 4000) return fail(413, 'Payload too large');
      try { input = text ? JSON.parse(text) : {}; } catch { return fail(400, 'BODY_INVALID'); }
    } else if (spec.query) {
      input = Object.fromEntries(new URL(request.url).searchParams);
    }
    const out = await spec.call(deps.service, userId, input);
    return Response.json(out, { headers });
  } catch (error) {
    if (error instanceof SundayError) {
      if (error.status >= 500 && error.cause) console.warn(`[sunday] ${action} ${error.code}:`, error.cause?.message || error.cause);
      return fail(error.status, error.code, { ...(error.publicMessage ? { message: error.publicMessage } : {}), ...(error.detail ? { detail: error.detail } : {}) });
    }
    console.warn(`[sunday] ${action} failed:`, error?.message || error);
    return fail(503, 'UNAVAILABLE');
  }
}
