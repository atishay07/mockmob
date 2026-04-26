import { NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';

const PREVIEW_COOKIE = 'mockmob_preview_access';

function isComingSoonEnabled() {
  return process.env.NODE_ENV === 'production' && process.env.COMING_SOON_ENABLED === 'true';
}

function hexFromBuffer(buffer) {
  return Array.from(new Uint8Array(buffer))
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');
}

async function signPreviewAccess(password) {
  const secret = process.env.COMING_SOON_COOKIE_SECRET || process.env.NEXTAUTH_SECRET || 'mockmob-local-preview';
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const signature = await crypto.subtle.sign('HMAC', key, encoder.encode(`mockmob-preview:${password}`));
  return hexFromBuffer(signature);
}

function shouldSkipComingSoon(pathname) {
  return (
    pathname === '/coming-soon' ||
    pathname.startsWith('/api/') ||
    pathname.startsWith('/_next/') ||
    pathname === '/favicon.ico' ||
    pathname.match(/\.(?:png|jpg|jpeg|gif|webp|svg|ico|css|js|map|txt|xml)$/)
  );
}

function isProtectedRoute(pathname) {
  return (
    pathname.startsWith('/dashboard') ||
    pathname.startsWith('/test') ||
    pathname.startsWith('/analytics')
  );
}

async function hasPreviewAccess(request) {
  const password = process.env.COMING_SOON_PASSWORD;
  if (!password) return false;
  const expected = await signPreviewAccess(password);
  return request.cookies.get(PREVIEW_COOKIE)?.value === expected;
}

export async function middleware(request) {
  const { pathname } = request.nextUrl;

  if (isComingSoonEnabled() && !shouldSkipComingSoon(pathname)) {
    const unlocked = await hasPreviewAccess(request);
    if (!unlocked) {
      return NextResponse.redirect(new URL('/coming-soon', request.url));
    }
  }

  if (!isProtectedRoute(pathname)) {
    return NextResponse.next();
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

  return response;
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico).*)',
  ],
};
