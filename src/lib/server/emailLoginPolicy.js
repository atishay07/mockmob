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

// Where the emailed button points (20 Oct, I2). The app's verified App Link claims `/app/login` on
// www.mockmob.in, so a code asked for in the app gets a button that opens the app on that phone. The same path
// is a website page too, so the button still signs in on the web when the app is not installed. Website
// sign-ins keep `/auth/callback`, which the app never claims (a website sign-in on the same phone must stay in
// the browser).
export const APP_LOGIN_PATH = '/app/login';
export const WEB_LOGIN_PATH = '/auth/callback';

/** True when the request body says the MockMob app asked for the code. */
export function isAppClient(body) {
  return body?.client === 'app';
}

export function loginLinkPath(body) {
  return isAppClient(body) ? APP_LOGIN_PATH : WEB_LOGIN_PATH;
}

const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * HOUR_MS;

// Three limits, taken in this order (the network first, so one address cannot spend other inboxes' budgets):
//   one address, any emails: 20 an hour (stops one sender mailing many inboxes)
//   one address and one email: 5 an hour (the normal resend budget)
//   one email, any address: 15 an hour (caps mail to one inbox; one address alone cannot use
//   it up and lock the student out, because it stops at 5 for that email)
// `scope` says which reply a refusal gets (F5, 15 Nov): 'email' means codes already went to this inbox, so the code field
// opens; 'network' means nothing was sent now, so it does not.
export const EMAIL_LOGIN_LIMITS = [
  // 60 an hour a network (was 20): now that the count is shared by every server, 20 would lock out a school lab or a
  // coaching centre's Wi-Fi, where many students sign up behind one address (review, 15 Nov 2026).
  { route: '/api/auth/email-login#ip', limit: 60, windowMs: HOUR_MS, identityOnly: false, perEmail: false, scope: 'network' },
  { route: '/api/auth/email-login#ip-email', limit: 5, windowMs: HOUR_MS, identityOnly: false, perEmail: true, scope: 'email' },
  { route: '/api/auth/email-login#email', limit: 15, windowMs: HOUR_MS, identityOnly: true, perEmail: true, scope: 'email' },
];

// A1 (15 Nov): one site-wide daily ceiling on sign-in emails, taken after the three above, so a flood from many addresses
// cannot spend the whole Resend allowance without anyone noticing. AUTH_EMAIL_DAILY_CEILING sets it.
export const AUTH_EMAIL_DAILY_CEILING_DEFAULT = 2000;

export function emailDailyCeiling(env = process.env) {
  const value = Number.parseInt(String(env.AUTH_EMAIL_DAILY_CEILING ?? ''), 10);
  return Number.isFinite(value) && value > 0 ? value : AUTH_EMAIL_DAILY_CEILING_DEFAULT;
}

export function emailLoginSiteLimit(env = process.env) {
  return { route: '/api/auth/email-login#site', limit: emailDailyCeiling(env), windowMs: DAY_MS, identityOnly: true, perEmail: false, scope: 'site', keyParts: ['all'] };
}

/**
 * The limiter options for one of the limits above and one email (A1, 15 Nov). In production these are always the
 * database's counts, whatever PERSISTENT_LIMITS_ENABLED says (a per-instance count let anyone mail-bomb an inbox). If the
 * database cannot answer, the in-memory limits decide for that call: a student is never locked out because a limiter is down.
 */
export function emailLimitOptions(limit, email, env = process.env) {
  const { perEmail, scope, keyParts, ...options } = limit;
  return { ...options, keyParts: keyParts || (perEmail ? [email] : []), persistent: env.NODE_ENV === 'production', fallback: 'memory' };
}

const MAX_WAIT_SECONDS = 24 * 60 * 60;
const minutesText = (seconds) => {
  const minutes = Math.max(1, Math.ceil(seconds / 60));
  return `${minutes} ${minutes === 1 ? 'minute' : 'minutes'}`;
};

/**
 * The 429 body for a refused sign-in email (F5, 15 Nov): each limit says what really happened. Only `rate_limited` (this
 * inbox) means a code is already on its way; the sign-in card opens the code field for that code alone.
 */
export function emailLimitReply(scope, retryAfterSeconds) {
  const seconds = Math.max(1, Math.min(MAX_WAIT_SECONDS, Math.ceil(Number(retryAfterSeconds)) || 60));
  if (scope === 'site') {
    return { code: 'email_busy', scope, retryAfterSeconds: seconds, message: 'Email sign-in is busy right now. Google sign-in still works, or try again later.' };
  }
  if (scope === 'network') {
    return { code: 'rate_limited_network', scope, retryAfterSeconds: seconds, message: `Too many sign-in emails from this network just now. Try again in ${minutesText(seconds)}, or use Google.` };
  }
  return {
    code: 'rate_limited',
    scope: 'email',
    retryAfterSeconds: seconds,
    message: seconds > 90
      ? `We already sent a code to this email. Check your inbox and spam, or try again in ${minutesText(seconds)}.`
      : `A code was sent a moment ago. You can ask for a new one in ${seconds} seconds.`,
  };
}


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
