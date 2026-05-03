"use client";

import { createBrowserClient } from '@supabase/ssr';

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
    auth: {
      // The dedicated /auth/callback page owns PKCE code exchange.
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
  const supabase = getSupabaseBrowserClient();
  return supabase.auth.signInWithOtp({
    email,
    options: {
      shouldCreateUser: true,
      emailRedirectTo: redirectTo,
    },
  });
}

export async function verifyEmailOtp(email, token) {
  const supabase = getSupabaseBrowserClient();
  return supabase.auth.verifyOtp({
    email,
    token,
    type: 'email',
  });
}
