import { NextResponse } from 'next/server';
import { checkRateLimit } from '@/lib/server/rateLimit';
import {
  DEVICE_COOKIE, DEVICE_COOKIE_MAX_AGE, INVITE_COOKIE, INVITE_COOKIE_MAX_AGE, REFERRAL_COPY, codeFromInput, encodeInviteCookie, inviteKind, referralsLive,
} from '@/lib/referrals/friendInvite.mjs';
import { deviceIdOf, newDeviceId } from '@/lib/server/referrals';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
const NO_STORE = { 'Cache-Control': 'no-store' };

// POST /api/referrals/pending { code }: a code typed (or a link pasted) on the sign-up page before the account exists
// (owner D165). It only checks the shape and leaves the pending invite (mm_invite, source 'code' or 'mob_invite', the server's
// time); a typed code is an explicit choice, so it replaces a link's. Nothing is looked up or attributed here (no one learns
// whether a code exists); POST /api/referrals/claim attaches it after sign-in, if the account is new.
export async function POST(request) {
  if (!referralsLive()) return NextResponse.json({ ok: false, message: 'Invites are not open yet.' }, { status: 404, headers: NO_STORE });
  const limit = checkRateLimit(request, { route: '/api/referrals/pending', limit: 30, windowMs: 10 * 60_000 });
  if (!limit.allowed) return NextResponse.json({ ok: false, message: 'Too many tries. Wait a few minutes.' }, { status: 429, headers: NO_STORE });
  let body = {};
  try { body = (await request.json()) || {}; } catch { body = {}; }
  const code = codeFromInput(typeof body?.code === 'string' ? body.code.slice(0, 200) : '');
  if (!code) return NextResponse.json({ ok: false, message: REFERRAL_COPY.signupBad }, { status: 400, headers: NO_STORE });
  const value = encodeInviteCookie({ code, source: inviteKind(code) === 'mob_invite' ? 'mob_invite' : 'code', at: Date.now() });
  const response = NextResponse.json({ ok: true, code, message: REFERRAL_COPY.signupSaved }, { headers: NO_STORE });
  const secure = process.env.NODE_ENV === 'production';
  response.cookies.set(INVITE_COOKIE, value, { httpOnly: false, sameSite: 'lax', secure, maxAge: INVITE_COOKIE_MAX_AGE, path: '/' });
  if (!deviceIdOf(request.cookies.get(DEVICE_COOKIE)?.value)) {
    response.cookies.set(DEVICE_COOKIE, newDeviceId(), { httpOnly: true, sameSite: 'lax', secure, maxAge: DEVICE_COOKIE_MAX_AGE, path: '/' });
  }
  return response;
}
