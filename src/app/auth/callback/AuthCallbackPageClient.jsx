"use client";

import React, { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { AUTH_SESSION_PRIMARY_CLASS, AUTH_SESSION_QUIET_CLASS, AuthSessionScreen } from '@/components/auth/AuthSessionScreen';
import { getSupabaseBrowserClient } from '@/lib/supabase-browser';
import { postSignInPath } from '@/lib/auth-redirect';
import { readCallbackParams } from '@/lib/auth-callback';

const SESSION_RETRY_DELAYS = [0, 250, 600, 1000, 1600, 2400, 3200, 4500];
const RETRYABLE_PROFILE_STATUSES = [401, 429, 500, 502, 503, 504];
const MAX_UNAUTHORIZED_RETRIES = 2;
const MISSING_CODE_VERIFIER_MESSAGE =
  'Google sign-in has to finish in the same browser it started in. Go back to login and tap Continue with Google again in this browser.';
const NOTHING_TO_FINISH_MESSAGE =
  'This page finishes a sign-in, and there is none in progress. Go back to login to sign in.';
const LINK_FAILED_MESSAGE =
  'This login link has expired or was already used. Go back to login and ask for a new code.';

async function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

const PHASES = [
  'Verifying credentials...',
  'Loading your profile...',
  'Preparing your arena...',
];

function isMissingCodeVerifierError(error) {
  const message = String(error?.message || error || '').toLowerCase();
  return message.includes('code verifier') || message.includes('code_verifier');
}

async function getCurrentSession(supabase) {
  try {
    const {
      data: { session },
    } = await supabase.auth.getSession();
    return session || null;
  } catch {
    return null;
  }
}

// Drops the one-time code or token hash from the address bar and history.
function clearAuthQuery() {
  window.history.replaceState(null, '', window.location.pathname);
}

// The code and token hash are one-time. React may run the effect twice (Strict Mode in
// development), so reading the address bar runs once per page load and every run shares it.
let callbackStart = null;

// Reads and clears the address bar. Resolves to
//   { kind: 'confirm', params, signedInAs }  an email link: wait for the student's tap
//   { kind: 'done', destination }            Google (PKCE) or an existing session: finished
// or throws an Error whose message is shown.
async function startAuth() {
  const supabase = getSupabaseBrowserClient();
  const params = readCallbackParams(window.location.search, window.location.hash);
  clearAuthQuery();

  if (params.kind === 'error') {
    throw new Error(params.message);
  }

  if (params.kind === 'token_hash') {
    // The email link is not used up on load. Mail scanners that open links and run scripts
    // would otherwise spend it (and the code in the same email with it), and a link someone
    // else sent would sign this browser into their account without a word.
    const current = await getCurrentSession(supabase);
    return { kind: 'confirm', params, signedInAs: current?.user?.email || null };
  }

  if (params.kind === 'code') {
    // PKCE: the verifier saved in this browser when Google sign-in started is required.
    const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(params.code);
    if (exchangeError && !(await getCurrentSession(supabase))) {
      throw new Error(
        isMissingCodeVerifierError(exchangeError)
          ? MISSING_CODE_VERIFIER_MESSAGE
          : 'Google sign-in could not be completed. Go back to login and try again.',
      );
    }
  }

  if (params.kind === 'none' && !(await getCurrentSession(supabase))) {
    throw new Error(NOTHING_TO_FINISH_MESSAGE);
  }

  return { kind: 'done', destination: await loadProfileDestination(supabase) };
}

// After the student tapped Continue: spends the email link, then loads the profile.
async function finishEmailLink(params) {
  const supabase = getSupabaseBrowserClient();
  const { error: verifyError } = await supabase.auth.verifyOtp({
    token_hash: params.tokenHash,
    type: params.type,
  });
  if (verifyError) throw new Error(LINK_FAILED_MESSAGE);
  return loadProfileDestination(supabase);
}

// Waits for the session and the MockMob profile, then names the page to open.
async function loadProfileDestination(supabase) {
  let unauthorized = 0;
  let sawSession = false;
  for (const delay of SESSION_RETRY_DELAYS) {
    if (delay) {
      await sleep(delay);
    }

    const session = await getCurrentSession(supabase);
    if (!session) {
      continue;
    }
    sawSession = true;

    let res = null;
    try {
      res = await fetch('/api/auth/me', {
        cache: 'no-store',
        credentials: 'same-origin',
      });
    } catch {
      continue;
    }

    if (!res.ok) {
      if (res.status === 401 && ++unauthorized > MAX_UNAUTHORIZED_RETRIES) {
        throw new Error('MockMob could not confirm your sign-in. Go back to login and try again.');
      }
      if (RETRYABLE_PROFILE_STATUSES.includes(res.status)) {
        continue;
      }
      throw new Error('MockMob could not load your profile after login. Go back to login and try again.');
    }

    const data = await res.json().catch(() => ({}));
    return postSignInPath({ needsOnboarding: Boolean(data?.needsOnboarding) });
  }

  throw new Error(sawSession
    ? 'You are signed in, but your profile did not load yet. Check your connection, then go back to login.'
    : NOTHING_TO_FINISH_MESSAGE);
}

export default function AuthCallbackPageClient() {
  const [phase, setPhase] = useState(0);
  const [error, setError] = useState('');
  // { params, signedInAs } while waiting for the student's tap on an email link.
  const [question, setQuestion] = useState(null);
  const [working, setWorking] = useState(false);
  const mountedRef = useRef(false);
  const finishingRef = useRef(false);

  const follow = useCallback((promise) => {
    promise.then(
      (destination) => {
        if (mountedRef.current) window.location.replace(destination);
      },
      (authError) => {
        if (!mountedRef.current) return;
        setQuestion(null);
        setWorking(false);
        setError(authError?.message || 'We could not complete the login. Please try again.');
      },
    );
  }, []);

  useEffect(() => {
    mountedRef.current = true;
    const phaseTimer = setInterval(() => {
      setPhase((p) => Math.min(PHASES.length - 1, p + 1));
    }, 600);

    callbackStart ??= startAuth();
    callbackStart.then(
      (step) => {
        if (!mountedRef.current) return;
        if (step.kind === 'confirm') setQuestion({ params: step.params, signedInAs: step.signedInAs });
        else window.location.replace(step.destination);
      },
      (authError) => {
        if (mountedRef.current) setError(authError?.message || 'We could not complete the login. Please try again.');
      },
    );

    return () => {
      mountedRef.current = false;
      clearInterval(phaseTimer);
    };
  }, []);

  const continueWithLink = useCallback(() => {
    if (!question || finishingRef.current) return;
    finishingRef.current = true;
    setWorking(true);
    setPhase(0);
    follow(finishEmailLink(question.params));
  }, [follow, question]);

  if (question && !working) {
    const switching = Boolean(question.signedInAs);
    return (
      <AuthSessionScreen
        title={switching ? 'Switch account?' : 'Finish signing in'}
        message={switching
          ? `You're signed in as ${question.signedInAs}. Switch to the account in this email?`
          : 'Tap Continue to sign in with the link from your email.'}
      >
        <button type="button" onClick={continueWithLink} className={AUTH_SESSION_PRIMARY_CLASS} autoFocus>
          {switching ? 'Switch account' : 'Continue to MockMob'}
        </button>
        {switching ? (
          <Link href="/dashboard" className={AUTH_SESSION_QUIET_CLASS}>Stay signed in</Link>
        ) : null}
      </AuthSessionScreen>
    );
  }

  return (
    <AuthSessionScreen
      message={PHASES[phase]}
      error={error}
      actionHref="/login"
      actionLabel="Back to login"
    />
  );
}
