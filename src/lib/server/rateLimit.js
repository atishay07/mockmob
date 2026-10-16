import 'server-only';

import { getClientIp } from './requestDiagnostics';
import { createHash } from 'node:crypto';
import { supabaseAdmin } from '@/lib/supabase';
import { takeFromMemory, takePersistent } from './rateLimitCore';

const buckets = new Map();

// In-memory limit: counts per server instance, so it is a speed bump rather than a shared budget.
export function checkRateLimit(request, { route, limit, windowMs = 60_000, keyParts = [] }) {
  const key = [route, getClientIp(request), ...keyParts.map((part) => String(part || '').slice(0, 80))].join(':');
  return takeFromMemory(buckets, key, { limit, windowMs });
}

// Shared limit kept in the database (take_rate_limit) when PERSISTENT_LIMITS_ENABLED=true; the in-memory limit otherwise.
// If the database cannot answer, `fallback: 'memory'` keeps the in-memory limit for that call; without it the call is refused.
// Use 'memory' for free, read-style routes where a database blip should not lock students out, and leave it off where
// money or a paid model call sits behind the limit.
export async function checkPersistentRateLimit(request, options) {
  if (process.env.PERSISTENT_LIMITS_ENABLED !== 'true') return checkRateLimit(request, options);
  const bucket = createHash('sha256').update([options.route, options.identityOnly ? '' : getClientIp(request), ...(options.keyParts || [])].join(':')).digest('hex');
  return takePersistent({
    take: (limit, windowMs) => supabaseAdmin().rpc('take_rate_limit', { p_bucket: bucket, p_limit: limit, p_window_ms: windowMs }),
    limit: options.limit,
    windowMs: options.windowMs || 60000,
    fallback: options.fallback === 'memory' ? () => checkRateLimit(request, options) : null,
    onFallback: () => console.warn(`[rateLimit] persistent limiter unavailable for ${options.route}; using the in-memory limit for this call`),
  });
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
