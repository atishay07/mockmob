import { NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';

function isProtectedRoute(pathname) {
  return (
    pathname.startsWith('/dashboard') ||
    pathname.startsWith('/test') ||
    pathname.startsWith('/analytics')
  );
}

export async function middleware(request) {
  const { pathname } = request.nextUrl;

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
