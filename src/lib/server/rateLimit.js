import 'server-only';

import { getClientIp } from './requestDiagnostics';
import { createHash } from 'node:crypto';
import { supabaseAdmin } from '@/lib/supabase';
import { takeFromMemory, takePersistent } from './rateLimitCore';

const buckets = new Map();
const memoryKey = (request, { route, keyParts = [] }) => [route, getClientIp(request), ...keyParts.map((part) => String(part || '').slice(0, 80))].join(':');
const persistentBucket = (request, options) => createHash('sha256').update([options.route, options.identityOnly ? '' : getClientIp(request), ...(options.keyParts || [])].join(':')).digest('hex');

// In-memory limit: counts per server instance, so it is a speed bump rather than a shared budget.
export function checkRateLimit(request, { route, limit, windowMs = 60_000, keyParts = [] }) {
  return takeFromMemory(buckets, memoryKey(request, { route, keyParts }), { limit, windowMs });
}

// Shared limit kept in the database (take_rate_limit) when PERSISTENT_LIMITS_ENABLED=true; the in-memory limit otherwise.
// If the database cannot answer, `fallback: 'memory'` keeps the in-memory limit for that call; without it the call is refused.
// Use 'memory' for free, read-style routes where a database blip should not lock students out, and leave it off where
// money or a paid model call sits behind the limit.
export async function checkPersistentRateLimit(request, options) {
  if (process.env.PERSISTENT_LIMITS_ENABLED !== 'true') return checkRateLimit(request, options);
  const bucket = persistentBucket(request, options);
  return takePersistent({
    take: (limit, windowMs) => supabaseAdmin().rpc('take_rate_limit', { p_bucket: bucket, p_limit: limit, p_window_ms: windowMs }),
    limit: options.limit,
    windowMs: options.windowMs || 60000,
    fallback: options.fallback === 'memory' ? () => checkRateLimit(request, options) : null,
    onFallback: () => console.warn(`[rateLimit] persistent limiter unavailable for ${options.route}; using the in-memory limit for this call`),
  });
}

/**
 * Give back the count a checkPersistentRateLimit call took, for a limit that should count only successful actions
 * (the request it was taken for failed). Same options as the check. Best effort: a failure leaves the count as it was.
 */
export async function giveBackRateLimit(request, options) {
  try {
    if (process.env.PERSISTENT_LIMITS_ENABLED !== 'true') {
      const bucket = buckets.get(memoryKey(request, options));
      if (bucket && bucket.resetAt > Date.now() && bucket.count > 0) bucket.count -= 1;
      return true;
    }
    const { error } = await supabaseAdmin().rpc('rate_limit_give_back', { p_bucket: persistentBucket(request, options) });
    return !error;
  } catch { return false; }
}

/** Seconds until a refused limit lets this caller through again, or null when it cannot be read. */
export async function rateLimitWait(request, options) {
  try {
    if (process.env.PERSISTENT_LIMITS_ENABLED !== 'true') {
      const bucket = buckets.get(memoryKey(request, options));
      return bucket && bucket.resetAt > Date.now() ? Math.max(1, Math.ceil((bucket.resetAt - Date.now()) / 1000)) : null;
    }
    const { data, error } = await supabaseAdmin().rpc('rate_limit_reset_at', { p_bucket: persistentBucket(request, options) });
    if (error || !data) return null;
    const ms = Date.parse(data) - Date.now();
    return Number.isFinite(ms) && ms > 0 ? Math.ceil(ms / 1000) : null;
  } catch { return null; }
}

export function rateLimitHeaders(result) {
  const headers = {
    'X-RateLimit-Limit': String(result.limit),
    'X-RateLimit-Remaining': String(result.remaining ?? 0),
  };
  if (result.retryAfterSeconds) {
    headers['Retry-After'] = String(result.retryAfterSeconds);
  }
  return headers;
}
