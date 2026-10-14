// Client cache for the next-step plan (GET /api/learning/plan?view=step).
//
// - Memory: a plan fetched in the last FRESH_MS is shown as current with no new request, so a
//   prefetch from Practice makes Today open with data.
// - Storage: the last plan per student and time choice is kept in localStorage for MAX_AGE_MS
//   and only for the same India day (tonight's record is per day). On return it is shown at once
//   with its age, and refreshed in place.
// - In flight: two callers asking for the same plan share one request.
// Every storage read and write is guarded: private windows and blocked storage just mean no cache.

export const FRESH_MS = 60 * 1000;
export const MAX_AGE_MS = 6 * 60 * 60 * 1000;
export const SETTLE_WAIT_MS = 4000;
const PREFIX = 'mm.plan.v1.';
const IST_OFFSET_MS = 330 * 60 * 1000;

const memory = new Map();
const inflight = new Map();
const settleListeners = new Set();

export const istDate = time => new Date(time + IST_OFFSET_MS).toISOString().slice(0, 10);
export const planSlot = minutes => ([10, 20, 30].includes(Number(minutes)) ? String(Number(minutes)) : 'auto');
export const planKey = (userId, minutes) => `${PREFIX}${userId}.${planSlot(minutes)}`;
export const planPath = minutes => `/api/learning/plan?${new URLSearchParams({ view: 'step', ...(planSlot(minutes) === 'auto' ? {} : { minutes: planSlot(minutes) }) })}`;

function browserStorage() {
  try { return typeof window !== 'undefined' ? window.localStorage : null; } catch { return null; }
}

/** A usable saved entry, or null when missing, malformed, too old, from another day or another student. */
export function readCachedPlan({ userId, minutes, now = Date.now(), storage = browserStorage() } = {}) {
  if (!userId) return null;
  const key = planKey(userId, minutes);
  const held = memory.get(key);
  if (held && now - held.savedAt >= 0 && now - held.savedAt < MAX_AGE_MS && istDate(held.savedAt) === istDate(now)) return held;
  if (!storage) return null;
  try {
    const entry = JSON.parse(storage.getItem(key) || 'null');
    const age = now - entry?.savedAt;
    if (!entry || entry.userId !== userId || !entry.plan?.primary || !Number.isFinite(age) || age < 0 || age >= MAX_AGE_MS || istDate(entry.savedAt) !== istDate(now)) {
      if (entry) storage.removeItem(key);
      return null;
    }
    return { plan: entry.plan, savedAt: entry.savedAt };
  } catch { return null; }
}

export function writeCachedPlan({ userId, minutes, plan, now = Date.now(), storage = browserStorage() }) {
  if (!userId || !plan?.primary) return;
  const key = planKey(userId, minutes);
  memory.set(key, { plan, savedAt: now });
  try { storage?.setItem(key, JSON.stringify({ userId, savedAt: now, plan })); } catch { /* storage full or blocked */ }
}

/** Forget saved plans: for one time choice, for one student, or (no userId) for everyone on this device. */
export function clearCachedPlans({ userId, minutes, storage = browserStorage() } = {}) {
  const match = userId ? (minutes === undefined ? `${PREFIX}${userId}.` : planKey(userId, minutes)) : PREFIX;
  for (const key of [...memory.keys()]) if (key.startsWith(match)) memory.delete(key);
  try {
    if (!storage) return;
    const keys = [];
    for (let i = 0; i < storage.length; i += 1) { const key = storage.key(i); if (key?.startsWith(match)) keys.push(key); }
    keys.forEach(key => storage.removeItem(key));
  } catch { /* blocked */ }
}

export const isFresh = (entry, now = Date.now()) => !!entry && now - entry.savedAt >= 0 && now - entry.savedAt < FRESH_MS;

/** "From 4 minutes ago". Whole minutes, then whole hours, rounded down. */
export function planAgeLabel(savedAt, now = Date.now()) {
  const minutes = Math.floor(Math.max(0, now - savedAt) / 60000);
  if (minutes < 1) return 'From less than a minute ago';
  if (minutes < 60) return `From ${minutes} ${minutes === 1 ? 'minute' : 'minutes'} ago`;
  const hours = Math.floor(minutes / 60);
  return `From ${hours} ${hours === 1 ? 'hour' : 'hours'} ago`;
}

async function getJson(path) {
  let res;
  try { res = await fetch(path, { cache: 'no-store', credentials: 'same-origin' }); }
  catch (cause) { const err = new Error('network'); err.kind = 'network'; err.cause = cause; throw err; }
  const body = await res.json().catch(() => null);
  if (!res.ok || !body?.primary) { const err = new Error(body?.error || `Request failed (${res.status})`); err.status = res.status; throw err; }
  return body;
}

function settled() {
  if (inflight.size) return;
  for (const done of [...settleListeners]) done();
}

/** Fetch the plan once per key at a time; saves it for `userId` when known. */
export function fetchLearningPlan({ userId, minutes, fetcher = getJson } = {}) {
  const path = planPath(minutes);
  // Keyed by student too: a request made before sign-in (and so answered 401) must never be
  // handed to the signed-in caller.
  const key = `${userId || ''}|${path}`;
  if (inflight.has(key)) return inflight.get(key);
  const request = fetcher(path)
    .then(plan => { writeCachedPlan({ userId, minutes, plan }); return plan; })
    .finally(() => { inflight.delete(key); settled(); });
  inflight.set(key, request);
  return request;
}

/** For Practice: warm the plan so Today opens with data. Silent on failure; skips a fresh copy. */
export function prefetchLearningPlan(userId) {
  if (!userId || isFresh(readCachedPlan({ userId }))) return;
  fetchLearningPlan({ userId }).catch(() => {});
}

/** Resolves once no plan request is in flight (or after `timeout`), so secondary content waits its turn. */
export function waitForPlanSettled(timeout = SETTLE_WAIT_MS) {
  return new Promise(resolve => {
    let timer;
    const done = () => { settleListeners.delete(done); clearTimeout(timer); resolve(); };
    if (!inflight.size && memory.size) { resolve(); return; }
    settleListeners.add(done);
    timer = setTimeout(done, timeout);
  });
}

/** Test hook: forget everything held in memory. */
export function resetPlanCacheMemory() {
  memory.clear();
  inflight.clear();
  settleListeners.clear();
}
