"use client";

import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import {
  getSupabaseBrowserClient,
  signInWithGoogle as signInWithGoogleOAuth,
  verifyEmailOtp as verifyEmailOtpAuth,
} from '@/lib/supabase-browser';

const AuthContext = createContext(null);
const AUTH_ME_RETRY_DELAYS = [0, 250, 600, 1000, 1600, 2400, 3200];
const SESSION_RETRY_DELAYS = [0, 120, 300, 650];
const SESSION_CHECK_TIMEOUT_MS = 2500;
const AUTH_ME_TIMEOUT_MS = 3500;

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function withTimeout(promise, ms, label) {
  let timeoutId;
  const timeout = new Promise((_, reject) => {
    timeoutId = setTimeout(() => reject(new Error(`${label}_timeout`)), ms);
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timeoutId));
}

async function fetchMe() {
  for (const delay of AUTH_ME_RETRY_DELAYS) {
    if (delay) {
      await wait(delay);
    }

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), AUTH_ME_TIMEOUT_MS);
      const res = await fetch('/api/auth/me', {
        cache: 'no-store',
        credentials: 'same-origin',
        signal: controller.signal,
      }).finally(() => clearTimeout(timeoutId));

      if (res.ok) {
        return res.json();
      }

      if (![401, 404, 429, 500, 502, 503, 504].includes(res.status)) {
        return null;
      }
    } catch {
      // Server auth can briefly be unavailable while Supabase cookies settle.
      // Keep the lock screen up and retry instead of flashing the signup page.
    }
  }

  return null;
}

async function getSessionWithRetry(supabase) {
  let lastError = null;

  for (const delay of SESSION_RETRY_DELAYS) {
    if (delay) {
      await wait(delay);
    }

    const {
      data: { session },
      error,
    } = await withTimeout(supabase.auth.getSession(), SESSION_CHECK_TIMEOUT_MS, 'supabase_session');

    if (error) {
      lastError = error;
      continue;
    }

    if (session) {
      return session;
    }
  }

  if (lastError) {
    throw lastError;
  }

  return null;
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [status, setStatus] = useState('loading'); // loading | authenticated | unauthenticated
  const [needsOnboarding, setNeedsOnboarding] = useState(false);
  const mountedRef = useRef(false);
  const requestIdRef = useRef(0);
  const userRef = useRef(null);

  useEffect(() => {
    userRef.current = user;
  }, [user]);

  const applyUnauthenticated = useCallback(() => {
    if (!mountedRef.current) return;
    setUser(null);
    setNeedsOnboarding(false);
    setStatus('unauthenticated');
  }, []);

  const applyAuthenticated = useCallback((me) => {
    if (!mountedRef.current) return;
    setUser(me.user);
    setNeedsOnboarding(Boolean(me.needsOnboarding));
    setStatus('authenticated');
  }, []);

  const refreshSession = useCallback(async ({ silent = true } = {}) => {
    const requestId = ++requestIdRef.current;
    let supabase = null;

    if (!silent && mountedRef.current) {
      setStatus('loading');
    }

    try {
      supabase = getSupabaseBrowserClient();
      const session = await getSessionWithRetry(supabase);

      if (!session) {
        if (requestId === requestIdRef.current) {
          applyUnauthenticated();
        }
        return null;
      }

      const me = await fetchMe();
      if (requestId !== requestIdRef.current || !mountedRef.current) {
        return null;
      }

      if (!me?.user) {
        if (!silent || !userRef.current) {
          applyUnauthenticated();
        }
        return null;
      }

      applyAuthenticated(me);
      return me;
    } catch (error) {
      if (error?.message?.includes('Refresh Token') || error?.name === 'AuthApiError') {
        supabase?.auth.signOut().catch(() => {});
      }
      if (requestId === requestIdRef.current) {
        if (!silent || !userRef.current) {
          applyUnauthenticated();
        }
      }
      return null;
    }
  }, [applyAuthenticated, applyUnauthenticated]);

  useEffect(() => {
    mountedRef.current = true;
    const supabase = getSupabaseBrowserClient();

    async function bootstrap() {
      await refreshSession({ silent: false });
    }

    bootstrap();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      if (!mountedRef.current) return;

      if (event === 'SIGNED_OUT') {
        requestIdRef.current += 1;
        applyUnauthenticated();
        return;
      }

      if (!session) {
        refreshSession({ silent: false });
        return;
      }

      refreshSession({ silent: false });
    });

    return () => {
      mountedRef.current = false;
      subscription.unsubscribe();
    };
  }, [applyUnauthenticated, refreshSession]);

  const signInWithGoogle = useCallback(async () => {
    if (mountedRef.current) {
      setStatus('loading');
    }
    const redirectTo = `${window.location.origin}/auth/callback`;
    const result = await signInWithGoogleOAuth(redirectTo);
    if (result?.error && mountedRef.current) {
      setStatus('unauthenticated');
    }
    return result;
  }, []);

  const signInWithEmail = useCallback(async (email) => {
    try {
      const res = await fetch('/api/auth/email-login', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ email }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data?.ok) {
        return {
          data: null,
          error: { message: data?.message || 'Email login failed. Please try again.' },
        };
      }
      return { data, error: null };
    } catch {
      return {
        data: null,
        error: { message: 'Email login failed. Please try again.' },
      };
    }
  }, []);

  const verifyEmailOtp = useCallback(async (email, token) => {
    if (mountedRef.current) {
      setStatus('loading');
    }

    const result = await verifyEmailOtpAuth(email, token);
    if (!result.error) {
      await refreshSession({ silent: false });
    } else if (mountedRef.current) {
      setStatus('unauthenticated');
    }
    return result;
  }, [refreshSession]);

  const signOut = useCallback(async () => {
    const supabase = getSupabaseBrowserClient();
    await supabase.auth.signOut();
    requestIdRef.current += 1;
    applyUnauthenticated();
  }, [applyUnauthenticated]);

  const value = useMemo(
    () => ({
      user,
      status,
      needsOnboarding,
      isAuthenticated: status === 'authenticated',
      signInWithGoogle,
      signInWithEmail,
      verifyEmailOtp,
      signOut,
      refreshSession,
    }),
    [user, status, needsOnboarding, signInWithGoogle, signInWithEmail, verifyEmailOtp, signOut, refreshSession],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used inside <AuthProvider>.');
  }
  return context;
}
