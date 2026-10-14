"use client";

import React, { useSyncExternalStore } from 'react';
import Link from 'next/link';
import { Logo } from '@/components/Logo';
import { Mascot } from '@/components/brand/Mascot';
import { safeNextPath } from '@/lib/auth-redirect';
import './auth-stage.css';

// The frame for /login and /signup (W2.3). On a phone the form comes first; the promise follows.
// On a desktop the promise is a warm Night sheet on the left (pinned Night even on a Daylight
// page) and the form sits on the page's own ground on the right.
//
// Session states, without changing how sign-in works (SignupCard and AuthProvider are untouched):
//   loading         a member (by the visitor hint, set before paint) sees "Checking"; everyone
//                   else sees the form at once, so a stranger never waits on a spinner
//   unauthenticated the form
//   unavailable     the form, with a line that sign-in needs a connection
//   authenticated   "You are signed in" while the page redirects

const COPY = {
  login: {
    title: 'Log in to MockMob',
    lead: 'Pick up where you left off: your mocks, saved questions and the chapters to repair.',
    switchAsk: 'New here?',
    switchLabel: 'Create an account',
    switchHref: '/signup',
  },
  signup: {
    title: 'Create your free account',
    lead: 'Free to start, no card needed. Your practice, weak chapters and saved questions stay with your account.',
    switchAsk: 'Have an account?',
    switchLabel: 'Log in',
    switchHref: '/login',
  },
};

const PROMISE = ['Find the marks you’re losing.', 'Repair the mistake.', 'Prove it on fresh questions.'];

const noSubscribe = () => () => {};
const readNext = () => safeNextPath(new URLSearchParams(window.location.search).get('next')) || '';
const serverNext = () => '';

/** Carries a safe `next` page across the switch between log in and sign up. */
function withNext(href, next) {
  return next ? `${href}?${new URLSearchParams({ next }).toString()}` : href;
}

function Waiting({ title, message }) {
  return (
    <div className="as-wait" role="status" aria-live="polite">
      <span className="ui-spinner as-wait__spin" aria-hidden="true" />
      <div>
        <p className="as-wait__title">{title}</p>
        <p className="as-wait__msg">{message}</p>
      </div>
    </div>
  );
}

export function AuthStage({ mode = 'login', status = 'loading', children }) {
  const copy = COPY[mode] || COPY.login;
  const next = useSyncExternalStore(noSubscribe, readNext, serverNext);
  const switchHref = withNext(copy.switchHref, next);
  const signedIn = status === 'authenticated';
  const checking = status === 'loading';

  return (
    <div className="as" data-mode={mode}>
      <div className="as-grid">
        <main id="main-content" className="as-main">
          <header className="as-top">
            <Logo className="as-top__logo" />
            {!signedIn ? (
              <p className="as-top__switch">
                <span>{copy.switchAsk}</span>{' '}
                <Link href={switchHref}>{copy.switchLabel}</Link>
              </p>
            ) : null}
          </header>

          <div className="as-body">
            <div className="as-head">
              <h1 className="as-head__title">{signedIn ? 'You are signed in' : copy.title}</h1>
              {!signedIn ? <p className="as-head__lead">{copy.lead}</p> : null}
            </div>

            {mode === 'signup' && !signedIn ? (
              <p className="as-returning vs-returning-only">
                You have signed in on this device before. <Link href={withNext('/login', next)}>Log in instead</Link>
              </p>
            ) : null}

            {status === 'unavailable' ? (
              <p className="as-notice" role="status">
                We could not reach MockMob just now. Signing in needs a connection, so check it before you send a code.
              </p>
            ) : null}

            <div className="as-card">
              {signedIn ? (
                <Waiting title="Opening MockMob" message="Taking you to your page." />
              ) : (
                <>
                  {checking ? (
                    <div className="vs-member-only">
                      <Waiting title="Checking your sign-in" message="If you are already signed in, this opens your page." />
                    </div>
                  ) : null}
                  {/* Same position in every state, so the form never remounts and typed text stays. */}
                  <div className={checking ? 'vs-guest-only' : undefined}>{children}</div>
                </>
              )}
            </div>

            <nav className="as-legal" aria-label="Policies">
              <Link href="/privacy">Privacy</Link>
              <Link href="/terms">Terms</Link>
              <Link href="/contact">Contact</Link>
            </nav>
          </div>
        </main>

        <aside className="as-panel mm-night" aria-label="What MockMob does">
          <Logo className="as-panel__logo" />
          <ol className="as-promise">
            {PROMISE.map((line, index) => (
              <li key={line} className="as-promise__line" style={{ '--as-i': index }}>
                <span className="as-promise__bubble" aria-hidden="true" />
                <span>{line}</span>
              </li>
            ))}
          </ol>
          <div className="as-panel__foot">
            <p>Practice for CUET UG 2027. Free to start.</p>
            <div className="as-mobi" aria-hidden="true"><Mascot pose="greeting" eager /></div>
          </div>
        </aside>
      </div>
    </div>
  );
}
