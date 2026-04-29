import { NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';

const REF_COOKIE = 'mm_ref';
const REF_COOKIE_MAX_AGE = 60 * 60 * 24 * 30; // 30 days
const REF_PATTERN = /^[a-z0-9._-]{1,64}$/;

function isProtectedRoute(pathname) {
  return (
    pathname.startsWith('/dashboard') ||
    pathname.startsWith('/test') ||
    pathname.startsWith('/analytics')
  );
}

// Capture a creator/referral code from the URL into a 30-day cookie. Cookie
// is NOT httpOnly so the checkout component can read it for prefill on
// pages that haven't been hit by middleware in the same render.
function applyRefCapture(request, response) {
  const ref = request.nextUrl.searchParams.get('ref') ?? request.nextUrl.searchParams.get('code');
  if (!ref) return;
  const normalized = String(ref).trim().toLowerCase();
  if (!normalized || !REF_PATTERN.test(normalized)) return;

  const existing = request.cookies.get(REF_COOKIE)?.value;
  if (existing === normalized) return;

  response.cookies.set(REF_COOKIE, normalized, {
    httpOnly: false,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    maxAge: REF_COOKIE_MAX_AGE,
    path: '/',
  });
}

export async function middleware(request) {
  const { pathname } = request.nextUrl;

  if (!isProtectedRoute(pathname)) {
    const response = NextResponse.next();
    applyRefCapture(request, response);
    return response;
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) {
    return NextResponse.redirect(new URL('/signup', request.url));
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

  const { data } = await supabase.auth.getUser();
  if (!data?.user) {
    return NextResponse.redirect(new URL('/signup', request.url));
  }

  applyRefCapture(request, response);
  return response;
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico).*)',
  ],
};
