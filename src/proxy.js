import { NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { applyRefCapture, refreshSupabaseSession, startOnRedirect } from '@/lib/server/sessionProxy';

// Next 16 Proxy (formerly middleware). It must live in src/ because the app does: the old
// root-level middleware.js was never compiled, so no session refresh ever ran (see
// docs/brain/AUTH-RELIABILITY-2026-10-13.md).
//
// Job: keep the Supabase session cookies fresh before any page renders. Gating stays in the app
// shell, so a slow or failing Supabase call can't bounce a signed-in student to the login page.
// The one redirect: a verified signed-in visit to "/" goes to the student's Start on place
// (Today unless they chose Practice; web IA plan 2.4, N1). Any other outcome leaves the landing.
// Route handlers refresh their own cookies through auth(request), and the Android app sends a
// bearer token, so /api is excluded.
export async function proxy(request) {
  const { response, outcome } = await refreshSupabaseSession(request, {
    NextResponse,
    createServerClient,
    supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL,
    supabaseKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  });
  const home = startOnRedirect(request, response, outcome, { NextResponse });
  if (home) return home;
  applyRefCapture(request, response);
  return response;
}

export const config = {
  matcher: [
    // Every page except API routes, Next internals, the service worker, metadata files and
    // static assets. Constant string: Next analyses it at build time.
    '/((?!api/|_next/static|_next/image|_next/data|\\.well-known/|favicon\\.ico|sw\\.js|manifest\\.webmanifest|robots\\.txt|sitemap\\.xml|.*\\.(?:svg|png|jpg|jpeg|gif|webp|avif|ico|css|js|map|txt|xml|json|webmanifest|woff|woff2|ttf|otf|mp3|mp4|webm|pdf)$).*)',
  ],
};
