// The parts of the rate limiter that do not touch the request or the database, so they can be tested on their own.
// src/lib/server/rateLimit.js wires them to the request (client IP) and to Supabase (take_rate_limit).

const MAX_BUCKETS = 5000;

function prune(buckets, now) {
  if (buckets.size <= MAX_BUCKETS) return;
  for (const [key, bucket] of buckets.entries()) {
    if (bucket.resetAt <= now) buckets.delete(key);
    if (buckets.size <= MAX_BUCKETS) return;
  }
}

/** Fixed-window counter held in this server instance's memory. */
export function takeFromMemory(buckets, key, { limit, windowMs = 60_000 }, now = Date.now()) {
  prune(buckets, now);
  const bucket = buckets.get(key);
  if (!bucket || bucket.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return { allowed: true, limit, remaining: limit - 1, resetAt: now + windowMs };
  }
  if (bucket.count >= limit) {
    return {
      allowed: false,
      limit,
      remaining: 0,
      resetAt: bucket.resetAt,
      retryAfterSeconds: Math.max(1, Math.ceil((bucket.resetAt - now) / 1000)),
    };
  }
  bucket.count += 1;
  buckets.set(key, bucket);
  return { allowed: true, limit, remaining: Math.max(0, limit - bucket.count), resetAt: bucket.resetAt };
}

/**
 * One persistent (database) limiter decision. `take(limit, windowMs)` resolves { data, error } like the
 * take_rate_limit RPC: data === true means the call is allowed.
 *
 * When the database cannot answer (the RPC returns an error or throws) the result depends on `fallback`:
 *  - a function: its result is used, so the route keeps a per-instance limit instead of failing every request;
 *  - missing: the call is refused (fail closed), which is what the money and AI routes have always done.
 * An answer of false is a real "slow down" and never falls back.
 */
export async function takePersistent({ take, limit, windowMs = 60_000, fallback = null, onFallback = null }) {
  let answer = null;
  let failed = false;
  try {
    const { data, error } = await take(limit, windowMs);
    if (error || typeof data !== 'boolean') failed = true;
    else answer = data;
  } catch {
    failed = true;
  }
  if (failed) {
    if (typeof fallback === 'function') {
      if (typeof onFallback === 'function') onFallback();
      return fallback();
    }
    return { allowed: false, limit, remaining: 0, retryAfterSeconds: 60 };
  }
  return { allowed: answer === true, limit, remaining: 0, retryAfterSeconds: 60 };
}
