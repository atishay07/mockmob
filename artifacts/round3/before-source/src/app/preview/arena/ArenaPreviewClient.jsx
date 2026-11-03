"use client";

import { Suspense, useMemo } from 'react';
import { useSearchParams } from 'next/navigation';
import { AuthContext } from '@/components/AuthProvider';
import { RoleProvider } from '@/lib/roleContext';
import AppLayoutClient from '@/app/(app)/AppLayoutClient';
import DashboardPageClient from '@/app/(app)/dashboard/DashboardPageClient';
import TestPageClient from '@/app/(app)/test/TestPageClient';
import { buildPracticeQuote } from '@/../data/practice_quote';
import { learningPlan } from '@/../data/learning_engine';
import { previewCompass, previewInsights } from './previewRecord';
import { projectWallet, unreadableWallet, walletWindow } from '@/services/credits/aiWalletState';
import MockMobAIHub from '@/components/ai/MockMobAIHub';
import AdmissionCompassPageClient from '@/app/(app)/admission-compass/AdmissionCompassPageClient';
import AnalyticsPageClient from '@/app/(app)/analytics/AnalyticsPageClient';
import SavedPageClient from '@/app/(app)/saved/SavedPageClient';
import TodayPage from '@/app/(app)/today/page';
import RecoveryOverview from '@/components/RecoveryOverview';

// Original illustrative questions (the homepage sample set), never real bank rows.
const SAMPLE = [
  ['Partnership Fundamentals', 'Goodwill brought in by an incoming partner is shared by old partners in:', ['New ratio', 'Old ratio', 'Sacrificing ratio', 'Equal ratio']],
  ['Partnership Fundamentals', 'Assets are ₹80,000 and liabilities are ₹30,000. What is the owner’s equity?', ['₹30,000', '₹50,000', '₹80,000', '₹1,10,000']],
  ['Money and Banking', 'Which of these is NOT a function of the Reserve Bank of India?', ['Banker to the government', 'Issuing currency', 'Accepting public deposits', 'Controlling credit']],
  ['Controlling', 'Comparing actual performance with a planned standard is part of which management function?', ['Staffing', 'Controlling', 'Organising', 'Directing']],
  ['Vocabulary', 'Choose the option nearest in meaning to CANDID:', ['Hidden', 'Frank', 'Careful', 'Sweet']],
];

function sessionFor(count) {
  const started = Date.now();
  const questions = Array.from({ length: count }, (_, i) => {
    const [chapter, question, options] = SAMPLE[i % SAMPLE.length];
    return { id: `preview-q${i + 1}`, subject: 'accountancy', chapter, question, body: question, difficulty: 'medium',
      options: options.map((text, k) => ({ key: 'ABCD'[k], text })) };
  });
  return { id: 'preview-session', startedAt: new Date(started).toISOString(),
    expiresAt: new Date(started + count * 72000).toISOString(), questions,
    meta: { sessionId: 'preview-session', mode: 'quick', requestedCount: count, sessionTicket: 'preview-ticket', storage: 'device' } };
}

const PREVIEW_ATTEMPTS = [
  { id: 'preview-a1', subject: 'accountancy', score: 64, correct: 7, wrong: 2, unattempted: 1, total: 10, completedAt: Date.now() - 86400000 },
  { id: 'preview-a2', subject: 'economics', score: 48, correct: 5, wrong: 3, unattempted: 2, total: 10, completedAt: Date.now() - 3 * 86400000 },
];

// Account endpoints are stubbed; public read-only endpoints (subjects, chapters, stats)
// still come from the local server. Submissions are captured for inspection only.
if (typeof window !== 'undefined' && !window.__arenaPreviewFetch) {
  const real = window.fetch.bind(window);
  window.__arenaPreviewFetch = true;
  window.__previewSubmissions = [];
  const json = (body, status = 200) => Promise.resolve(new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } }));
  window.fetch = (input, init = {}) => {
    const url = new URL(typeof input === 'string' ? input : input.url, window.location.origin);
    const method = (init.method || 'GET').toUpperCase();
    if (url.pathname === '/api/attempts' && method === 'GET') return json(PREVIEW_ATTEMPTS);
    if (url.pathname === '/api/attempts' && method === 'POST') {
      window.__previewSubmissions.push(JSON.parse(init.body || '{}'));
      return json({ error: 'PREVIEW_ONLY: submission captured, not scored' }, 418);
    }
    if (url.pathname === '/api/sessions' && method === 'POST') {
      const body = JSON.parse(init.body || '{}');
      return json(sessionFor(body.mode === 'nta' ? 50 : Math.max(5, Number(body.count) || 10)));
    }
    if (url.pathname === '/api/sessions') return json({ ok: true });
    if (url.pathname === '/api/practice/quote') {
      // The real pure quote builder with fixture facts; ?inventory=down simulates a failed read.
      const page = new URLSearchParams(window.location.search);
      const pro = page.get('plan') === 'pro';
      const inventory = page.get('inventory') === 'down' ? { state: 'unavailable' }
        : { state: 'available', checkedAt: new Date().toISOString(), subjectCounts: { accountancy: 640, economics: 720, business_studies: 580, english: 12 } };
      return json(buildPracticeQuote({
        user: { id: 'preview-user', isPremium: pro, premiumUntil: pro ? '2027-07-31T18:29:59.000Z' : null, creditBalance: pro ? 0 : 40 },
        subject: url.searchParams.get('subject'), mode: url.searchParams.get('mode'), count: Number(url.searchParams.get('count')),
        inventory, allowance: { enabled: page.get('allowance') === 'on', used: false }, token: `preview-${Date.now()}`,
      }));
    }
    if (url.pathname === '/api/compass/pro') {
      const page = new URLSearchParams(window.location.search);
      if (page.get('record') === 'down') return json({ ok: false, error: 'compass_unavailable' }, 503);
      return previewCompass(page.get('plan') === 'pro').then((body) => json(body));
    }
    if (url.pathname === '/api/prepos/insights') {
      const page = new URLSearchParams(window.location.search);
      if (page.get('record') === 'empty') return json({ ok: true, insights: { state: 'empty', sessions: 0, questions: 0 }, findings: [] });
      if (page.get('record') === 'down') return json({ ok: false, error: 'insights_unavailable' }, 503);
      return json(previewInsights());
    }
    if (url.pathname === '/api/analytics') {
      return json({ totalAttempts: 3, totals: { correct: 12, wrong: 12, unattempted: 2 }, scoring: { device: 0 },
        timeline: [{ test: 'Oct 1', score: 41 }, { test: 'Oct 4', score: 52 }, { test: 'Oct 9', score: 49 }],
        subjects: [{ id: 'accountancy', name: 'Accountancy', tests: 3, avg: 47, accuracy: 50 }], weakChapters: [] });
    }
    if (url.pathname === '/api/recovery' && method === 'GET') {
      const page = new URLSearchParams(window.location.search);
      if (page.get('record') === 'down') return json({ error: 'unavailable' }, 503);
      const empty = page.get('record') === 'empty';
      const ordinaryReview = empty ? [] : PREVIEW_ATTEMPTS.map((a) => ({ id: a.id, subject: a.subject, completedAt: a.completedAt, correct: a.correct, total: a.total, mistakes: a.total - a.correct }));
      return json({ ordinaryReview, progress: [], playbook: empty ? [] : [{ id: 'pb1', strategy: 'two_pass', reflection: 'Do the sure questions first, then come back to the long ones.' }], reviewState: 'ready', note: 'Fresh delayed checks provide concept evidence, not a causal score gain.' });
    }
    if (url.pathname === '/api/bookmarks' && method === 'GET') return json({ questions: [] });
    if (url.pathname === '/api/learning/plan') return json(learningPlan({ minutes: Number(url.searchParams.get('minutes')) || 10 }));
    if (url.pathname === '/api/ai/credits') {
      // ?wallet=down simulates a missing schema; otherwise a paused wallet with stored balances.
      const page = new URLSearchParams(window.location.search);
      const wallet = page.get('wallet') === 'down' ? unreadableWallet('schema_unavailable')
        : projectWallet({ included_monthly_credits: 50, included_credits_used: 12, bonus_credits: 30, period_start: walletWindow().periodStart, reset_at: walletWindow().resetAt }, { paid: true, includedMonthlyCredits: 50, paidAiOpen: false });
      return json({ ok: true, state: wallet.state, message: wallet.message, wallet, practiceCredits: { balance: 40, label: 'Practice credits (Quick Practice and Full Mock)' } });
    }
    if (url.pathname === '/api/ai/mentor/history') return json({ ok: true, session: null, messages: [] });
    if (url.pathname === '/api/ai/mentor/local') return json({ ok: true, sessionId: 'preview-session' });
    if (url.pathname === '/api/ai/mentor/chat') {
      const next = learningPlan({ minutes: 10 }).primary;
      return json({ ok: true, response: { reply: `${next.title}. ${next.reason}`, actions: [{ label: next.title, type: 'navigate', route: next.href }] } });
    }
    if (url.pathname === '/api/questions/mine') return json([]);
    if (url.pathname === '/api/learning/summary') return json(null);
    if (url.pathname.startsWith('/api/auth/')) return json({ user: null }, 200);
    if (url.pathname.startsWith('/api/questions/') && url.pathname.endsWith('/vote')) return json({ score: 0, userVote: 0 });
    return real(input, init);
  };
}

function PreviewInner() {
  const params = useSearchParams();
  const pro = params.get('plan') === 'pro';
  const view = ['test', 'prepos', 'compass', 'radar', 'saved', 'today', 'review', 'progress'].includes(params.get('view')) ? params.get('view') : 'dashboard';
  const auth = useMemo(() => ({
    user: { id: 'preview-user', name: 'Preview Student', email: 'preview@example.test', role: 'student',
      subjects: ['accountancy', 'economics', 'business_studies', 'english', ...(params.get('stale') === '1' ? ['hindi', 'teaching_aptitude'] : [])],
      isPremium: pro, premiumUntil: pro ? '2027-07-31T18:29:59.000Z' : null, creditBalance: pro ? 0 : 40 },
    status: 'authenticated', needsOnboarding: false, isAuthenticated: true,
    signInWithGoogle: async () => ({}), signInWithEmail: async () => ({}), verifyEmailOtp: async () => ({}),
    signOut: async () => {}, refreshSession: async () => {},
  }), [pro, params]);
  return (
    <AuthContext.Provider value={auth}>
      <RoleProvider>
        <div role="note" style={{ position: 'fixed', zIndex: 100, right: 12, bottom: 12, padding: '6px 10px', borderRadius: 8, background: '#f4f5f0', color: '#172016', font: '600 12px system-ui' }}>
          Development preview · illustrative data
        </div>
        <AppLayoutClient>{view === 'test' ? <TestPageClient /> : view === 'prepos' ? <MockMobAIHub variant="page" initialTab={params.get('tab') || 'plan'} /> : view === 'compass' ? <AdmissionCompassPageClient /> : view === 'radar' ? <AnalyticsPageClient /> : view === 'saved' ? <SavedPageClient /> : view === 'today' ? <TodayPage /> : view === 'review' ? <div className="student-page student-page--review"><RecoveryOverview view="review" /></div> : view === 'progress' ? <div className="student-page student-page--progress"><RecoveryOverview view="progress" /></div> : <DashboardPageClient />}</AppLayoutClient>
      </RoleProvider>
    </AuthContext.Provider>
  );
}

export default function ArenaPreviewClient() {
  return <Suspense fallback={null}><PreviewInner /></Suspense>;
}
