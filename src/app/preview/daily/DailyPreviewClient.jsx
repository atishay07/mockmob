"use client";
import '@/app/marketing.css'; // the .mm surface system (speed.md item 8): only where it is drawn

import { useMemo } from 'react';
import { useSearchParams } from 'next/navigation';
import { AuthContext } from '@/components/AuthProvider';
import { NavBar } from '@/components/NavBar';
import { MarketingFooter } from '@/components/MarketingFooter';
import DailyFive from '@/components/daily/DailyFive';
import { DAILY_FIVE_STORE } from '@/lib/dailyFive.mjs';
import { previewDaily } from '../arena/previewDaily';

// /preview/daily (page.jsx has the parameters). The fetch stub answers only the Daily Five's routes, and only on this path;
// &fresh=1 forgets this browser's Daily Five record (and its college) first, so a capture starts from the state the parameters name.

if (typeof window !== 'undefined' && window.location.pathname.startsWith('/preview/daily') && new URLSearchParams(window.location.search).get('fresh') === '1') {
  try { for (const key of [DAILY_FIVE_STORE, 'mm:daily-team:v1', 'mm:daily-team-skip:v1']) window.localStorage.removeItem(key); } catch { /* storage blocked */ }
}
if (typeof window !== 'undefined' && !window.__dailyPreviewFetch) {
  const real = window.fetch.bind(window);
  window.__dailyPreviewFetch = true;
  const json = (body, status = 200) => new Promise((resolve) => setTimeout(() => resolve(new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })), 120));
  window.fetch = (input, init = {}) => {
    const url = new URL(typeof input === 'string' ? input : input.url, window.location.origin);
    if (!window.location.pathname.startsWith('/preview/daily') || !url.pathname.startsWith('/api/')) return real(input, init);
    const method = (init.method || 'GET').toUpperCase();
    const fixture = new URLSearchParams(window.location.search);
    const answer = previewDaily(url, method, init, fixture, json);
    if (answer) return answer;
    if (url.pathname.startsWith('/api/auth/')) return json({ user: null });
    return method === 'GET' ? json({ error: 'Fixture endpoint not supplied.' }, 503) : json({ error: 'Preview only.' }, 418);
  };
}

export default function DailyPreviewClient() {
  const params = useSearchParams();
  const out = params.get('auth') === 'out';
  const auth = useMemo(() => ({
    user: out ? null : { id: 'preview-user', name: 'Preview Student', email: 'preview@example.test', role: 'student', subjects: ['english', 'accountancy'] },
    status: out ? 'unauthenticated' : 'authenticated', isAuthenticated: !out, needsOnboarding: false,
    signInWithGoogle: async () => ({}), signInWithEmail: async () => ({}), verifyEmailOtp: async () => ({}), signOut: async () => {}, refreshSession: async () => {},
  }), [out]);
  return (
    <AuthContext.Provider value={auth}>
      <div className="mm lp dly-page">
        <NavBar />
        <main id="main-content">
          <section className="lp-try dly" aria-label="Daily Five">
            <div className="mm-wrap">
              <div className="dly__col"><DailyFive /></div>
            </div>
          </section>
        </main>
        <MarketingFooter />
      </div>
    </AuthContext.Provider>
  );
}
