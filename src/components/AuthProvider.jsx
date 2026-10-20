"use client";

import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { claimPendingInvite, rememberInviteFromUrl } from '@/lib/referrals/claimPendingInvite';
import { hasSupabaseSessionCookie, isDeadSessionError, isTransientAuthError } from '@/lib/supabase-auth-errors';
import {clearStudyDrafts} from '@/../data/session_draft';

// Exported for the development-only Arena preview (/preview/arena); app code uses useAuth().
export const AuthContext = createContext(null);

// Statuses:
//   loading          first check in progress
//   authenticated    profile loaded
//   unauthenticated  no session, or Supabase ended it (refresh token revoked)
//   unavailable      a session exists but Supabase or MockMob could not be reached; the student
//                    is NOT signed out and the check retries when the connection returns
const AUTH_ME_RETRY_DELAYS = [0, 300, 800, 1600, 3000];
const AUTH_ME_TIMEOUT_MS = 8000;
// getSession may need a token refresh first; on a slow phone network that takes seconds.
const SESSION_CHECK_TIMEOUT_MS = 12000;
const RETRYABLE_AUTH_ME_STATUSES = [429, 500, 502, 503, 504];

// The Supabase client (about 60 KB compressed, 230 KB of script) loads on demand, never in a page's
// first download. A browser with no Supabase session cookie has no session to check (the proxy decides
// the same way, sessionProxy.js), so most landing visitors never load it at all. Signing in loads it:
// verifyEmailOtp below, or Google's redirect, which arrives on a fresh page with the cookie set.
// One shared import; a failed one (a dropped chunk on a patchy network) is forgotten so the next check
// tries again, and it reports as a retryable error, which keeps the student signed in.
function hasSessionCookie() {
  try {
    return hasSupabaseSessionCookie(document.cookie.split(';').map((part) => {
      const at = part.indexOf('=');
      return at < 0 ? { name: part.trim(), value: '' } : { name: part.slice(0, at).trim(), value: part.slice(at + 1).trim() };
    }));
  } catch {
    return true;
  }
}

let authClientModule = null;
function loadAuthClient() {
  if (!authClientModule) {
    authClientModule = import('@/lib/supabase-browser').catch((cause) => {
      authClientModule = null;
      const error = new Error('supabase_client did not load');
      error.name = 'AuthRetryableFetchError';
      error.cause = cause;
      throw error;
    });
  }
  return authClientModule;
}

async function getSupabaseBrowserClient() {
  return (await loadAuthClient()).getSupabaseBrowserClient();
}

// A signed-in student's browser starts fetching the client while the page's own scripts run, as it did when
// the client was bundled, so the session check on mount does not wait an extra round trip.
if (typeof document !== 'undefined' && hasSessionCookie()) loadAuthClient().catch(() => {});

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function withTimeout(promise, ms, label) {
  let timeoutId;
  const timeout = new Promise((_, reject) => {
    timeoutId = setTimeout(() => {
      const error = new Error(`${label} timed out`);
      error.name = 'AuthRetryableFetchError';
      reject(error);
    }, ms);
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timeoutId));
}

// { kind: 'ok', me } | { kind: 'unauthorized' } | { kind: 'unavailable' }
async function fetchMe() {
  for (const delay of AUTH_ME_RETRY_DELAYS) {
    if (delay) await wait(delay);
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), AUTH_ME_TIMEOUT_MS);
      const res = await fetch('/api/auth/me', {
        cache: 'no-store',
        credentials: 'same-origin',
        signal: controller.signal,
      }).finally(() => clearTimeout(timeoutId));

      if (res.ok) {
        const me = await res.json().catch(() => null);
        if (me?.user) return { kind: 'ok', me };
        return { kind: 'unauthorized' };
      }
      if (res.status === 401) return { kind: 'unauthorized' };
      // 404: signed in, but the MockMob profile did not load. Signing out would not fix it.
      if (res.status === 404) return { kind: 'unavailable' };
      if (!RETRYABLE_AUTH_ME_STATUSES.includes(res.status)) return { kind: 'unavailable' };
    } catch {
      // Offline, aborted or a dropped connection: try again on the schedule.
    }
  }
  return { kind: 'unavailable' };
}

async function readSession(supabase) {
  const { data, error } = await withTimeout(supabase.auth.getSession(), SESSION_CHECK_TIMEOUT_MS, 'supabase_session');
  if (error) throw error;
  return data?.session || null;
}

// Clears only this browser's session. A dead refresh token must not reach other devices,
// and signing out here must not sign the student out of the Android app.
function signOutLocally(supabase) {
  return supabase?.auth.signOut({ scope: 'local' }).catch(() => {});
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [status, setStatus] = useState('loading');
  const [needsOnboarding, setNeedsOnboarding] = useState(false);
  const mountedRef = useRef(false);
  const requestIdRef = useRef(0);
  const refreshPromiseRef = useRef(null);
  const userRef = useRef(null);
  const statusRef = useRef('loading');
  const supabaseUserIdRef = useRef(null);
  const listenRef = useRef(null);

  useEffect(() => {
    userRef.current = user;
  }, [user]);

  useEffect(() => {
    statusRef.current = status;
  }, [status]);

  // A friend's invite (owner D165): an emailed sign-in link may carry it as ?invite=<code>; it is kept on any page, then
  // claimed as soon as the student is signed in, before a first practice can run. Best effort, never blocks a page.
  useEffect(() => { rememberInviteFromUrl(); }, []);
  const signedInId = status === 'authenticated' ? user?.id : null;
  useEffect(() => {
    if (signedInId) claimPendingInvite(signedInId);
  }, [signedInId]);

  const applyUnauthenticated = useCallback(() => {
    if (!mountedRef.current) return;
    supabaseUserIdRef.current = null;
    userRef.current = null;
    setUser(null);
    setNeedsOnboarding(false);
    setStatus('unauthenticated');
  }, []);

  const applyAuthenticated = useCallback((me, supabaseUserId) => {
    if (!mountedRef.current) return;
    supabaseUserIdRef.current = supabaseUserId || null;
    userRef.current = me.user;
    setUser(me.user);
    setNeedsOnboarding(Boolean(me.needsOnboarding));
    setStatus('authenticated');
  }, []);

  // Keeps a signed-in student signed in: an already-loaded profile stays on screen, and
  // a first check that cannot reach the server shows "unavailable", never the login page.
  const applyUnavailable = useCallback(() => {
    if (!mountedRef.current || userRef.current) return;
    setStatus('unavailable');
  }, []);

  const refreshSession = useCallback(async ({ silent = true } = {}) => {
    // Never swap a loaded app for the loading screen: that unmounts the page (and a test
    // in progress). Only show it when nothing is loaded yet.
    if (!silent && mountedRef.current && !userRef.current) {
      setStatus('loading');
    }

    // Reuse an in-flight check instead of multiplying /api/auth/me calls.
    if (refreshPromiseRef.current) {
      return refreshPromiseRef.current;
    }

    const requestId = ++requestIdRef.current;
    const isCurrent = () => requestId === requestIdRef.current && mountedRef.current;
    let supabase = null;

    const refreshPromise = (async () => {
      try {
        if (!hasSessionCookie()) {
          if (isCurrent()) applyUnauthenticated();
          return null;
        }
        supabase = await getSupabaseBrowserClient();
        listenRef.current?.();
        let session = await readSession(supabase);
        if (!session) {
          if (isCurrent()) applyUnauthenticated();
          return null;
        }

        let result = await fetchMe();
        if (result.kind === 'unauthorized') {
          // The server refused the cookie it was sent. Rotate once and ask again before
          // deciding the session is over.
          const { data, error } = await supabase.auth.refreshSession();
          if (error) {
            if (isTransientAuthError(error)) {
              if (isCurrent()) applyUnavailable();
              return null;
            }
            await signOutLocally(supabase);
            if (isCurrent()) applyUnauthenticated();
            return null;
          }
          session = data?.session || session;
          result = await fetchMe();
        }
        if (!isCurrent()) return null;

        if (result.kind === 'ok') {
          applyAuthenticated(result.me, session?.user?.id);
          return result.me;
        }
        if (result.kind === 'unauthorized') {
          await signOutLocally(supabase);
          applyUnauthenticated();
          return null;
        }
        applyUnavailable();
        return null;
      } catch (error) {
        if (isDeadSessionError(error)) {
          await signOutLocally(supabase);
          if (isCurrent()) applyUnauthenticated();
          return null;
        }
        // Timeouts, offline and Supabase hiccups: keep the session and retry later.
        if (isCurrent()) {
          if (isTransientAuthError(error)) applyUnavailable();
          else if (!userRef.current) applyUnauthenticated();
        }
        return null;
      }
    })();

    refreshPromiseRef.current = refreshPromise;
    try {
      return await refreshPromise;
    } finally {
      if (refreshPromiseRef.current === refreshPromise) {
        refreshPromiseRef.current = null;
      }
    }
  }, [applyAuthenticated, applyUnauthenticated, applyUnavailable]);

  useEffect(() => {
    mountedRef.current = true;
    let active = true;
    let subscription = null;

    refreshSession({ silent: false });

    const onAuthStateChange = (event, session) => {
      if (!mountedRef.current) return;

      if (event === 'SIGNED_OUT') {
        requestIdRef.current += 1;
        applyUnauthenticated();
        return;
      }

      // The bootstrap above already handles the first session.
      if (event === 'INITIAL_SESSION') return;

      // supabase-js emits SIGNED_IN on every tab focus and TOKEN_REFRESHED about hourly.
      // For the same signed-in student neither changes the profile, so do nothing: the old
      // code reloaded the whole app here and could drop the student to the signup page.
      const sameStudent = Boolean(
        userRef.current && session?.user?.id && session.user.id === supabaseUserIdRef.current,
      );
      if ((event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') && sameStudent && statusRef.current === 'authenticated') {
        return;
      }

      // Defer: supabase-js warns against calling auth methods inside this callback.
      setTimeout(() => {
        if (mountedRef.current) refreshSession({ silent: Boolean(userRef.current) });
      }, 0);
    };
    // Listens once the client has loaded (every session check that loads it calls this); if it could not
    // load, the next retry below listens again.
    const listen = () => {
      if (subscription) return;
      getSupabaseBrowserClient().then((supabase) => {
        if (!active || subscription) return;
        subscription = supabase.auth.onAuthStateChange(onAuthStateChange).data.subscription;
      }, () => {
        // refreshSession reports the failure as unavailable; the retry below tries again.
      });
    };
    listenRef.current = listen;
    if (hasSessionCookie()) listen();

    // A first check that could not reach the server retries when the connection or the tab returns. A
    // tab with no session never loaded the client, so it cannot hear a sign-in in another tab: it checks
    // again when it is shown and the session cookie has appeared.
    const retryIfUnavailable = () => {
      if (document.visibilityState === 'hidden') return;
      if (statusRef.current === 'unavailable') {
        listen();
        refreshSession({ silent: true });
      } else if (statusRef.current === 'unauthenticated' && hasSessionCookie()) {
        refreshSession({ silent: true });
      }
    };
    window.addEventListener('online', retryIfUnavailable);
    document.addEventListener('visibilitychange', retryIfUnavailable);

    return () => {
      active = false;
      if (listenRef.current === listen) listenRef.current = null;
      mountedRef.current = false;
      subscription?.unsubscribe();
      window.removeEventListener('online', retryIfUnavailable);
      document.removeEventListener('visibilitychange', retryIfUnavailable);
    };
  }, [applyUnauthenticated, refreshSession]);

  const signInWithGoogle = useCallback(async () => {
    const redirectTo = `${window.location.origin}/auth/callback`;
    return (await loadAuthClient()).signInWithGoogle(redirectTo);
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
        const retryAfterSeconds = Number(data?.retryAfterSeconds || res.headers.get('retry-after')) || 0;
        return {
          data: null,
          error: {
            code: data?.code || (res.status === 429 ? 'rate_limited' : 'send_failed'),
            message: data?.message || 'Could not send the code. Please try again.',
            retryAfterSeconds,
          },
        };
      }
      return { data, error: null };
    } catch {
      return {
        data: null,
        error: { code: 'offline', message: 'Could not reach MockMob. Check your connection and try again.' },
      };
    }
  }, []);

  const verifyEmailOtp = useCallback(async (email, token) => {
    const result = await (await loadAuthClient()).verifyEmailOtp(email, token);
    if (!result.error) {
      await refreshSession({ silent: false });
    }
    return result;
  }, [refreshSession]);

  const signOut = useCallback(async () => {
    const supabase = await getSupabaseBrowserClient();
    const userId = userRef.current?.id;
    requestIdRef.current += 1;
    await signOutLocally(supabase);
    try{clearStudyDrafts(window.localStorage,userId);}catch{/* Storage is optional. */}
    applyUnauthenticated();
  }, [applyUnauthenticated]);

  // Ends every other session of this account (other browsers, the Android app), keeping this
  // one. Resolves to { ok: true } or { ok: false, code: 'offline' | 'signed_out' | 'failed' }.
  const signOutOtherDevices = useCallback(async () => {
    try {
      const supabase = await getSupabaseBrowserClient();
      const { error } = await supabase.auth.signOut({ scope: 'others' });
      if (!error) return { ok: true };
      if (isTransientAuthError(error)) return { ok: false, code: 'offline' };
      if (isDeadSessionError(error) || Number(error.status) === 401) return { ok: false, code: 'signed_out' };
      return { ok: false, code: 'failed' };
    } catch (error) {
      return { ok: false, code: isTransientAuthError(error) ? 'offline' : 'failed' };
    }
  }, []);

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
      signOutOtherDevices,
      refreshSession,
    }),
    [user, status, needsOnboarding, signInWithGoogle, signInWithEmail, verifyEmailOtp, signOut, signOutOtherDevices, refreshSession],
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
