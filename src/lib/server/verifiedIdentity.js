// Local identity checks for Supabase access tokens (no server-only or next/* imports, so node
// tests can load it).
//
// supabase-js getClaims() verifies the signature against the project's cached JWKS and the
// expiry, but in @supabase/auth-js 2.104 it checks neither issuer nor audience. This module adds
// those checks, so a token is accepted without a call to auth/v1/user only when:
//   - the signature is valid (getClaims),
//   - exp is in the future,
//   - iss is exactly <project url>/auth/v1,
//   - aud is "authenticated" and role is "authenticated",
//   - sub is present and the token is not an anonymous sign-in.
// Anything else is refused. Whenever local verification is impossible (no asymmetric key, JWKS
// unreachable) the caller asks auth/v1/user instead.

import { isDeadSessionError, isTransientAuthError } from '../supabase-auth-errors.js';

export function expectedIssuer(supabaseUrl) {
  try {
    return `${new URL(String(supabaseUrl)).origin}/auth/v1`;
  } catch {
    return null;
  }
}

/**
 * Checks decoded, signature-verified claims. Returns { ok: true, identity } or { ok: false, reason }.
 * `identity` is deliberately small: the claims prove who the token belongs to, not that the email
 * was confirmed (that needs the full user object from auth/v1/user).
 */
export function checkSupabaseClaims(claims, { supabaseUrl, nowMs = Date.now() } = {}) {
  if (!claims || typeof claims !== 'object') return { ok: false, reason: 'no_claims' };
  const issuer = expectedIssuer(supabaseUrl);
  if (!issuer) return { ok: false, reason: 'no_project_url' };
  if (claims.iss !== issuer) return { ok: false, reason: 'wrong_issuer' };
  const audiences = Array.isArray(claims.aud) ? claims.aud : [claims.aud];
  if (!audiences.includes('authenticated')) return { ok: false, reason: 'wrong_audience' };
  if (claims.role !== 'authenticated') return { ok: false, reason: 'wrong_role' };
  if (typeof claims.exp !== 'number' || !Number.isFinite(claims.exp) || claims.exp * 1000 <= nowMs) {
    return { ok: false, reason: 'expired' };
  }
  if (typeof claims.sub !== 'string' || !claims.sub) return { ok: false, reason: 'no_subject' };
  if (claims.is_anonymous === true) return { ok: false, reason: 'anonymous' };
  return {
    ok: true,
    identity: {
      id: claims.sub,
      email: typeof claims.email === 'string' ? claims.email : null,
      user_metadata: claims.user_metadata && typeof claims.user_metadata === 'object' ? claims.user_metadata : {},
      // Not in the token: only auth/v1/user can say whether the email was confirmed.
      email_confirmed_at: null,
      verifiedBy: 'claims',
    },
  };
}

/**
 * True when the existing MockMob row proves this claims identity: same id, and the row's email is
 * the token's email. A row is only ever created for an identity whose email Supabase confirmed, so
 * such a token needs no second look at auth/v1/user.
 */
export function rowMatchesIdentity(row, identity) {
  if (!row || !identity?.id || row.id !== identity.id) return false;
  if (!identity.email || !row.email) return false;
  return String(row.email).trim().toLowerCase() === String(identity.email).trim().toLowerCase();
}

/**
 * Resolves a bearer token (Android app) to a Supabase identity.
 * Returns { user, transient }. `supabase` is any client with auth.getClaims(jwt) and auth.getUser(jwt).
 * `isKnownIdentity(identity)` resolves true when the MockMob row for that identity already exists;
 * only then is the local result trusted. Otherwise (new account, legacy row, no asymmetric key,
 * JWKS unreachable) auth/v1/user answers, exactly as before.
 */
export async function verifyBearerIdentity({ token, supabase, supabaseUrl, isKnownIdentity, nowMs = Date.now() }) {
  if (!token) return { user: null, transient: false };

  let claimsResult = null;
  let claimsThrown = null;
  try {
    claimsResult = await supabase.auth.getClaims(token);
  } catch (error) {
    // getClaims throws a plain Error for an expired token; that is a refusal, not an outage.
    claimsThrown = error;
  }

  const claimsError = claimsThrown || claimsResult?.error || null;
  if (claimsError && !isTransientAuthError(claimsError)) return { user: null, transient: false };

  if (!claimsError) {
    const checked = checkSupabaseClaims(claimsResult?.data?.claims, { supabaseUrl, nowMs });
    if (!checked.ok) return { user: null, transient: false };
    let known = false;
    try {
      known = Boolean(await isKnownIdentity?.(checked.identity));
    } catch {
      known = false;
    }
    if (known) return { user: checked.identity, transient: false };
  }

  // Not verifiable locally (or the JWKS fetch failed): ask auth/v1/user.
  try {
    const { data, error } = await supabase.auth.getUser(token);
    if (error) return { user: null, transient: isTransientAuthError(error) && !isDeadSessionError(error) };
    return { user: data?.user || null, transient: false };
  } catch (error) {
    return { user: null, transient: isTransientAuthError(error) };
  }
}
