// Mob v3 game routes (MOB-BUILD-SPEC-V3 3.2, with the server report's real shapes). Signed in by the web cookie.
// Every failure becomes { code, message, status, detail, offline } so a screen can print the server's sentence.

async function call(path, { method = 'GET', body } = {}) {
  let res;
  try {
    res = await fetch(path, {
      method,
      cache: 'no-store',
      credentials: 'same-origin',
      headers: body === undefined ? undefined : { 'Content-Type': 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  } catch {
    const offline = typeof navigator !== 'undefined' && navigator.onLine === false;
    throw Object.assign(new Error('network'), { code: null, offline, network: true, status: 0 });
  }
  let data = null;
  try { data = await res.json(); } catch { data = null; }
  if (!res.ok) {
    const e = data?.error || {};
    throw Object.assign(new Error(e.message || 'failed'), { code: e.code || null, message: e.message || null, detail: e.detail || null, status: res.status });
  }
  return data;
}

const enc = encodeURIComponent;

export const mobGameApi = {
  open: (body) => call('/api/mob/game', { method: 'POST', body }),
  game: (id) => call(`/api/mob/game/${enc(id)}`),
  run: (id) => call(`/api/mob/game/${enc(id)}/run`, { method: 'POST', body: {} }),
  answer: (id, q, pick) => call(`/api/mob/game/${enc(id)}/answer`, { method: 'POST', body: { q, pick } }),
  finish: (id) => call(`/api/mob/game/${enc(id)}/finish`, { method: 'POST', body: {} }),
  podium: (id) => call(`/api/mob/game/${enc(id)}/podium`),
  review: (id) => call(`/api/mob/game/${enc(id)}/review`),
  fixStart: (game, q, stage) => call('/api/mob/fix/start', { method: 'POST', body: { game, q, stage } }),
  fixAnswer: (game, q, stage, pick) => call('/api/mob/fix/answer', { method: 'POST', body: { game, q, stage, pick } }),
  sticker: (mob, game, kind) => call('/api/mob/sticker', { method: 'POST', body: { mob, game, kind } }),
  // Live rooms (spec 3.2, 4.2): the ticket that lets this session onto the room's private channel, and the host's keys.
  ticket: (id) => call(`/api/mob/game/${enc(id)}/room/ticket`, { method: 'POST', body: {} }),
  roomStart: (id) => call(`/api/mob/game/${enc(id)}/room/start`, { method: 'POST', body: {} }),
  roomCancel: (id) => call(`/api/mob/game/${enc(id)}/room/cancel`, { method: 'POST', body: {} }),

};

/** Retry an idempotent write a few times (the server keeps the first answer for a question). */
export async function withRetry(fn, { tries = 3, wait = 700 } = {}) {
  let last;
  for (let i = 0; i < tries; i += 1) {
    try { return await fn(); } catch (e) {
      last = e;
      if (!e?.network && !(e?.status >= 500)) throw e;
      await new Promise((r) => setTimeout(r, wait * (i + 1)));
    }
  }
  throw last;
}
