"use client";

import { createBrowserClient } from '@supabase/ssr';
import { authSafeFetch, isTransientAuthError } from '@/lib/supabase-auth-errors';

let browserClient = null;

function getSupabaseKeys() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) {
    throw new Error('Supabase env vars missing. Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY.');
  }
  return { url, anonKey };
}

export function getSupabaseBrowserClient() {
  if (browserClient) return browserClient;
  const { url, anonKey } = getSupabaseKeys();
  browserClient = createBrowserClient(url, anonKey, {
    // A 429 or 5xx on a token refresh must not delete the session (supabase-auth-errors.js).
    global: { fetch: authSafeFetch },
    auth: {
      // Google sign-in uses PKCE: the code verifier stays in this browser and /auth/callback
      // exchanges the code. The callback page owns that exchange, so no auto-detection.
      flowType: 'pkce',
      detectSessionInUrl: false,
    },
  });
  return browserClient;
}

export async function signInWithGoogle(redirectTo) {
  const supabase = getSupabaseBrowserClient();
  return supabase.auth.signInWithOAuth({
    provider: 'google',
    options: { redirectTo },
  });
}

export async function signInWithEmailOtp(email, redirectTo) {
  const res = await fetch('/api/auth/email-login', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ email, redirectTo }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data?.ok) {
    return {
      data: null,
      error: { message: data?.message || 'Email login failed. Please try again.' },
    };
  }
  return { data, error: null };
}

/** Turns a Supabase verify error into copy that names the next step. */
export function friendlyOtpError(error) {
  if (!error) return null;
  const status = Number(error.status);
  if (status === 429 || error.code === 'over_request_rate_limit') {
    return { code: 'rate_limited', message: 'Too many tries for now. Wait a minute, then type the code again.' };
  }
  if (isTransientAuthError(error)) {
    return { code: 'offline', message: 'Could not reach MockMob. Check your connection and try the same code again.' };
  }
  return {
    code: 'invalid_code',
    message: 'That code is wrong or has expired. Use the newest email from MockMob, or send a new code.',
  };
}

export async function verifyEmailOtp(email, token) {
  const supabase = getSupabaseBrowserClient();
  // Our /api/auth/email-login mints the code with generateLink: existing accounts get a
  // magic-link code and new accounts a sign-up code. Type 'email' accepts both; 'magiclink'
  // stays as a fallback for older Supabase Auth versions.
  let lastResult = null;
  for (const type of ['email', 'magiclink']) {
    const result = await supabase.auth.verifyOtp({ email, token, type });
    if (!result.error) return result;
    lastResult = result;
    // A network failure or rate limit will not change with the other type.
    if (isTransientAuthError(result.error)) break;
  }
  return { ...lastResult, error: friendlyOtpError(lastResult?.error) };
}
