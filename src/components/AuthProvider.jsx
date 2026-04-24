"use client";

import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { getSupabaseBrowserClient, signInWithGoogle as signInWithGoogleOAuth } from '@/lib/supabase-browser';

const AuthContext = createContext(null);
const AUTH_ME_RETRY_DELAYS = [0, 150, 300];

async function fetchMe() {
  for (const delay of AUTH_ME_RETRY_DELAYS) {
    if (delay) {
      await new Promise((resolve) => setTimeout(resolve, delay));
    }

    const res = await fetch('/api/auth/me', {
      cache: 'no-store',
      credentials: 'same-origin',
    });

    if (res.ok) {
      return res.json();
    }

    if (res.status !== 401) {
      return null;
    }
  }

  return null;
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [status, setStatus] = useState('loading'); // loading | authenticated | unauthenticated
  const [needsOnboarding, setNeedsOnboarding] = useState(false);
  const mountedRef = useRef(false);
  const requestIdRef = useRef(0);

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
    const supabase = getSupabaseBrowserClient();

    if (!silent && mountedRef.current) {
      setStatus('loading');
    }

    try {
      const {
        data: { session },
        error,
      } = await supabase.auth.getSession();

      if (error) {
        throw error;
      }

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
        applyUnauthenticated();
        return null;
      }

      applyAuthenticated(me);
      return me;
    } catch {
      if (requestId === requestIdRef.current) {
        applyUnauthenticated();
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
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!mountedRef.current) return;

      if (!session) {
        requestIdRef.current += 1;
        applyUnauthenticated();
        return;
      }

      refreshSession();
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
    return signInWithGoogleOAuth(redirectTo);
  }, []);

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
      signOut,
      refreshSession,
    }),
    [user, status, needsOnboarding, signInWithGoogle, signOut, refreshSession],
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
