// A7 (15 Nov): the Supabase session cookies carry Secure on the live site, so the refresh token is never sent over plain
// http (a first visit typed as http, a captive portal). Never on http://localhost: a browser can drop a Secure cookie set
// there, and local sign-in would break. All four Supabase clients (browser, proxy, server reads, password) use this, so
// every write of the same cookie has the same attributes. Plain module: browser, server and node tests.

export function supabaseCookieOptions(options = {}) {
  const location = 'location' in options ? options.location : (typeof window !== 'undefined' ? window.location : null);
  if (location) return { secure: location.protocol === 'https:' };
  const env = options.env || process.env;
  const local = /^http:\/\//i.test(String(env.NEXT_PUBLIC_SITE_URL || '').trim()) || env.MOCKMOB_STAGING_APP === '1';
  return { secure: env.NODE_ENV === 'production' && !local };
}
