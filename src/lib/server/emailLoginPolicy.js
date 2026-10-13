// Policy for /api/auth/email-login. Plain module so node tests can load it.

// The login link must point at our own site. In production only these origins are used, so
// a missing or wrong NEXT_PUBLIC_SITE_URL, or a forged Host header, cannot send the one-time
// token anywhere else. Development and the local staging app use their own origin.
const PRODUCTION_ORIGINS = ['https://www.mockmob.in', 'https://mockmob.in'];

export function getSiteOrigin(request, env = process.env) {
  const configured = String(env.NEXT_PUBLIC_SITE_URL || '').trim().replace(/\/+$/, '');
  if (env.NODE_ENV === 'production') {
    return PRODUCTION_ORIGINS.includes(configured) ? configured : PRODUCTION_ORIGINS[0];
  }
  return configured || new URL(request.url).origin;
}

const HOUR_MS = 60 * 60 * 1000;

// Three limits, all persistent when PERSISTENT_LIMITS_ENABLED=true (Vercel):
//   one address, any emails: 20 an hour (stops one sender mailing many inboxes)
//   one address and one email: 5 an hour (the normal resend budget)
//   one email, any address: 15 an hour (caps mail to one inbox; one address alone cannot use
//   it up and lock the student out, because it stops at 5 for that email)
export const EMAIL_LOGIN_LIMITS = [
  { route: '/api/auth/email-login#ip', limit: 20, windowMs: HOUR_MS, identityOnly: false, perEmail: false },
  { route: '/api/auth/email-login#ip-email', limit: 5, windowMs: HOUR_MS, identityOnly: false, perEmail: true },
  { route: '/api/auth/email-login#email', limit: 15, windowMs: HOUR_MS, identityOnly: true, perEmail: true },
];


// The per-instance bucket map (the fallback limiter in the route) must not grow forever on a
// long-lived server fed random emails. Once it passes MAX_LOCAL_BUCKETS, buckets with no
// attempt in the last hour are dropped. Returns the number removed.
export const MAX_LOCAL_BUCKETS = 5000;

export function pruneLocalBuckets(buckets, now, windowMs = HOUR_MS, max = MAX_LOCAL_BUCKETS) {
  if (buckets.size <= max) return 0;
  let removed = 0;
  for (const [key, bucket] of buckets) {
    const last = bucket.attempts.length ? bucket.attempts[bucket.attempts.length - 1] : bucket.lastAt;
    if (now - Math.max(last, bucket.lastAt) >= windowMs) {
      buckets.delete(key);
      removed += 1;
    }
  }
  return removed;
}
