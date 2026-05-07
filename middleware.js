import { NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';

const REF_COOKIE = 'mm_ref';
const REF_COOKIE_MAX_AGE = 60 * 60 * 24 * 30; // 30 days
const REF_PATTERN = /^[a-z0-9._-]{1,64}$/;
const REFERRAL_ENTRYPOINTS = ['/pricing'];
const BOT_UA_RE = /\b(bot|crawler|spider|slurp|gptbot|ccbot|claudebot|perplexitybot|bytespider)\b/i;
const SCRIPT_UA_RE = /\b(curl|wget|python|postman|insomnia|axios|node-fetch)\b/i;

function isProtectedRoute(pathname) {
  return (
    pathname.startsWith('/dashboard') ||
    pathname.startsWith('/test') ||
    pathname.startsWith('/analytics')
  );
}

function isReferralEntrypoint(pathname) {
  return REFERRAL_ENTRYPOINTS.some((entrypoint) => (
    pathname === entrypoint || pathname.startsWith(`${entrypoint}/`)
  ));
}

function hasSupabaseAuthCookie(request) {
  return request.cookies.getAll().some(({ name, value }) => (
    Boolean(value) &&
    (
      (name.startsWith('sb-') && name.includes('auth-token')) ||
      name.includes('supabase-auth-token')
    )
  ));
}

function getClientIp(request) {
  return request.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
    || request.headers.get('x-real-ip')
    || 'unknown';
}

function maskIp(ip) {
  if (!ip || ip === 'unknown') return 'unknown';
  if (/^\d{1,3}(\.\d{1,3}){3}$/.test(ip)) {
    const [first, second] = ip.split('.');
    return `${first}.${second}.x.x`;
  }
  if (ip.includes(':')) {
    return `${ip.split(':').slice(0, 3).join(':')}:x`;
  }
  return 'masked';
}

function classifyUserAgent(userAgent) {
  if (!userAgent) return 'unknown';
  if (BOT_UA_RE.test(userAgent)) return 'bot';
  if (SCRIPT_UA_RE.test(userAgent)) return 'script';
  if (/\b(android|iphone|ipad|mobile)\b/i.test(userAgent)) return 'mobile-browser';
  if (/\b(chrome|safari|firefox|edg|opr)\b/i.test(userAgent)) return 'desktop-browser';
  return 'other';
}

function logMiddlewareDecision(request, {
  action,
  pathname,
  protectedRoute,
  referralEntrypoint = false,
  refCaptured = false,
  status = 200,
  durationMs,
}) {
  console.info(JSON.stringify({
    level: 'info',
    event: 'middleware_decision',
    route: pathname,
    method: request.method,
    action,
    protectedRoute,
    referralEntrypoint,
    refCaptured,
    status,
    durationMs,
    requestId: request.headers.get('x-request-id') || null,
    vercelId: request.headers.get('x-vercel-id') || null,
    ip: maskIp(getClientIp(request)),
    uaClass: classifyUserAgent(request.headers.get('user-agent') || ''),
  }));
}

// Capture a creator/referral code from the URL into a 30-day cookie. Cookie
// is NOT httpOnly so the checkout component can read it for prefill on
// pages that haven't been hit by middleware in the same render.
function applyRefCapture(request, response) {
  const ref = request.nextUrl.searchParams.get('ref') ?? request.nextUrl.searchParams.get('code');
  if (!ref) return false;
  const normalized = String(ref).trim().toLowerCase();
  if (!normalized || !REF_PATTERN.test(normalized)) return false;

  const existing = request.cookies.get(REF_COOKIE)?.value;
  if (existing === normalized) return false;

  response.cookies.set(REF_COOKIE, normalized, {
    httpOnly: false,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    maxAge: REF_COOKIE_MAX_AGE,
    path: '/',
  });
  return true;
}

export async function middleware(request) {
  const { pathname } = request.nextUrl;
  const startedAt = Date.now();
  const protectedRoute = isProtectedRoute(pathname);
  const referralEntrypoint = isReferralEntrypoint(pathname);

  if (!protectedRoute) {
    const response = NextResponse.next();
    let refCaptured = false;
    if (referralEntrypoint) {
      refCaptured = applyRefCapture(request, response);
    }
    logMiddlewareDecision(request, {
      action: 'next_public_referral_entrypoint',
      pathname,
      protectedRoute,
      referralEntrypoint,
      refCaptured,
      status: response.status,
      durationMs: Date.now() - startedAt,
    });
    return response;
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) {
    const redirect = NextResponse.redirect(new URL('/signup', request.url));
    logMiddlewareDecision(request, {
      action: 'redirect_missing_supabase_env',
      pathname,
      protectedRoute,
      status: redirect.status,
      durationMs: Date.now() - startedAt,
    });
    return redirect;
  }

  const response = NextResponse.next();
  const supabase = createServerClient(url, anonKey, {
    cookies: {
      getAll: () => request.cookies.getAll().map(({ name, value }) => ({ name, value })),
      setAll: (cookiesToSet, headers) => {
        for (const { name, value, options } of cookiesToSet) {
          response.cookies.set(name, value, options);
        }
        if (headers) {
          Object.entries(headers).forEach(([key, value]) => {
            response.headers.set(key, value);
          });
        }
      },
    },
  });

  const hasAuthCookie = hasSupabaseAuthCookie(request);
  try {
    const { data, error } = await supabase.auth.getUser();
    if (!data?.user && !(hasAuthCookie && error)) {
      const redirect = NextResponse.redirect(new URL('/signup', request.url));
      logMiddlewareDecision(request, {
        action: 'redirect_unauthenticated',
        pathname,
        protectedRoute,
        status: redirect.status,
        durationMs: Date.now() - startedAt,
      });
      return redirect;
    }
  } catch {
    if (!hasAuthCookie) {
      const redirect = NextResponse.redirect(new URL('/signup', request.url));
      logMiddlewareDecision(request, {
        action: 'redirect_auth_error_without_cookie',
        pathname,
        protectedRoute,
        status: redirect.status,
        durationMs: Date.now() - startedAt,
      });
      return redirect;
    }
  }

  const refCaptured = applyRefCapture(request, response);
  logMiddlewareDecision(request, {
    action: 'next_protected',
    pathname,
    protectedRoute,
    refCaptured,
    status: response.status,
    durationMs: Date.now() - startedAt,
  });
  return response;
}

export const config = {
  // Keep middleware off public/API/static routes; every matched request becomes
  // a Vercel Routing Middleware invocation before cache.
  matcher: [
    '/dashboard/:path*',
    '/test/:path*',
    '/analytics/:path*',
    '/pricing/:path*',
  ],
};
