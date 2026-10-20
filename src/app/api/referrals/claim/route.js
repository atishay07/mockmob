import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase';
import { checkRateLimit } from '@/lib/server/rateLimit';
import { DEVICE_COOKIE, INVITE_COOKIE, referralsLive } from '@/lib/referrals/friendInvite.mjs';
import { claimInput, claimReferral, deviceIdOf, networkOf } from '@/lib/server/referrals';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
const NO_STORE = { 'Cache-Control': 'no-store' };

// POST /api/referrals/claim: attach the signed-in account to the invite it came with (owner D165). Cookie or bearer.
// Body (all optional): { code, source: 'link' | 'code' | 'mob_invite', linkAgeSeconds, device }. Without a code the pending
// invite cookie (mm_invite, left by /r/<code>, ?ref=, /join/<code> or a code typed at sign-up) is used. The database decides
// (mm_referral_attach): only a new account that has not practised yet, never the inviter's own, one inviter per account.
// Credits move later, when the friend finishes a practice. Answers { ok, state, reason, done }; done means the invite is
// settled either way, so the cookie is cleared (and the app forgets its stored code). Never says who the inviter is.
export async function POST(request) {
  const session = await auth(request);
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized', message: 'Please sign in.' }, { status: 401, headers: NO_STORE });
  if (!referralsLive()) return NextResponse.json({ ok: false, state: null, reason: 'off', done: false }, { headers: NO_STORE });
  const limit = checkRateLimit(request, { route: '/api/referrals/claim', limit: 20, windowMs: 10 * 60_000, keyParts: [session.user.id] });
  if (!limit.allowed) return NextResponse.json({ ok: false, state: null, reason: 'rate_limited', done: false }, { status: 429, headers: NO_STORE });

  let body = {};
  try { body = (await request.json()) || {}; } catch { body = {}; }
  const cookieValue = request.cookies.get(INVITE_COOKIE)?.value || null;
  const input = claimInput({ body, cookieValue });
  if (!input) return NextResponse.json({ ok: false, state: null, reason: 'no_invite', done: true }, { headers: NO_STORE });

  const result = await claimReferral({
    rpc: (name, args) => supabaseAdmin().rpc(name, args),
    userId: session.user.id,
    input,
    deviceId: deviceIdOf(typeof body?.device === 'string' ? body.device : '') || deviceIdOf(request.cookies.get(DEVICE_COOKIE)?.value),
    network: networkOf(request.headers),
  });
  const response = NextResponse.json({ ok: result.ok, state: result.state, reason: result.reason, done: result.done }, { headers: NO_STORE });
  if (result.done && cookieValue) response.cookies.set(INVITE_COOKIE, '', { maxAge: 0, path: '/' });
  return response;
}
