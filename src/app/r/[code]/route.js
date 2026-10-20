import { NextResponse } from 'next/server';
import {
  DEVICE_COOKIE, DEVICE_COOKIE_MAX_AGE, INVITE_COOKIE, INVITE_COOKIE_MAX_AGE, decodeInviteCookie, encodeInviteCookie, inviteLanding, referralsLive,
} from '@/lib/referrals/friendInvite.mjs';
import { deviceIdOf, newDeviceId } from '@/lib/server/referrals';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

// GET /r/<code>: a friend's invite link (owner D165, 20 Oct 2026). It leaves a 30-day pending invite (mm_invite: the code, how
// it came and the server's time) and opens sign-up, which says a friend invited you. Nothing is attributed here: the account is
// attached when it signs in (POST /api/referrals/claim) and only if it is new. The first friend's link is kept; a later one
// does not replace it. A Mob invite code pasted here goes to its Mob page, which leaves its own pending invite. While invites
// are off (REFERRALS_ENABLED) the link still lands on sign-up, with no cookie.
// An Android browser (D182) is sent to the Play Store listing with the code in the Install Referrer (referrer=invite%3D<code>),
// so the app reads it on its first launch and claims it after sign-in; the pending-invite cookie is still left, in case the
// friend signs up on the web instead. Only a valid, normalised friend code is put in that URL. Everyone else, and every
// Android visit with the switch off or no valid code, keeps the sign-up redirect.
export async function GET(request, { params }) {
  const live = referralsLive();
  const landing = inviteLanding({ rawCode: (await params)?.code, userAgent: request.headers.get('user-agent') || '', live });
  const { code } = landing;
  if (landing.to === 'join') return NextResponse.redirect(new URL(`/join/${code}`, request.url), 307);
  const target = new URL('/signup', request.url);
  if (live && code) target.searchParams.set('invite', '1');
  const response = landing.to === 'play' ? NextResponse.redirect(landing.url, 307) : NextResponse.redirect(target, 307);
  response.headers.set('Cache-Control', 'no-store');
  response.headers.append('Vary', 'User-Agent');
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
