// A4 (15 Nov): one same-origin rule for state-changing API requests, applied in src/proxy.js before any route runs.
// Plain module (no Next, no server-only), so node tests run it directly.
//
// SameSite=Lax already keeps the Supabase session cookie off cross-site POSTs in current browsers; this covers browsers that
// ignore SameSite (some older Android browsers still used in India), where a form on another site could file, for example,
// an account deletion for the visitor. Browsers always send Origin on these methods. A request with no Origin header passes:
// the Android app, Razorpay's webhook, Google Play notifications, Vercel cron and server calls send none.

export const WRITE_METHODS = Object.freeze(['POST', 'PUT', 'PATCH', 'DELETE']);
const SITE_HOSTS = Object.freeze(['www.mockmob.in', 'mockmob.in']);
const DEV_HOSTNAMES = Object.freeze(['localhost', '127.0.0.1']);

/**
 * True when the request may go on. Refused only when it is a write under /api/ whose Origin names another site.
 *  - `origin`: the Origin header (null or '' when absent). "null" (a sandboxed frame, a file) is refused like any foreign origin.
 *  - `host`: the request's own Host header.
 *  - `appOrigin`: true when Origin is one of the app shells' fixed origins (src/lib/server/mobileCors.js), which the CORS
 *    rules already trust.
 */
export function allowedWriteOrigin({ method, pathname, origin, host, appOrigin = false, env = process.env }) {
  if (!WRITE_METHODS.includes(String(method || '').toUpperCase())) return true;
  if (!String(pathname || '').startsWith('/api/')) return true;
  if (origin === null || origin === undefined || origin === '') return true;
  if (appOrigin) return true;
  let url;
  try { url = new URL(origin); } catch { return false; }
  if (url.protocol !== 'https:' && url.protocol !== 'http:') return false;
  const originHost = url.host.toLowerCase();
  if (host && originHost === String(host).trim().toLowerCase()) return true;
  if (url.protocol === 'https:' && SITE_HOSTS.includes(originHost)) return true;
  if (env.NODE_ENV === 'development' && DEV_HOSTNAMES.includes(url.hostname)) return true;
  const deployment = String(env.VERCEL_URL || '').trim().toLowerCase();
  if (deployment && originHost === deployment) return true;
  return false;
}

export const CROSS_SITE_BODY = Object.freeze({ error: 'Forbidden', code: 'cross_site_request' });
