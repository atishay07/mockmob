import { NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { applyInviteCapture, applyRefCapture, refreshSupabaseSession } from '@/lib/server/sessionProxy';
import { mobPageOff } from '@/lib/mob/flag.mjs';
import { mobileOptions } from '@/lib/server/mobileCors';
import { CROSS_SITE_BODY, ROOT_WRITE_PATHS, allowedWriteOrigin } from '@/lib/server/sameOriginWrite';
import { supabaseCookieOptions } from '@/lib/supabaseCookieOptions';

// Next 16 Proxy (formerly middleware). It must live in src/ because the app does: the old
// root-level middleware.js was never compiled, so no session refresh ever ran (see
// docs/brain/AUTH-RELIABILITY-2026-10-13.md).
//
// Job: keep the Supabase session cookies fresh before any page renders. It never redirects:
// gating stays in the app shell, so a slow or failing Supabase call can't bounce a signed-in
// student to the login page. Route handlers refresh their own cookies through auth(request),
// and the Android app sends a bearer token, so /api is excluded.
// The Mob page does not exist while MOB_ENABLED is not 'true' (SOCIAL-SPEC section 7). A page-level notFound() cannot say
// 404 here: the (app) layout has already started streaming, so the status stayed 200 with a "not found" body. The proxy
// answers before any rendering: it rewrites to a path that no page owns, so Next serves its own 404 (with noindex).
//
// API requests reach this proxy only when they carry an Origin header (the second matcher), and only for one check (A4,
// 15 Nov): a POST, PUT, PATCH or DELETE whose Origin is another site is refused with 403 (sameOriginWrite.js). Nothing
// else happens for /api: no session refresh, no cookies. Webhooks, cron, the Android app and server calls send no Origin,
// so they never reach it.
//
// The payment writes outside /api/ (ROOT_WRITE_PATHS: Get Pro's checkout and /verify-payment, audit 15 Nov 2026) already
// reach this proxy through the page matcher, Origin or not. They get the same check, and then go on exactly as before.
function crossSiteWrite(request) {
  const allowed = allowedWriteOrigin({
    method: request.method,
    pathname: request.nextUrl.pathname,
    origin: request.headers.get('origin'),
    host: request.headers.get('host') || request.nextUrl.host,
    appOrigin: Object.keys(mobileOptions(request)).length > 0,
  });
  return allowed ? null : NextResponse.json(CROSS_SITE_BODY, { status: 403, headers: { 'Cache-Control': 'no-store' } });
}

export async function proxy(request) {
  if (mobPageOff(request.nextUrl.pathname)) return NextResponse.rewrite(new URL('/not-found-mob-off', request.url));
  if (request.nextUrl.pathname.startsWith('/api/')) {
    return crossSiteWrite(request) || NextResponse.next();
  }
  if (ROOT_WRITE_PATHS.includes(request.nextUrl.pathname)) {
    const refused = crossSiteWrite(request);
    if (refused) return refused;
  }
  const { response } = await refreshSupabaseSession(request, {
    NextResponse,
    createServerClient,
    supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL,
    supabaseKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    // A7: the session cookies carry Secure in production (src/lib/supabaseCookieOptions.js).
    clientOptions: { cookieOptions: supabaseCookieOptions() },
  });
  applyRefCapture(request, response);
  applyInviteCapture(request, response);
  return response;
}

export const config = {
  matcher: [
    // Every page except API routes, Next internals, the service worker, metadata files and
    // static assets. Constant string: Next analyses it at build time.
    '/((?!api/|_next/static|_next/image|_next/data|\\.well-known/|favicon\\.ico|sw\\.js|manifest\\.webmanifest|robots\\.txt|sitemap\\.xml|.*\\.(?:svg|png|jpg|jpeg|gif|webp|avif|ico|css|js|map|txt|xml|json|webmanifest|woff|woff2|ttf|otf|mp3|mp4|webm|pdf)$).*)',
    // A4: API routes only when the request carries an Origin header (browsers on writes), for the same-origin check alone.
    { source: '/api/:path*', has: [{ type: 'header', key: 'origin' }] },
  ],
};
