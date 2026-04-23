"use client";

import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { signOut as nextAuthSignOut } from 'next-auth/react';
import { getSupabaseBrowserClient, signInWithGoogle as signInWithGoogleOAuth } from '@/lib/supabase-browser';

const AuthContext = createContext(null);

async function fetchMe() {
  const res = await fetch('/api/auth/me', { cache: 'no-store' });
  if (!res.ok) return null;
  return res.json();
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [status, setStatus] = useState('loading'); // loading | authenticated | unauthenticated
  const [needsOnboarding, setNeedsOnboarding] = useState(false);

  const refreshSession = useCallback(async () => {
    const me = await fetchMe();
    if (!me?.user) {
      setUser(null);
      setNeedsOnboarding(false);
      setStatus('unauthenticated');
      return null;
    }
    setUser(me.user);
    setNeedsOnboarding(Boolean(me.needsOnboarding));
    setStatus('authenticated');
    return me;
  }, []);

  useEffect(() => {
    let mounted = true;
    const supabase = getSupabaseBrowserClient();

    async function bootstrap() {
      if (!mounted) return;
      setStatus('loading');
      await refreshSession();
    }

    bootstrap();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(() => {
      if (!mounted) return;
      refreshSession();
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, [refreshSession]);

  const signInWithGoogle = useCallback(async () => {
    const redirectTo = `${window.location.origin}/auth/callback`;
    return signInWithGoogleOAuth(redirectTo);
  }, []);

  const signOut = useCallback(async () => {
    const supabase = getSupabaseBrowserClient();
    await supabase.auth.signOut();
    try {
      await nextAuthSignOut({ redirect: false });
    } catch {
      // No active NextAuth session; ignore.
    }
    await refreshSession();
  }, [refreshSession]);

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

