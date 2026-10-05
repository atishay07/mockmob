"use client";

import { Suspense, useLayoutEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { AuthContext } from '@/components/AuthProvider';
import { ThemeToggle } from '@/components/ThemeToggle';
import { RoleProvider } from '@/lib/roleContext';
import AppLayoutClient from '@/app/(app)/AppLayoutClient';
import DashboardPageClient from '@/app/(app)/dashboard/DashboardPageClient';
import TestPageClient from '@/app/(app)/test/TestPageClient';
import { buildPracticeQuote } from '@/../data/practice_quote';
import { learningPlan, createEpisode, advanceEpisode, publicEpisode } from '@/../data/learning_engine';
import { studyMilestones, tonightMetadata, tonightCompletion } from '@/../data/study_progress';
import { previewCompass, previewInsights } from './previewRecord';
import { projectWallet, unreadableWallet, walletWindow } from '@/services/credits/aiWalletState';
import MockMobAIHub from '@/components/ai/MockMobAIHub';
import AssistantDrawer from '@/components/ai/AssistantDrawer';
import AdmissionCompassPageClient from '@/app/(app)/admission-compass/AdmissionCompassPageClient';
import AnalyticsPageClient from '@/app/(app)/analytics/AnalyticsPageClient';
import SavedPageClient from '@/app/(app)/saved/SavedPageClient';
import TodayPage from '@/app/(app)/today/page';
import RecoveryOverview from '@/components/RecoveryOverview';
import RecoveryJourney from '@/app/(app)/recovery/page';
import { DiscoveryFeed } from '@/components/feed/DiscoveryFeed';
import { UploadForm } from '@/components/feed/UploadForm';
import MyUploadsPageClient from '@/app/(app)/my-uploads/MyUploadsPageClient';
import ProfilePageClient from '@/app/(app)/profile/ProfilePageClient';
import LeaderboardPageClient from '@/app/(app)/leaderboard/LeaderboardPageClient';
import ResultPageClient from '@/app/(app)/result/[id]/ResultPageClient';
import AIRivalArena from '@/components/ai/AIRivalArena';
import OnboardingPageClient from '@/app/onboarding/OnboardingPageClient';
import ModerationPageClient from '@/app/(app)/moderation/ModerationPageClient';
import { FIXTURE_SUBJECTS, fixtureFeed, fixtureChapters, fixtureUploads, fixtureAttempt } from './previewFixtures';

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

// ?recovery=candidate: the unreleased candidate pathway driven by the real engine in memory.
// Idempotent by request key like the server; ?net=lose-once drops one response after commit;
// ?clock=<hours> shifts the fixture clock so delayed-check timing can be inspected.
const candidate = { episodes: new Map(), starts: new Map(), responses: new Map(), lostOnce: false };
function candidateRecovery(url, method, init, fixture) {
  const p = window.__previewPathway;
  const now = Date.now() + (Number(fixture.get('clock')) || 0) * 3_600_000;
  const reply = (body, status = 200) => new Promise(resolve => setTimeout(() => resolve(new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })), 25));
  const view = e => publicEpisode(p, e, now);
  if (url.pathname === '/api/learning/plan') {
    const episodes = [...candidate.episodes.values()].map(view);
    return reply({ ...learningPlan({ episodes, availableConcepts: [p.id], now, minutes: Number(url.searchParams.get('minutes')) || 10 }), episodes,
      supportedConcepts: [{ id: p.id, subject: p.subject, title: `${p.title} · candidate, not released` }], pathwayState: 'available', recordState: 'ready', ordinaryAttemptCount: 0 });
  }
  if (url.pathname === '/api/recovery/episodes' && method === 'POST') {
    const body = JSON.parse(init.body || '{}');
    if (candidate.starts.has(body.requestKey)) return reply(view(candidate.episodes.get(candidate.starts.get(body.requestKey))));
    const open = [...candidate.episodes.values()].find(e => !['invalidated', 'maintained'].includes(e.state));
    const e = open || createEpisode(p, { id: `preview-episode-${candidate.episodes.size + 1}`, at: now });
    candidate.episodes.set(e.id, e); candidate.starts.set(body.requestKey, e.id);
    return reply(view(e));
  }
  const match = url.pathname.match(/^\/api\/recovery\/episodes\/([^/]+)\/responses$/);
  if (match && method === 'POST') {
    const body = JSON.parse(init.body || '{}'); const id = decodeURIComponent(match[1]);
    const prior = candidate.responses.get(body.requestKey);
    if (prior) return prior.itemId === body.itemId && prior.value === body.value ? reply(view(candidate.episodes.get(id))) : reply({ error: 'IDEMPOTENCY_CONFLICT', message: 'IDEMPOTENCY CONFLICT' }, 409);
    try {
      const next = advanceEpisode(p, candidate.episodes.get(id), { itemId: body.itemId, type: body.type, value: body.value }, now);
      candidate.episodes.set(id, next); candidate.responses.set(body.requestKey, { itemId: body.itemId, value: body.value });
      window.__previewRecoveryCommits = (window.__previewRecoveryCommits || 0) + 1;
      if (fixture.get('net') === 'lose-once' && !candidate.lostOnce) { candidate.lostOnce = true; return Promise.reject(new TypeError('Illustrative response lost after commit')); }
      return reply(view(next));
    } catch (error) { return reply({ error: error.message, message: error.message.replaceAll('_', ' ') }, /CONFLICT/.test(error.message) ? 409 : 422); }
  }
  return null;
}

// Account endpoints are stubbed; public read-only endpoints (subjects, chapters, stats)
// still come from the local server. Submissions are captured for inspection only.
if (typeof window !== 'undefined' && !window.__arenaPreviewFetch) {
  const real = window.fetch.bind(window);
  window.__arenaPreviewFetch = true;
  window.__previewSubmissions = [];
  window.__previewChatRequests = [];
  const replyReceipts = new Map();
  let lostReply = false;
  // Resolve on a separate task, like an HTTP response. Immediate in-memory
  // replies can race initial effect cleanup/reset during development hydration.
  const json = (body, status = 200) => new Promise(resolve => setTimeout(() => resolve(
    new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } }),
  ), 25));
  window.fetch = (input, init = {}) => {
    const url = new URL(typeof input === 'string' ? input : input.url, window.location.origin);
    const method = (init.method || 'GET').toUpperCase();
    // Never leak fixture behaviour into real app routes after client navigation.
    if (!window.location.pathname.startsWith('/preview/arena')) return real(input, init);
    if (!url.pathname.startsWith('/api/')) return real(input, init);
    const fixture = new URLSearchParams(window.location.search);
    if (url.pathname === '/api/stats' && method === 'GET') {
      if (fixture.get('stats') === 'loading') return new Promise(() => {});
      if (fixture.get('stats') === 'error') return json({ state: 'unavailable', error: 'Fixture counts unavailable' }, 503);
      return real(input, init);
    }
    const state = fixture.get('data');
    const accountRead = method === 'GET' && !['/api/subjects', '/api/chapters'].includes(url.pathname) && !url.pathname.startsWith('/api/auth/');
    if (accountRead && state === 'loading') return new Promise((resolve, reject) => { init.signal?.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')), { once: true }); });
    if (accountRead && state === 'error') return json({ error: 'Illustrative connection failure' }, 503);
    if (fixture.get('recovery') === 'candidate' && window.__previewPathway) {
      const handled = candidateRecovery(url, method, init, fixture);
      if (handled) return handled;
    }
    if (url.pathname === '/api/subjects') return state === 'subject-error' ? json({ error: 'Fixture subject failure' }, 503) : json(FIXTURE_SUBJECTS);
    if (url.pathname === '/api/chapters') return state === 'chapter-error' ? json({ error: 'Fixture chapter failure' }, 503) : json(fixtureChapters(url.searchParams.get('subject')));
    if (url.pathname === '/api/questions/feed') {
      const limit = Number(url.searchParams.get('limit')) || 12;
      const offset = Number(url.searchParams.get('offset')) || 0;
      const rows = state === 'empty' ? [] : fixtureFeed(url.searchParams.get('subject'), state === 'long').filter((question) => (!url.searchParams.get('chapter') || question.chapter === url.searchParams.get('chapter')) && (!url.searchParams.get('difficulty') || question.difficulty === url.searchParams.get('difficulty')));
      const raw = rows.slice(offset, offset + limit);
      return json({ questions: state === 'held' && offset === 0 ? [] : raw, total: null, nextOffset: offset + raw.length, hasMore: raw.length === limit });
    }
    if (url.pathname === '/api/leaderboard') return json(state === 'empty' ? [] : [
      { userId: 'fixture-rival', name: 'A labelled practice rival', tests: 12, totalScore: 610, isSynthetic: true },
      { userId: 'preview-user', name: state === 'long' ? 'An exceptionally long illustrative display name for responsive checks' : 'Preview Student', tests: 2, totalScore: 112 },
      { userId: 'fixture-student', name: 'Illustrative student', tests: 1, totalScore: 50 },
    ]);
    if (url.pathname.startsWith('/api/attempts/')) return state === 'empty' ? json({ error: 'No fixture attempt' }, 404) : json(fixtureAttempt());
    if (url.pathname.startsWith('/api/users/') && method === 'PATCH') return state === 'save-error' ? json({ error: 'Fixture profile save failure' }, 503) : json({ ok: true });
    if (url.pathname === '/api/bookmarks' && method === 'POST') return state === 'save-error' ? json({ error: 'Save limit', limit: 25 }, 402) : json({ saved: JSON.parse(init.body || '{}').saved });
    if (url.pathname.startsWith('/api/questions/') && url.pathname.endsWith('/interact')) return json({ ok: true });
    if (url.pathname.startsWith('/api/questions/') && url.pathname.endsWith('/vote')) return state === 'vote-error' ? json({ error: 'Fixture vote failure' }, 503) : json({ score: 1, userVote: JSON.parse(init.body || '{}').vote_type });
    if (url.pathname === '/api/questions/upload') return json({ error: 'Preview only: no question was submitted. Your draft is still here.' }, 418);
    if (url.pathname === '/api/ai/usage') return json({ ok: true, isPaid: fixture.get('plan') === 'pro', freeRivalUsedToday: false, aiWallet: unreadableWallet('paid_ai_paused') });
    if (url.pathname.startsWith('/api/ai/rival/')) return json({ error: 'Preview only: benchmarks cannot start or submit here.' }, 418);
    if (url.pathname === '/api/attempts' && method === 'GET') return json(state === 'empty' ? [] : PREVIEW_ATTEMPTS);
    if (url.pathname === '/api/attempts' && method === 'POST') {
      window.__previewSubmissions.push(JSON.parse(init.body || '{}'));
      if (window.__previewOfflineSubmission) return Promise.reject(new TypeError('Illustrative network interruption'));
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
      if (page.get('record') === 'empty' || state === 'empty') return json({ ok: true, insights: { state: 'empty', sessions: 0, questions: 0 }, findings: [] });
      if (page.get('record') === 'down') return json({ ok: false, error: 'insights_unavailable' }, 503);
      return json(previewInsights());
    }
    if (url.pathname === '/api/analytics') {
      if (state === 'empty') return json({ totalAttempts: 0, totals: { correct: 0, wrong: 0, unattempted: 0 }, scoring: { device: 0 }, timeline: [], subjects: [], weakChapters: [] });
      return json({ totalAttempts: 3, totals: { correct: 12, wrong: 12, unattempted: 2 }, scoring: { device: 0 },
        timeline: [{ test: 'Oct 1', score: 41 }, { test: 'Oct 4', score: 52 }, { test: 'Oct 9', score: 49 }],
        subjects: [{ id: 'accountancy', name: 'Accountancy', tests: 3, avg: 47, accuracy: 50 }], weakChapters: [] });
    }
    if (url.pathname === '/api/recovery' && method === 'GET') {
      const page = new URLSearchParams(window.location.search);
      if (page.get('record') === 'down') return json({ error: 'unavailable' }, 503);
      const empty = page.get('record') === 'empty' || state === 'empty';
      const ordinaryReview = empty ? [] : PREVIEW_ATTEMPTS.map((a) => ({ id: a.id, subject: a.subject, completedAt: a.completedAt, correct: a.correct, total: a.total, mistakes: a.total - a.correct }));
      const milestones = empty ? [] : studyMilestones([{ id: 'preview-a1', completedAt: Date.now() - 1000, selectionMeta: { scoringVersion: 'server_practice_v1' } }], []);
      return json({ ordinaryReview, progress: [], milestones, playbook: empty ? [] : [{ id: 'pb1', strategy: 'two_pass', reflection: 'Do the sure questions first, then come back to the long ones.' }], reviewState: 'ready', note: 'Fresh delayed checks provide concept evidence, not a causal score gain.' });
    }
    if (url.pathname === '/api/bookmarks' && method === 'GET') return json({ questions: state === 'empty' ? [] : fixtureFeed('accountancy').slice(0, 2), questionIds: [], count: state === 'empty' ? 0 : 2 });
    if (url.pathname === '/api/learning/plan') {
      const attempts = fixture.get('tonight') === 'done' ? [{ id: 'preview-a1', completedAt: Date.now() - 1000, selectionMeta: { scoringVersion: 'server_practice_v1', ...tonightMetadata({ tonightKey: 'preview-tonight-key', tonightMinutes: 30, mode: 'quick', count: 20 }) } }] : [];
      return json({ ...learningPlan({ minutes: Number(url.searchParams.get('minutes')) || 10 }), tonight: tonightCompletion(attempts), episodes: [], supportedConcepts: [], pathwayState: 'blocked_content', recordState: 'ready', ordinaryAttemptCount: state === 'empty' ? 0 : 3 });
    }
    if (url.pathname === '/api/recovery/replay') return json({ chapters: state === 'empty' ? [] : [{ chapter: 'Partnership Fundamentals', state: fixture.get('replay') === 'ready' ? 'available' : 'unavailable', href: '/test?subject=accountancy&mode=quick&count=5&chapter=Partnership+Fundamentals&recoveryFrom=fixture-attempt' }], state: 'ready' });
    if (url.pathname === '/api/ai/credits') {
      // ?wallet=down simulates a missing schema; otherwise a paused wallet with stored balances.
      const page = new URLSearchParams(window.location.search);
      const wallet = page.get('wallet') === 'down' ? unreadableWallet('schema_unavailable')
        : projectWallet({ included_monthly_credits: 50, included_credits_used: 12 + replyReceipts.size, bonus_credits: 30, period_start: walletWindow().periodStart, reset_at: walletWindow().resetAt }, { paid: page.get('plan') === 'pro', includedMonthlyCredits: 50, paidAiOpen: ['live', 'network', 'failure'].includes(page.get('ai')) });
      return json({ ok: true, state: wallet.state, message: wallet.message, wallet, practiceCredits: { balance: 40, label: 'Practice credits (Quick Practice and Full Mock)' } });
    }
    if (url.pathname === '/api/ai/mentor/history') return json({ ok: true, session: null, messages: [] });
    if (url.pathname === '/api/ai/mentor/local') return json({ ok: true, sessionId: 'preview-session' });
    if (url.pathname === '/api/ai/mentor/chat') {
      const body = JSON.parse(init.body || '{}');
      window.__previewChatRequests.push(body);
      if (body.replyKind === 'model' && ['live', 'network', 'failure'].includes(fixture.get('ai'))) {
        if (fixture.get('ai') === 'failure') return json({ ok:false, message:'Illustrative provider failure. Your reserved credit was restored.' }, 503);
        // Simulate a response lost AFTER commit; retry reads the same receipt, never charges again.
        if (!replyReceipts.has(body.requestId)) replyReceipts.set(body.requestId, { ok:true, runtimeState:'live', sessionId:'preview-session', response:{ reply:'Illustrative model guidance: separate partner capital adjustments from the goodwill entry, then explain each debit and credit before attempting a new question.', actions:[], charge:{ kind:'prepos_credit', amount:1 } } });
        if (fixture.get('ai') === 'network' && !lostReply) { lostReply = true; return Promise.reject(new TypeError('Illustrative response lost after commit')); }
        return json(replyReceipts.get(body.requestId));
      }
      const next = learningPlan({ minutes: 10 }).primary;
      return json({ ok: true, runtimeState:'record', response: { reply: `Your record cannot answer that question yet. ${next.title}. ${next.reason}`, actions: [{ label: next.title, type: 'navigate', route: next.href }] } });
    }
    // Mistake Repair fixtures. Illustrative text, no model call, no credit.
    if (url.pathname === '/api/recovery/repair' && method === 'POST') {
      const kind = fixture.get('repair') || 'explained';
      const base = { practiceHref: '/test?subject=accountancy&mode=quick&count=5&chapter=Partnership+Fundamentals&recoveryFrom=fixture-attempt', chosenIndex: 0, keyIndex: 2 };
      if (kind === 'held') return json({ ok: true, status: 'held_for_recheck', charged: 0, ...base, dispute: { ourIndex: 1, secondIndex: 1 }, message: 'Our check of this question didn’t match its answer key, so we’ve held it for review instead of explaining it. You weren’t charged, and it won’t appear in practice until it’s cleared.' });
      if (kind === 'unexplained') return json({ ok: true, status: 'not_explained', charged: 0, ...base, message: 'Illustrative: no explanation was prepared. Review the recorded answer or try another question.' });
      if (kind === 'malformed') return json({ ok: true, status: 'unexpected' });
      if (kind === 'released') return json({ ok: false, error: 'operation_released', message: 'Illustrative: that request was released. Nothing was charged. Try again.' }, 409);
      if (kind === 'pending') return json({ ok: false, error: 'in_progress', message: 'Illustrative: this repair is still being prepared. Nothing extra is charged.' }, 409);
      if (kind === 'insufficient') return json({ ok: false, error: 'insufficient_ai_credits', balance: 0, message: 'Mistake Repair uses 1 PrepOS credit and you have 0 left this month. The stored explanation and fresh practice are still free.' }, 402);
      if (kind === 'fail') return json({ ok: false, error: 'unusable_output', charged: 0, message: 'The repair could not be prepared reliably this time. You were not charged.' }, 502);
      return json({ ok: true, status: kind === 'stored' ? 'stored' : 'explained', charged: kind === 'stored' ? 0 : 1, wallet: { total: 67, state: 'available' }, ...base, repair: {
        why_tempting: 'Illustrative: the old ratio is the first ratio you see, and it is right in the most common textbook case, so it feels safe.',
        why_wrong: 'Illustrative: here a new ratio is stated, so each partner gave up a different share. The old ratio would make both sacrifice in 3:2.',
        key_idea: 'Illustrative: sacrifice = old share − new share, worked out for each partner. Use the old ratio only when the incoming share is taken in that ratio.',
        next_step: 'Illustrative: redo this question by writing each partner’s old and new share over 10, then subtract.',
        model: 'fixture', generatedAt: new Date().toISOString() } });
    }
    if (url.pathname === '/api/questions/mine') return json(state === 'empty' ? [] : fixtureUploads());
    if (url.pathname === '/api/questions/pending') return json(state === 'empty' ? [] : fixtureUploads().filter((question) => question.status === 'pending_moderation'));
    if (url.pathname === '/api/learning/summary') return json(state === 'empty' ? null : { solvedTotal: 7 });
    if (url.pathname.startsWith('/api/auth/')) return json({ user: null }, 200);
    if (url.pathname.startsWith('/api/questions/') && url.pathname.endsWith('/vote')) return json({ score: 0, userVote: 0 });
    // Unhandled fixture writes are blocked, including billing and model endpoints.
    if (method !== 'GET') return json({ error: 'Preview only: this action is not available.' }, 418);
    return json({ error: 'Fixture endpoint not supplied.' }, 503);
  };
}

function PreviewInner({ candidatePathway }) {
  const params = useSearchParams();
  // Layout effects run before any child's passive effect, so the stub has the pathway before the plan is requested.
  const recoveryFixture = params.get('recovery') === 'candidate';
  useLayoutEffect(() => { window.__previewPathway = recoveryFixture ? candidatePathway : null; }, [recoveryFixture, candidatePathway]);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const pro = params.get('plan') === 'pro';
  const views = ['dashboard', 'test', 'prepos', 'compass', 'radar', 'saved', 'today', 'review', 'progress', 'recovery', 'explore', 'ranks', 'profile', 'upload', 'my-uploads', 'result', 'rival', 'onboarding', ...(params.get('role') === 'moderator' ? ['moderation'] : [])];
  const view = views.includes(params.get('view')) ? params.get('view') : 'dashboard';
  const routeNames = { prepos: 'mentor', compass: 'admission-compass', radar: 'analytics', ranks: 'leaderboard' };
  const route = `/${routeNames[view] || view}`;
  const previewHref = (name) => `/preview/arena?${new URLSearchParams({ view: name, plan: params.get('plan') || 'free', data: params.get('data') || 'ready', ...(params.get('role') === 'moderator' ? { role: 'moderator' } : {}), ...(params.get('recovery') ? { recovery: params.get('recovery') } : {}) })}`;
  const previewLinks = Object.fromEntries(views.map((name) => [routeNames[name] || name, previewHref(name)]));
  const auth = useMemo(() => ({
    user: { id: 'preview-user', name: params.get('data') === 'long' ? 'An exceptionally long illustrative display name for responsive checks' : 'Preview Student', email: 'preview@example.test', role: params.get('role') === 'moderator' ? 'moderator' : 'student',
      subjects: ['accountancy', 'economics', 'business_studies', 'english', ...(params.get('stale') === '1' ? ['hindi', 'teaching_aptitude'] : [])],
      isPremium: pro, premiumUntil: pro ? '2027-07-31T18:29:59.000Z' : params.get('plan') === 'expired' ? '2026-09-01T18:29:59.000Z' : null, creditBalance: pro ? 0 : 40 },
    status: 'authenticated', needsOnboarding: false, isAuthenticated: true,
    signInWithGoogle: async () => ({}), signInWithEmail: async () => ({}), verifyEmailOtp: async () => ({}),
    signOut: async () => {}, refreshSession: async () => {},
  }), [pro, params]);
  return (
    <AuthContext.Provider value={auth}>
      <RoleProvider>
        <div className="arena-fixture-note" role="note"><b>Development preview</b><span>Illustrative data · {params.get('plan') || 'free'} · {params.get('data') || 'ready'}. No real saves, scores, credits or billing.</span><label>View<select value={view} onChange={(event) => { window.location.href = previewHref(event.target.value); }}>{views.map((name) => <option key={name} value={name}>{name}</option>)}</select></label>{view === 'test' && <ThemeToggle />}{view === 'prepos' && <button type="button" className="arena-chip" onClick={() => setDrawerOpen(true)}>Preview assistant drawer</button>}</div><AssistantDrawer open={drawerOpen} onClose={() => setDrawerOpen(false)} />
        {view === 'onboarding' ? <OnboardingPageClient preview /> : <AppLayoutClient previewRoute={route} previewLinks={previewLinks}>{view === 'test' ? <TestPageClient /> : view === 'prepos' ? <MockMobAIHub variant="page" initialTab={params.get('tab') || 'plan'} /> : view === 'compass' ? <AdmissionCompassPageClient /> : view === 'radar' ? <AnalyticsPageClient /> : view === 'saved' ? <SavedPageClient /> : view === 'today' ? <TodayPage /> : view === 'recovery' ? <RecoveryJourney /> : view === 'review' ? <div className="student-page student-page--review"><RecoveryOverview view="review" /></div> : view === 'progress' ? <div className="student-page student-page--progress"><RecoveryOverview view="progress" /></div> : view === 'explore' ? <DiscoveryFeed /> : view === 'upload' ? <UploadForm /> : view === 'my-uploads' ? <MyUploadsPageClient /> : view === 'profile' ? <ProfilePageClient /> : view === 'ranks' ? <LeaderboardPageClient /> : view === 'result' ? <ResultPageClient previewId="fixture-attempt" /> : view === 'moderation' ? <ModerationPageClient /> : view === 'rival' ? <AIRivalArena /> : view === 'onboarding' ? <OnboardingPageClient preview /> : <DashboardPageClient />}</AppLayoutClient>}
      </RoleProvider>
    </AuthContext.Provider>
  );
}

export default function ArenaPreviewClient({ candidatePathway = null }) {
  return <Suspense fallback={null}><PreviewInner candidatePathway={candidatePathway} /></Suspense>;
}
