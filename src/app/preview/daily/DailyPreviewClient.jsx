"use client";
import '@/app/marketing.css'; // the .mm surface system (speed.md item 8): only where it is drawn

import { useMemo } from 'react';
import { useSearchParams } from 'next/navigation';
import { AuthContext } from '@/components/AuthProvider';
import { NavBar } from '@/components/NavBar';
import { MarketingFooter } from '@/components/MarketingFooter';
import DailyFive from '@/components/daily/DailyFive';
import { DAILY_FIVE_STORE, beginRun, keepAnswer, keepCheck, readRecord, todayDaily } from '@/lib/dailyFive.mjs';
import { DAILY_MINE_STORE } from '@/components/daily/dailyMineUi.mjs';
import { seenKey, writeSeen } from '@/lib/streak/streakCopy.mjs';
import { previewDaily, previewDailyStreak, seedPreviewMine } from '../arena/previewDaily';

// /preview/daily (page.jsx has the parameters). The fetch stub answers only the Daily Five's routes (and the streak's), and only
// on this path; &fresh=1 forgets this browser's Daily Five record (and its college) first, so a capture starts from the state
// the parameters name. &five=two|done (21 Nov 2026, "Your five") always start fresh: the device is handed that many answered
// places of the student's own five (previewDaily.js seedPreviewMine), and this device last saw the streak at 12 days.

const PREVIEW_USER = 'preview-user';
const SEEDED = { two: 2, done: 5 };

if (typeof window !== 'undefined' && window.location.pathname.startsWith('/preview/daily')) {
  const params = new URLSearchParams(window.location.search);
  const seeded = SEEDED[params.get('five')] || 0;
  if (params.get('fresh') === '1' || seeded || params.get('five')) {
    try { for (const key of [DAILY_FIVE_STORE, DAILY_MINE_STORE, 'mm:daily-team:v1', 'mm:daily-team-skip:v1', seenKey(PREVIEW_USER)]) window.localStorage.removeItem(key); } catch { /* storage blocked */ }
  }
  if (seeded && !window.__dailyPreviewSeeded) {
    window.__dailyPreviewSeeded = true;
    const { date } = todayDaily(Date.now());
    const { checks, fed } = seedPreviewMine(seeded);
    let record = beginRun(readRecord(null), { date, startedAt: Date.now() - 96_000 });
    checks.forEach((check, index) => {
      record = keepAnswer(record, { date, index, pick: check.pick });
      record = keepCheck(record, { date, index, check });
    });
    try {
      window.localStorage.setItem(DAILY_FIVE_STORE, JSON.stringify(record));
      window.localStorage.setItem(DAILY_MINE_STORE, JSON.stringify({ v: 1, date, user: PREVIEW_USER, personal: true, fed }));
      window.localStorage.setItem(seenKey(PREVIEW_USER), writeSeen(12, false));
      window.localStorage.setItem('mm:daily-team-skip:v1', '1');
    } catch { /* storage blocked */ }
  }
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
    const streak = fixture.get('auth') === 'out' ? null : previewDailyStreak(url, method, init, fixture, json);
    if (streak) return streak;
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
    user: out ? null : { id: PREVIEW_USER, name: 'Preview Student', email: 'preview@example.test', role: 'student', subjects: ['accountancy', 'business_studies', 'economics', 'english'] },
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
