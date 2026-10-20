import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase';
import { DEVICE_COOKIE, DEVICE_COOKIE_MAX_AGE, referralsLive } from '@/lib/referrals/friendInvite.mjs';
import { deviceIdOf, newDeviceId, readReferralStatus, referralBody } from '@/lib/server/referrals';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
const NO_STORE = { 'Cache-Control': 'no-store' };

// GET /api/referrals: the signed-in student's invite (owner D165): their link and code, and what happened so far in counts
// only (joined, practised, rewarded, earned; never a friend's name). Cookie or bearer, for the website and the app. The app
// sends its install id as ?device= so the same-device check knows the inviter's phone. live:false (and nothing else) while
// REFERRALS_ENABLED is off or the database cannot answer, so no surface ever shows a guess. Makes the student's code on first
// use; writes nothing else.
export async function GET(request) {
  const session = await auth(request);
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized', message: 'Please sign in.' }, { status: 401, headers: NO_STORE });
  if (!referralsLive()) return NextResponse.json({ ok: true, live: false }, { headers: NO_STORE });
  const cookieDevice = deviceIdOf(request.cookies.get(DEVICE_COOKIE)?.value);
  const deviceId = deviceIdOf(new URL(request.url).searchParams.get('device')) || cookieDevice;
  const status = await readReferralStatus({
    rpc: (name, args) => supabaseAdmin().rpc(name, args),
    userId: session.user.id,
    deviceId,
  });
  const response = NextResponse.json(referralBody(status, { live: true }), { headers: NO_STORE });
  if (!deviceId) {
    response.cookies.set(DEVICE_COOKIE, newDeviceId(), { httpOnly: true, sameSite: 'lax', secure: process.env.NODE_ENV === 'production', maxAge: DEVICE_COOKIE_MAX_AGE, path: '/' });
  }
  return response;
}
