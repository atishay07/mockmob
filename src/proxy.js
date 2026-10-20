import { NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { applyInviteCapture, applyRefCapture, refreshSupabaseSession } from '@/lib/server/sessionProxy';
import { mobPageOff } from '@/lib/mob/flag.mjs';

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
export async function proxy(request) {
  if (mobPageOff(request.nextUrl.pathname)) return NextResponse.rewrite(new URL('/not-found-mob-off', request.url));
  const { response } = await refreshSupabaseSession(request, {
    NextResponse,
    createServerClient,
    supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL,
    supabaseKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
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
  ],
};
