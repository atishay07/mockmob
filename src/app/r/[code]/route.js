import { NextResponse } from 'next/server';
import {
  DEVICE_COOKIE, DEVICE_COOKIE_MAX_AGE, INVITE_COOKIE, INVITE_COOKIE_MAX_AGE, decodeInviteCookie, encodeInviteCookie, inviteKind, normaliseInviteCode,
  referralsLive,
} from '@/lib/referrals/friendInvite.mjs';
import { deviceIdOf, newDeviceId } from '@/lib/server/referrals';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

// GET /r/<code>: a friend's invite link (owner D165, 20 Oct 2026). It leaves a 30-day pending invite (mm_invite: the code, how
// it came and the server's time) and opens sign-up, which says a friend invited you. Nothing is attributed here: the account is
// attached when it signs in (POST /api/referrals/claim) and only if it is new. The first friend's link is kept; a later one
// does not replace it. A Mob invite code pasted here goes to its Mob page, which leaves its own pending invite. While invites
// are off (REFERRALS_ENABLED) the link still lands on sign-up, with no cookie.
export async function GET(request, { params }) {
  const code = normaliseInviteCode(String((await params)?.code || '').slice(0, 16));
  const live = referralsLive();
  if (live && code && inviteKind(code) === 'mob_invite') {
    return NextResponse.redirect(new URL(`/join/${code}`, request.url), 307);
  }
  const target = new URL('/signup', request.url);
  if (live && code) target.searchParams.set('invite', '1');
  const response = NextResponse.redirect(target, 307);
  response.headers.set('Cache-Control', 'no-store');
  response.headers.set('X-Robots-Tag', 'noindex');
  if (!live || !code) return response;

  const secure = process.env.NODE_ENV === 'production';
  if (!decodeInviteCookie(request.cookies.get(INVITE_COOKIE)?.value)) {
    const value = encodeInviteCookie({ code, source: 'link', at: Date.now() });
    if (value) response.cookies.set(INVITE_COOKIE, value, { httpOnly: false, sameSite: 'lax', secure, maxAge: INVITE_COOKIE_MAX_AGE, path: '/' });
  }
  if (!deviceIdOf(request.cookies.get(DEVICE_COOKIE)?.value)) {
    response.cookies.set(DEVICE_COOKIE, newDeviceId(), { httpOnly: true, sameSite: 'lax', secure, maxAge: DEVICE_COOKIE_MAX_AGE, path: '/' });
  }
  return response;
}
