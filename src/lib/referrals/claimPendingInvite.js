// The website's half of a friend invite (owner D165): keep the invite through sign-in, then claim it once the student is
// signed in, before any practice. Browser only; AuthProvider calls both functions, so every page (the email-link callback,
// onboarding, the app shell) is covered.
import { INVITE_COOKIE, INVITE_COOKIE_MAX_AGE, decodeInviteCookie, encodeInviteCookie, inviteKind, normaliseInviteCode } from './friendInvite.mjs';

const CLAIMED_KEY = 'mm_invite_claimed';

function readCookie() {
  if (typeof document === 'undefined') return null;
  const m = new RegExp(`(?:^|;\\s*)${INVITE_COOKIE}=([^;]+)`).exec(document.cookie || '');
  return m ? decodeURIComponent(m[1]) : null;
}

/**
 * An emailed sign-in link opened on another device carries the invite as ?invite=<code> (the sign-in email adds it from the
 * pending invite of the browser that asked for the code). Keep it as the pending invite here, unless one is already kept.
 */
export function rememberInviteFromUrl() {
  if (typeof window === 'undefined') return false;
  try {
    const code = normaliseInviteCode(new URLSearchParams(window.location.search).get('invite') || '');
    if (!code || decodeInviteCookie(readCookie())) return false;
    const value = encodeInviteCookie({ code, source: inviteKind(code) === 'mob_invite' ? 'mob_invite' : 'link', at: Date.now() });
    if (!value) return false;
    const secure = window.location.protocol === 'https:' ? '; secure' : '';
    document.cookie = `${INVITE_COOKIE}=${value}; path=/; max-age=${INVITE_COOKIE_MAX_AGE}; samesite=lax${secure}`;
    return true;
  } catch {
    return false;
  }
}

/** Claim the pending invite for the signed-in student, once per invite and tab. Best effort: never throws, never blocks. */
export async function claimPendingInvite(userId) {
  const pending = readCookie();
  if (!userId || !decodeInviteCookie(pending)) return null;
  const mark = `${userId}:${pending}`;
  try {
    if (window.sessionStorage.getItem(CLAIMED_KEY) === mark) return null;
    window.sessionStorage.setItem(CLAIMED_KEY, mark);
  } catch { /* storage off: the server answer clears the cookie anyway */ }
  try {
    const res = await fetch('/api/referrals/claim', {
      method: 'POST',
      credentials: 'same-origin',
      headers: { 'content-type': 'application/json' },
      body: '{}',
    });
    const body = await res.json().catch(() => null);
    if (!body?.done) {
      try { window.sessionStorage.removeItem(CLAIMED_KEY); } catch { /* a later page view tries again */ }
    }
    return body;
  } catch {
    try { window.sessionStorage.removeItem(CLAIMED_KEY); } catch { /* ignore */ }
    return null;
  }
}
