import 'server-only';
import { createServerClient } from '@supabase/ssr';
import { cookies, headers } from 'next/headers';
import { Database } from "@/../data/db";
import { supabaseAdmin } from '@/lib/supabase';
import { AUTH_STALE_HEADER, isTransientAuthError } from '@/lib/supabase-auth-errors';
import { ensureDbUser, hasConfirmedEmail, readCookieUser } from '@/lib/server/cookieSession';
import { countSignup } from '@/lib/server/funnelStore';
import { rowMatchesIdentity, verifyBearerIdentity } from '@/lib/server/verifiedIdentity';

// Live sign-in is Supabase only (Google OAuth with PKCE and the emailed code). The old
// next-auth setup and its /api/auth/[...nextauth] route were removed on 13 Oct 2026: nothing
// used them, and they were a second, unmonitored way to create accounts.

type SupabaseIdentity = {
  id: string;
  email?: string | null;
  email_confirmed_at?: string | null;
  user_metadata?: Record<string, any> | null;
  // 'claims': the token was verified locally and a MockMob row for it exists (no auth/v1/user call).
  verifiedBy?: 'claims';
};
type UserLookup = { user: SupabaseIdentity | null; transient: boolean };

// A locally verified token is trusted without auth/v1/user only for an identity that already has a
// MockMob row (same id and email). New accounts and older email-keyed rows take the full path,
// which proves the email was confirmed.
async function isKnownIdentity(identity: SupabaseIdentity) {
  return rowMatchesIdentity(await Database.getAuthUserById(identity.id), identity);
}

async function getSupabaseUserFromCookies(): Promise<UserLookup> {
  try {
    const [cookieStore, requestHeaders] = await Promise.all([cookies(), headers()]);
    return await readCookieUser({
      cookieStore,
      createServerClient,
      supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL,
      supabaseKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
      // src/proxy.js could not refresh this request: do not spend the refresh token here.
      stale: Boolean(requestHeaders.get(AUTH_STALE_HEADER)),
      isKnownIdentity,
    });
  } catch (error) {
    return { user: null, transient: isTransientAuthError(error) };
  }
}

async function getSupabaseUserFromBearer(authorization: string): Promise<UserLookup> {
  if (!authorization.startsWith('Bearer ')) return { user: null, transient: false };
  const token = authorization.slice(7).trim();
  if (!token) return { user: null, transient: false };
  try {
    return await verifyBearerIdentity({
      token,
      supabase: supabaseAdmin(),
      supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL,
      isKnownIdentity,
    });
  } catch (error) {
    return { user: null, transient: isTransientAuthError(error) };
  }
}

function sessionFor(dbUser: any, supabaseId: string) {
  return {
    user: {
      id: dbUser.id,
      name: dbUser.name || '',
      email: dbUser.email || '',
      image: dbUser.image,
      subjects: dbUser.subjects || [],
      role: dbUser.role || 'student',
      supabaseId,
      // The Supabase identity id (auth.uid() for Realtime and RLS). It can differ from id for old email-keyed rows.
      // Mob live rooms issue their Realtime ticket against it (MOB-BUILD-SPEC-V3 4.2).
      authUid: supabaseId,
    },
  };
}

/**
 * Resolves the MockMob session and says whether a failure was transient (Supabase or the
 * network was unreachable). Callers that decide whether a student is signed out, such as
 * /api/auth/me, must answer 503 on a transient failure so clients retry instead of signing out.
 */
export async function authWithStatus(request?: Request): Promise<{ session: any; transient: boolean }> {
  const authorization = request?.headers.get('authorization');
  const lookup = authorization
    ? await getSupabaseUserFromBearer(authorization)
    : await getSupabaseUserFromCookies();
  const supabaseUser = lookup.user;
  if (!supabaseUser?.email) return { session: null, transient: lookup.transient };

  if (supabaseUser.verifiedBy === 'claims') {
    // Verified locally against an existing MockMob row: no auth/v1/user call and, normally, no
    // users read either (the identity row is cached for 30 s). Plan, premium and credits are not
    // part of the session; routes that need them read Database.getUserById, which is never cached.
    const row = await Database.getAuthUserById(supabaseUser.id);
    if (!rowMatchesIdentity(row, supabaseUser)) {
      // The row changed or went away since the check a moment ago; ask the caller to retry.
      return { session: null, transient: true };
    }
    return { transient: false, session: sessionFor(row, supabaseUser.id) };
  }
  // An identity whose email was never confirmed (for example a sign-up made directly against
  // the Auth API with someone else's address) never resolves to a MockMob account.
  if (!hasConfirmedEmail(supabaseUser)) return { session: null, transient: false };

  const dbUser = await ensureDbUser({
    id: supabaseUser.id,
    name: supabaseUser.user_metadata?.full_name || supabaseUser.user_metadata?.name || null,
    email: supabaseUser.email,
    image: supabaseUser.user_metadata?.avatar_url || null,
  }, Database, {
    // Aggregate funnel only: one count for the platform category of this request, nothing about the
    // person. Runs once, when the account row is first created.
    onCreated: async () => {
      let requestHeaders: Headers | null = request?.headers || null;
      if (!requestHeaders) {
        try { requestHeaders = await headers(); } catch { requestHeaders = null; }
      }
      await countSignup(requestHeaders);
    },
  });
  if (!dbUser) return { session: null, transient: false };

  return { transient: false, session: sessionFor(dbUser, supabaseUser.id) };
}

export async function auth(request?: Request) {
  return (await authWithStatus(request)).session;
}
