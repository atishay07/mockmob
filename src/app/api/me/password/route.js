import { NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { authWithStatus } from '@/lib/auth';
import { checkPersistentRateLimit, rateLimitHeaders } from '@/lib/server/rateLimit';
import { PASSWORD_STATUS, setAccountPassword } from '@/lib/server/passwordSet';
import { checkPassword, passwordProblem } from '@/lib/passwordRules.mjs';

export const dynamic = 'force-dynamic';
const ROUTE = '/api/me/password';
const NO_STORE = { 'Cache-Control': 'no-store' };
// A few tries is plenty for typing one password; the limit is per account and per address, 6 in 10 minutes.
const LIMIT = 6;
const WINDOW_MS = 10 * 60_000;

function problem(code, extra = {}, headers = {}) {
  return NextResponse.json(
    { ok: false, error: code, message: passwordProblem(code) },
    { status: PASSWORD_STATUS[code] || 500, headers: { ...NO_STORE, ...headers, ...extra } },
  );
}

// A browser form on another site cannot send this: it needs a JSON body, and an Origin that is not ours is refused.
function sameOrigin(request) {
  const origin = request.headers.get('origin');
  if (!origin) return true;
  try { return new URL(origin).host === request.headers.get('host'); } catch { return false; }
}

// POST { password }: sets or changes the signed-in student's password with their own cookie session (the same
// updateUser call the app makes). Answers { ok: true } or { ok: false, error, message } where message is the line to show.
// The password is never logged, stored or returned: a failure logs only a code and a status.
export async function POST(request) {
  if (!sameOrigin(request) || !(request.headers.get('content-type') || '').includes('application/json')) return problem('invalid');
  // This changes the browser's own session account. A bearer token (the app's) is not a browser session: refuse it, so the
  // account that is limited and checked is always the one whose cookies are changed.
  if (request.headers.get('authorization')) return problem('signed_out');

  const { session, transient } = await authWithStatus(request);
  if (!session?.user?.id) return problem(transient ? 'unavailable' : 'signed_out');

  const limit = await checkPersistentRateLimit(request, {
    route: ROUTE, limit: LIMIT, windowMs: WINDOW_MS, keyParts: [session.user.id], fallback: 'memory',
  });
  if (!limit.allowed) return problem('rate_limited', {}, rateLimitHeaders(limit));

  const body = await request.json().catch(() => null);
  const rule = checkPassword(body?.password);
  if (!rule.ok) return problem(rule.code);

  const result = await setAccountPassword({
    password: body.password,
    cookieStore: await cookies(),
    createServerClient,
    supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL,
    supabaseKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  });
  if (!result.ok) {
    // Code and status only. Never the password, never the error's message (it can quote the request).
    console.warn(`[${ROUTE}] not saved: ${result.code} (${result.errorCode || 'no code'}, ${result.status || 'no status'})`);
    return problem(result.code);
  }
  return NextResponse.json({ ok: true }, { headers: NO_STORE });
}
