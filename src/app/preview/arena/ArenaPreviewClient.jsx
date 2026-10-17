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
import { CURRENT_OFFER } from '@/../data/capabilities';
import creditsContract from '@/../data/tests/fixtures/credits/contract_credits_v1.json';
import { learningPlan, createEpisode, advanceEpisode, publicEpisode } from '@/../data/learning_engine';
import { studyMilestones, tonightMetadata, tonightCompletion } from '@/../data/study_progress';
import { previewAnalytics, previewCompass, previewInsights } from './previewRecord';
import { computeRhythm } from '@/lib/server/rhythm';
import { standingFor } from '@/lib/server/standing';
import { previewStudyRecord } from './previewStudy';
import { buildStudyRecord } from '@/lib/studyBadges';
import { projectWallet, unreadableWallet, walletWindow } from '@/services/credits/aiWalletState';
import MockMobAIHub from '@/components/ai/MockMobAIHub';
import AssistantDrawer from '@/components/ai/AssistantDrawer';
import AdmissionCompassPageClient from '@/app/(app)/admission-compass/AdmissionCompassPageClient';
import AnalyticsPageClient from '@/app/(app)/analytics/AnalyticsPageClient';
import SavedPageClient from '@/app/(app)/saved/SavedPageClient';
import TodayPage from '@/app/(app)/today/page';
import ProgressPage from '@/app/(app)/progress/page';
import RecoveryOverview from '@/components/RecoveryOverview';
import RecoveryJourney from '@/app/(app)/recovery/page';
import { DiscoveryFeed } from '@/components/feed/DiscoveryFeed';
import { UploadForm } from '@/components/feed/UploadForm';
import MyUploadsPageClient from '@/app/(app)/my-uploads/MyUploadsPageClient';
import ProfilePageClient from '@/app/(app)/profile/ProfilePageClient';
import HelpPageClient from '@/app/(app)/help/HelpPageClient';
import LeaderboardPageClient from '@/app/(app)/leaderboard/LeaderboardPageClient';
import ResultPageClient from '@/app/(app)/result/[id]/ResultPageClient';
import AIRivalArena from '@/components/ai/AIRivalArena';
import OnboardingPageClient from '@/app/onboarding/OnboardingPageClient';
import ModerationPageClient from '@/app/(app)/moderation/ModerationPageClient';
import { FIXTURE_SUBJECTS, SYLLABUS_SUBJECTS, fixtureFeed, fixtureChapters, syllabusChapters, fixtureUploads, fixtureAttempt } from './previewFixtures';
import { CIRCULAR_QUEUE_CORRECTION, answerReview } from '@/../data/answer_corrections.mjs';
import { fixtureMock, fixtureReplayMock, fixtureRepairV3, fixtureLabLoop, fixtureAcross, fixtureRuleBook, FIXTURE_PLAYBOOK, fixtureSlice4, fixtureTrapsMeet, fixtureRevise, fixtureReviseAnswer, fixtureResultPaper, RESULT_PAPER_NAMES } from './previewMock';
import { fixtureCheckField, fixtureCheckGet, fixtureCheckPost, fixtureAskContext, freshCheckMemory } from './previewRepairCheck';
import RuleBook from '@/components/rules/RuleBook';
import ReviseRun from '@/components/revise/ReviseRun';
import { choosableRule, startSheetLines, bookRules } from '@/../data/rule_book';
import { withActiveRule } from '@/components/result/labLoop';
import MobPage from '@/components/mob/MobPage';
import JoinMob from '@/components/mob/JoinMob';
import { previewMob } from './previewMob';

// Original illustrative questions (the homepage sample set), never real bank rows.
const SAMPLE = [
  ['Partnership Fundamentals', 'Goodwill brought in by an incoming partner is shared by old partners in:', ['New ratio', 'Old ratio', 'Sacrificing ratio', 'Equal ratio']],
  ['Partnership Fundamentals', 'Assets are ₹80,000 and liabilities are ₹30,000. What is the owner’s equity?', ['₹30,000', '₹50,000', '₹80,000', '₹1,10,000']],
  ['Money and Banking', 'Which of these is NOT a function of the Reserve Bank of India?', ['Banker to the government', 'Issuing currency', 'Accepting public deposits', 'Controlling credit']],
  ['Controlling', 'Comparing actual performance with a planned standard is part of which management function?', ['Staffing', 'Controlling', 'Organising', 'Directing']],
  ['Vocabulary', 'Choose the option nearest in meaning to CANDID:', ['Hidden', 'Frank', 'Careful', 'Sweet']],
];

// Illustrative Rival benchmark for ?view=rival&battle=win|loss|tie: the sample questions, a labelled
// practice rival and a result in the shape /api/ai/rival/submit returns. Never real scores.
const RIVAL_FIXTURE_PROFILE = { name: 'North Campus Rival', archetype: 'Steady benchmark', description: 'A simulated benchmark that answers at a steady pace.' };
function rivalFixtureBattle() {
  const questions = SAMPLE.map(([chapter, question, options], i) => ({ id: `preview-rival-q${i + 1}`, subject: 'accountancy', chapter, question, options, difficulty: 'medium' }));
  return { ok: true, battle: { id: 'preview-battle', rivalType: 'NORTH_CAMPUS_RIVAL', profile: RIVAL_FIXTURE_PROFILE, subjects: ['accountancy'], questions, questionCount: questions.length, timeLimitMinutes: 10, rivalBenchmark: { score: 30, accuracy: 60, totalTimeSeconds: 240 }, requiresCredits: false, creditCost: 0, charge: null, createdAt: new Date().toISOString() }, usageSnapshot: {} };
}
function rivalFixtureResult(kind) {
  const user = kind === 'win' ? { score: 40, accuracy: 100, correct: 4, answered: 4, total: 5, totalTimeSeconds: 196 }
    : kind === 'tie' ? { score: 30, accuracy: 60, correct: 3, answered: 5, total: 5, totalTimeSeconds: 240 }
      : { score: 20, accuracy: 50, correct: 2, answered: 4, total: 5, totalTimeSeconds: 288 };
  const result = kind;
  const headline = kind === 'win' ? 'Benchmark cleared' : kind === 'tie' ? 'Dead heat' : 'Benchmark leak found';
  return {
    ok: true, result, user, rival: { score: 30, accuracy: 60, totalTimeSeconds: 240, profile: RIVAL_FIXTURE_PROFILE }, rivalType: 'NORTH_CAMPUS_RIVAL',
    shareCard: { headline, score: user.score, rivalScore: 30, rankTitle: 'Practice benchmark', accuracy: user.accuracy },
    nextMoveHint: kind === 'loss' ? 'Your pace slipped on the last two questions. Retry with five questions and aim for 50 seconds each.' : 'Retry with ten questions to see if the pace holds.',
    outro: { summary: kind === 'win' ? `You beat ${RIVAL_FIXTURE_PROFILE.name} ${user.score}-30.` : kind === 'tie' ? `Level at ${user.score}-30, and the same time.` : `You lost ${user.score}-30.` },
  };
}

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
    if (url.pathname === '/api/mob' || url.pathname.startsWith('/api/mob/')) return previewMob(url, method, init, fixture, json);
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
    const syllabus = fixture.get('chapters') === 'syllabus';
    if (url.pathname === '/api/subjects') return state === 'subject-error' ? json({ error: 'Fixture subject failure' }, 503) : json(syllabus ? SYLLABUS_SUBJECTS : FIXTURE_SUBJECTS);
    if (url.pathname === '/api/chapters') return state === 'chapter-error' ? json({ error: 'Fixture chapter failure' }, 503) : json(syllabus ? syllabusChapters(url.searchParams.get('subject')) : fixtureChapters(url.searchParams.get('subject')));
    if (url.pathname === '/api/questions/feed') {
      const limit = Number(url.searchParams.get('limit')) || 12;
      const offset = Number(url.searchParams.get('offset')) || 0;
      const rows = state === 'empty' ? [] : fixtureFeed(url.searchParams.get('subject'), state === 'long').filter((question) => (!url.searchParams.get('chapter') || question.chapter === url.searchParams.get('chapter')) && (!url.searchParams.get('difficulty') || question.difficulty === url.searchParams.get('difficulty')));
      const raw = rows.slice(offset, offset + limit);
      return json({ questions: state === 'held' && offset === 0 ? [] : raw, total: null, nextOffset: offset + raw.length, hasMore: raw.length === limit });
    }
    // Your standing: the one shape the server returns, only for the signed-in student. ?state=empty is a student with no mocks; ?state=long is a big board.
    // Your standing: the real reducer over an illustrative, anonymous board (no names), so the ladder and spread are the
    // server's own shapes. ?data=long is a big board; ?data=sparse a board of 6 (no ladder or spread, as on a small board).
    if (url.pathname === '/api/leaderboard') {
      if (state === 'empty') return json({ you: null, window: 'all time' });
      const size = state === 'long' ? 12408 : state === 'sparse' ? 6 : 212;
      // Averages run from about 90 down to 20 per mock; mock counts vary, so totals (the ranking) do too.
      const rows = Array.from({ length: size }, (_, i) => { const tests = 6 + ((i * 7) % 11); return { userId: `fx${i}`, tests, totalScore: Math.round(tests * (90 - (i / size) * 70)) }; });
      rows.push({ userId: 'preview-user', tests: 12, totalScore: 12 * (state === 'long' ? 71 : 62) });
      return json(standingFor(rows, 'preview-user'));
    }
    // Recent papers (the paper trend on Review, Today's Last paper and its move). Newest first; ?trend=few has too few to
    // draw; ?data=empty has none; ?data=sparse has one; ?data=returning's newest is 9 days old.
    if (url.pathname === '/api/attempts/summary') {
      if (state === 'empty') return json({ items: [], nextCursor: null });
      const marks = state === 'sparse' ? [92] : fixture.get('trend') === 'few' ? [92, 88] : [76, 84, 80, 96, 104, 118];
      const away = state === 'returning' ? 8 * 86400000 : 0;
      const items = marks.map((m, i) => ({ id: `fxp${i}`, subject: 'accountancy', mode: 'full', correct: Math.round((m + 4) / 5.2), wrong: state === 'returning' && i === marks.length - 1 ? 6 : 4, unattempted: 0, total: 50, marks: m, maxMarks: 250, completedAt: Date.now() - away - (marks.length - i) * 3 * 86400000, formatId: 'full:accountancy:q50:server_snapshot_v1' })).reverse();
      return json({ items, nextCursor: null });
    }
    // Today's road on the account (GET and PUT /api/me/road). ?road=set has a date and a target; ?road=off is before the
    // migration (onAccount false); ?road=down fails the read; &save=fail refuses the next save. Kept in memory for this tab.
    if (url.pathname === '/api/me/road') {
      const kind = fixture.get('road') || 'on';
      if (kind === 'down') return json({ error: 'unavailable' }, 503);
      if (!window.__previewRoad) window.__previewRoad = kind === 'off' ? { onAccount: false, examDate: null, mockTarget: null } : kind === 'set' ? { onAccount: true, examDate: '2027-05-08', mockTarget: 14 } : { onAccount: true, examDate: null, mockTarget: null };
      if (method === 'PUT') {
        if (!window.__previewRoad.onAccount) return json({ error: 'road_not_on_account', message: 'Your road is kept on this device for now.' }, 409);
        if (fixture.get('save') === 'fail') return new Promise((resolve) => setTimeout(() => resolve(json({ error: 'unavailable', message: 'Your road could not be saved. Try again.' }, 503)), 450));
        const body = JSON.parse(init.body || '{}');
        window.__previewRoad = { ...window.__previewRoad, ...('examDate' in body ? { examDate: body.examDate } : {}), ...('mockTarget' in body ? { mockTarget: body.mockTarget } : {}) };
        return new Promise((resolve) => setTimeout(() => resolve(json(window.__previewRoad)), 450));
      }
      return json(window.__previewRoad);
    }
    // Repairs per paper (GET /api/me/repair-record). ?repaired=all has every mistake of the newest paper repaired;
    // ?repaired=week has three repairs made today on two older papers (Today's weekly receipt).
    if (url.pathname === '/api/me/repair-record' && method === 'GET') {
      const kind = fixture.get('repaired');
      const row = (attemptId, k) => ({ attemptId, questionId: `q${k}`, chapter: 'Partnership Fundamentals', subject: 'accountancy', foundAt: null, repairedAt: new Date().toISOString(), checkedState: 'pending', retriedAt: null });
      if (kind === 'week') return json({ repairs: [row('fxp4', 0), row('fxp4', 1), row('fxp3', 2)] });
      return json({ repairs: kind === 'all' ? [0, 1, 2, 3].map((k) => row('fxp5', k)) : [] });
    }
    if (url.pathname.startsWith('/api/attempts/')) {
      if (state === 'empty') return json({ error: 'No fixture attempt' }, 404);
      // ?mock=full|nta serves a scored mock with the real SWOT, record lines and Mistake Lab (previewMock.js); ?checks=unavailable
      // leaves the answer-key check unread so the panels show their pending state; ?lab=basic|off shows the basic ledger or the
      // page without the Lab. Without ?mock the paper is the 10-question quick practice.
      const mock = fixture.get('mock');
      // mock=full with the Lab on shows the Replay from its contract (&paper=time_up|nta|bst|english for the others;
      // &paper=v1 for the slice 1 paper).
      // Slice 5: &cohort=time shows the nightly table's time, changes and strike lines and the ledger finding, every gate met;
      // &cohort=time-gated is one short of each gate, so none of them shows (previewMock.js fixtureCohortTime).
      // Slice 3 parts on the Full mock's lab (previewMock.js fixtureLabLoop): &across=, &rulecheck=, &order=paper.
      // Slice 4 (fixtureSlice4): the trap tag under three wrong options and Same mistakes later in Prove; &traps=off leaves them out.
      // &lab=older leaves the rule check as not checked (the older-paper line).
      const loop = (built) => (mock === 'full' ? fixtureSlice4({ lab: fixtureLabLoop({ lab: built.lab, attempt: built.attempt, answerReviews: built.answerReviews, across: fixture.get('across') || 'ready', ruleCheck: fixture.get('rulecheck') || (fixture.get('lab') === 'older' ? 'not_checked' : 'kept'), order: fixture.get('order') || 'cohort' }), attempt: built.attempt, answerReviews: built.answerReviews, traps: fixture.get('traps') || 'on' }) : built.lab);
      // The 17 Oct result papers (RESULT-1017 section 5): &paper=weak|avg|strong|perfect|blank|practice5, with &held=1 (a key
      // under re-check), &return=1 (the first mistake already repaired: it opens free, never offered as paid) and &return=all
      // (every mistake repaired). &wallet=zero is a known balance of 0 AI credits.
      if (RESULT_PAPER_NAMES.includes(fixture.get('paper'))) {
        const built = fixtureResultPaper(fixture.get('paper'), { held: fixture.get('held') === '1', repaired: fixture.get('return') === 'all' ? 'all' : fixture.get('return') === '1' });
        return json({ ...built.attempt, answerReviews: built.answerReviews, swot: built.swot, mistakeInsights: built.mistakeInsights, lab: built.lab, missedBefore: {}, answerReviewState: built.answerReviewState });
      }
      if (mock === 'full' && fixture.get('paper') !== 'v1' && (fixture.get('checks') || 'ready') === 'ready' && (fixture.get('lab') || 'on') === 'on') {
        return fixtureReplayMock(fixture.get('paper') || 'full', { cohortTime: fixture.get('cohort'), marks: fixture.get('marks') }).then((built) => json({ ...built.attempt, answerReviews: built.answerReviews, swot: built.swot, mistakeInsights: built.mistakeInsights, lab: loop(built), missedBefore: {}, answerReviewState: built.answerReviewState }));
      }
      if (mock === 'full' || mock === 'nta') {
        const built = fixtureMock(mock, { checks: fixture.get('checks') || 'ready', lab: fixture.get('lab') || 'on' });
        return json({ ...built.attempt, answerReviews: built.answerReviews, swot: built.swot, mistakeInsights: built.mistakeInsights, lab: loop(built), missedBefore: {}, answerReviewState: built.answerReviewState });
      }
      const attempt = fixtureAttempt(); const kind = fixture.get('repair');
      // &mobpaper=1: the attempt was this week's Mob paper, so the result shows the Mob row (pair with &mob=two|ready).
      if (fixture.get('mobpaper') === '1') attempt.selectionMeta = { ...(attempt.selectionMeta || {}), mobPaper: { mobId: 'preview-mob', weekStart: '2026-10-12' } };
      if (['corrected', 'key-unverified', 'held'].includes(kind)) {
        const receipt = CIRCULAR_QUEUE_CORRECTION;
        const qid = attempt.questionsSnapshot[1].id;
        attempt.questionsSnapshot[1] = { ...attempt.questionsSnapshot[1], question: receipt.body, options: receipt.options, correctIndex: 0 };
        attempt.details[1].givenIndex = 1;
        const snapshot = { ...attempt.questionsSnapshot[1], id: receipt.questionId };
        const current = { ...receipt, id: receipt.questionId, status: 'live', verification_state: 'verified' };
        const review = answerReview(snapshot, current, { givenIndex: 1 });
        attempt.answerReviews = { [qid]: kind === 'held' ? { state: 'under_review', originalIndex: 0 } : kind === 'key-unverified' ? { state: 'key_changed_unverified', originalIndex: 0, currentIndex: 3 } : review };
      }
      // Fixture only: two questions already missed in an earlier labelled paper, so the earlier-miss line and the Missed twice tag can be seen here.
      const missedBefore = { 'fixture-q2': [{ attemptId: 'fixture-earlier', source: 'Mock 2', completedAt: Date.parse('2026-09-28T18:00:00.000Z') }], 'fixture-q4': [{ attemptId: 'fixture-earlier', source: 'Mock 2', completedAt: Date.parse('2026-09-28T18:00:00.000Z') }] };
      // F17 fixtures: the paper's name and attempt time always; &saved=1 makes it Mock 3 and gives two of its wrong answers a saved repair
      // (pair with &repair=v3-stored, the free reopen), so Review can be seen with repairs that are not lost and never offered again.
      const saved = fixture.get('saved') === '1';
      const paper = { source: saved ? 'Mock 3' : 'Quick practice', completedAt: Date.parse(attempt.completedAt) };
      const savedRepairs = saved ? { 'fixture-q2': { repairedAt: '2026-10-04T18:22:00.000Z' }, 'fixture-q4': { repairedAt: '2026-10-04T18:31:00.000Z' } } : undefined;
      return json({ ...attempt, missedBefore, paper, ...(savedRepairs ? { savedRepairs } : {}), answerReviewState: 'ready' });
    }
    if (url.pathname.startsWith('/api/users/') && method === 'PATCH') return state === 'save-error' ? json({ error: 'Fixture profile save failure' }, 503) : json({ ok: true });
    if (url.pathname === '/api/bookmarks' && method === 'POST') return state === 'save-error' ? json({ error: 'Save limit', limit: 25 }, 402) : json({ saved: JSON.parse(init.body || '{}').saved });
    if (url.pathname.startsWith('/api/questions/') && url.pathname.endsWith('/interact')) return json({ ok: true });
    if (url.pathname.startsWith('/api/questions/') && url.pathname.endsWith('/vote')) return state === 'vote-error' ? json({ error: 'Fixture vote failure' }, 503) : json({ score: 1, userVote: JSON.parse(init.body || '{}').vote_type });
    if (url.pathname === '/api/questions/upload') return json({ error: 'Preview only: no question was submitted. Your draft is still here.' }, 418);
    if (url.pathname === '/api/ai/usage') return json({ ok: true, isPaid: fixture.get('plan') === 'pro', freeRivalUsedToday: false, aiWallet: unreadableWallet('paid_ai_paused') });
    // ?view=rival&battle=win|loss|tie plays an illustrative benchmark end to end so the result reveal can be seen; nothing is scored or charged.
    if (url.pathname === '/api/ai/rival/start' && ['win', 'loss', 'tie'].includes(fixture.get('battle'))) return json(rivalFixtureBattle());
    if (url.pathname === '/api/ai/rival/submit' && ['win', 'loss', 'tie'].includes(fixture.get('battle'))) return json(rivalFixtureResult(fixture.get('battle')));
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
      // The live route adds publicOffer(); the preview cannot read the plan env, so ?offer=monthly picks the monthly offer.
      const monthlyOffer = page.get('offer') === 'monthly';
      const offer = {
        monthly: { planId: 'pro_monthly_99', rupees: 99, interval: 'month', autoRenews: true, ready: monthlyOffer },
        oneTime: { planId: CURRENT_OFFER.planId, rupees: CURRENT_OFFER.rupees, expires: CURRENT_OFFER.expires, onSale: !monthlyOffer },
        purchasable: monthlyOffer ? 'monthly' : 'one_time',
      };
      return json({ ...buildPracticeQuote({
        user: { id: 'preview-user', isPremium: pro, premiumUntil: pro ? '2027-07-31T18:29:59.000Z' : null, creditBalance: pro ? 0 : 40 },
        subject: url.searchParams.get('subject'), mode: url.searchParams.get('mode'), count: Number(url.searchParams.get('count')),
        inventory, allowance: { enabled: page.get('allowance') === 'on', used: false }, token: `preview-${Date.now()}`,
      }), offer });
    }
    if (url.pathname === '/api/me/credits') {
      // Account > Credits from the shared contract fixture (data/tests/fixtures/credits/contract_credits_v1.json);
      // ?credits=down shows the failed state. Pro and monthly Pro read as Pro with their paid-through date.
      const page = new URLSearchParams(window.location.search);
      if (page.get('credits') === 'down') return json({ error: 'unavailable', message: 'Your credits did not load.' }, 503);
      const profile = MONTHLY_PROFILES[page.get('plan')] || null;
      const paid = page.get('plan') === 'pro' || Boolean(profile?.isPremium);
      const until = page.get('plan') === 'pro' ? '2027-07-31' : profile?.isPremium ? '2026-11-16' : null;
      // The AI balance is the same wallet the top bar and Ask Mobi read, so the page never shows two numbers for one pool.
      const ai = projectWallet({ included_monthly_credits: 50, included_credits_used: 12 + replyReceipts.size, bonus_credits: 30, period_start: walletWindow().periodStart, reset_at: walletWindow().resetAt }, { paid, includedMonthlyCredits: 50, paidAiOpen: true });
      return json({ ...creditsContract, ai: { ...creditsContract.ai, balance: ai.known ? ai.total : creditsContract.ai.balance }, plan: { name: paid ? 'Pro' : 'Free', until } });
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
      return json(previewAnalytics());
    }
    // The Rule book and Across your mocks (GET /api/me/rules), the rule for the next mock (GET and POST /api/me/playbook).
    // ?rules=few|new|down for the other states; &save=fail refuses the next choice; &across= as on the result page.
    // A choice is kept in memory for this tab only (window.__previewRule), after a short wait so the saving state shows.
    // The facts behind the first-timed-mock line (GET /api/me/timed-mock). ?timed=none (default, sessions and no timed mock),
    // has (a timed mock with a readable clock: the line is gone), older (a mock saved without a clock record), down (unreadable).
    // ?data=empty is a student with no saved session.
    if (url.pathname === '/api/me/timed-mock' && method === 'GET') {
      const kind = fixture.get('timed') || 'none';
      if (kind === 'down') return json({ error: 'unavailable' }, 503);
      const sessions = state === 'empty' ? 0 : state === 'sparse' ? 1 : 6;
      return json({ sessions, mocks: kind === 'has' || kind === 'older' ? 2 : 0, timedMocks: kind === 'has' ? 2 : 0, subject: state === 'empty' ? null : 'accountancy' });
    }
    if (url.pathname === '/api/me/rules' && method === 'GET') {
      // ?data=empty is a student with no record: an empty rule book, not a failed read.
      const kind = state === 'empty' ? 'new' : fixture.get('rules') || 'ready';
      if (kind === 'down') return json({ error: 'unavailable', message: 'Your rules could not be loaded. Try again shortly.' }, 503);
      const book = fixtureRuleBook(kind);
      return json({ book: window.__previewRule ? withActiveRule(book, window.__previewRule) : book, acrossMocks: fixtureAcross(kind === 'new' ? 'none' : kind === 'few' ? 'below_gate' : fixture.get('across') || 'ready') });
    }
    if (url.pathname === '/api/me/playbook' && method === 'GET') {
      const kind = fixture.get('rules') || 'ready';
      if (kind === 'new') return json({ active: null, startSheet: null });
      const chosen = window.__previewRule;
      if (!chosen || chosen.id === FIXTURE_PLAYBOOK.active?.id) return json(chosen ? { ...FIXTURE_PLAYBOOK, active: chosen } : FIXTURE_PLAYBOOK);
      // Another rule chosen in this tab: its start sheet line over the illustrative record, as the server builds it.
      return import('@/../data/tests/fixtures/mistake_lab/across_mocks_input.json').then(({ default: input }) => {
        const found = bookRules(fixtureRuleBook(kind)).find((r) => r.id === chosen.id);
        return json({ active: chosen, startSheet: startSheetLines({ rule: { ...chosen, chapter: found?.chapter ?? null, subject: found?.subject ?? null }, attempts: input.attempts, subject: url.searchParams.get('subject') }) });
      });
    }
    if (url.pathname === '/api/me/playbook' && method === 'POST') {
      const body = JSON.parse(init.body || '{}');
      const rule = choosableRule(fixtureRuleBook(fixture.get('rules') || 'ready'), body.ruleId);
      const wait = (reply) => new Promise((resolve) => setTimeout(() => resolve(reply), 650));
      if (fixture.get('save') === 'fail') return wait(json({ error: 'unavailable', message: 'Your rules could not be loaded. Try again shortly.' }, 503));
      if (!rule) return wait(json({ error: 'invalid_request', message: 'That rule is not in your Rule book yet.' }, 422));
      window.__previewRule = { id: rule.id, kind: rule.kind, text: rule.text, since: new Date().toISOString() };
      return wait(json({ active: window.__previewRule }));
    }
    // My colleges (GET, PUT, POST, DELETE /api/me/colleges; ?colleges=ready|empty|full|down), kept in memory for the page's life.
    if (url.pathname === '/api/me/colleges') {
      const kind = fixture.get('colleges') || 'ready';
      if (kind === 'down') return json({ error: 'unavailable' }, 503);
      const seed = [
        ['Shri Ram College of Commerce', 'B.Com (Hons)'], ['Lady Shri Ram College for Women (W)', 'B.Com (Hons)'], ['Hansraj College', 'B.Com (Hons)'],
        ['Hindu College', 'B.Com (Hons)'], ['Kirori Mal College', 'B.Com (Hons)'], ['Sri Venkateswara College', 'B.Com (Hons)'],
        ['Ramjas College', 'B.Com (Hons)'], ['Daulat Ram College (W)', 'B.Com (Hons)'],
      ];
      if (!window.__previewColleges) {
        const n = kind === 'empty' || state === 'empty' ? 0 : kind === 'full' ? 8 : 5;
        window.__previewColleges = seed.slice(0, n).map(([college, programme]) => ({ college, programme, programmeId: 'b-com-hons' }));
      }
      const body = () => {
        const colleges = window.__previewColleges.slice(0, 8).map((c, i) => ({ ...c, position: i + 1, addedAt: null }));
        return { colleges, count: colleges.length, max: 8 };
      };
      const same = (a, b) => a.programmeId === b.programmeId && a.college === b.college;
      if (method === 'PUT') { window.__previewColleges = JSON.parse(init.body || '{}').colleges || []; return json(body()); }
      if (method === 'POST') {
        const entry = JSON.parse(init.body || '{}');
        if (window.__previewColleges.some((c) => same(c, entry))) return json({ ...body(), result: 'exists' });
        if (window.__previewColleges.length >= 8) return json({ error: 'list_full', message: 'My colleges is full. Remove one to add another.', ...body() }, 409);
        window.__previewColleges = [...window.__previewColleges, entry];
        return json({ ...body(), result: 'added' }, 201);
      }
      if (method === 'DELETE') {
        const q = url.searchParams;
        window.__previewColleges = window.__previewColleges.filter((c) => !same(c, { programmeId: q.get('programmeId'), college: q.get('college') }));
        return json(body());
      }
      return json(body());
    }
    // Traps you meet (GET /api/me/traps; ?traps=empty|down) and Revise (GET /api/me/revise; ?revise=empty|down, POST .../answer).
    if (url.pathname === '/api/me/traps' && method === 'GET') {
      const kind = fixture.get('traps') || 'ready';
      if (kind === 'down' || state === 'empty') return json({ error: 'unavailable', message: 'Your traps could not be loaded. Try again shortly.' }, 503);
      return json(fixtureTrapsMeet(kind === 'empty' ? 'empty' : 'ready'));
    }
    if (url.pathname === '/api/me/revise' && method === 'GET') {
      const kind = fixture.get('revise') || 'ready';
      if (kind === 'down' || state === 'empty') return json({ version: 1, state: 'unavailable', message: 'Revise is not available right now. Try again shortly.', items: [] }, 503);
      return json(fixtureRevise(kind === 'empty' ? 'empty' : 'ready'));
    }
    if (url.pathname === '/api/me/revise/answer' && method === 'POST') {
      const body = JSON.parse(init.body || '{}');
      const card = fixtureRevise('ready').items.find((i) => i.questionId === body.questionId);
      return new Promise((resolve) => setTimeout(() => resolve(json(fixtureReviseAnswer(body.choice, card?.box))), 450));
    }
    if (url.pathname === '/api/recovery' && method === 'GET') {
      const page = new URLSearchParams(window.location.search);
      if (page.get('record') === 'down') return json({ error: 'unavailable' }, 503);
      const empty = page.get('record') === 'empty' || state === 'empty';
      const ordinaryReview = empty ? [] : PREVIEW_ATTEMPTS.map((a) => ({ id: a.id, subject: a.subject, completedAt: a.completedAt, correct: a.correct, total: a.total, mistakes: a.total - a.correct, source: a.id === 'preview-a1' && page.get('saved') === '1' ? 'Mock 3' : 'Quick practice', repaired: a.id === 'preview-a1' && page.get('saved') === '1' ? 2 : 0 }));
      const milestones = empty ? [] : studyMilestones([{ id: 'preview-a1', completedAt: Date.now() - 1000, selectionMeta: { scoringVersion: 'server_practice_v1' } }], []);
      return json({ ordinaryReview, progress: [], milestones, playbook: empty ? [] : [{ id: 'pb1', strategy: 'two_pass', reflection: 'Do the sure questions first, then come back to the long ones.' }], reviewState: 'ready', note: 'Fresh delayed checks provide concept evidence, not a causal score gain.' });
    }
    if (url.pathname === '/api/bookmarks' && method === 'GET') return json({ questions: state === 'empty' ? [] : fixtureFeed('accountancy').slice(0, 2).map((q) => ({ ...q, saved: true })), questionIds: [], count: state === 'empty' ? 0 : 2 });
    if (url.pathname === '/api/learning/plan') {
      // ?record=down fails the plan read; ?record=empty or ?data=empty has no saved session.
      if (new URLSearchParams(window.location.search).get('record') === 'down') return json({ error: 'unavailable' }, 503);
      const noRecord = state === 'empty' || new URLSearchParams(window.location.search).get('record') === 'empty';
      const attempts = fixture.get('tonight') === 'done' ? [{ id: 'preview-a1', completedAt: Date.now() - 1000, selectionMeta: { scoringVersion: 'server_practice_v1', ...tonightMetadata({ tonightKey: 'preview-tonight-key', tonightMinutes: 30, mode: 'quick', count: 20 }) } }] : [];
      // ?move=resume: the move is bound to something other than the chosen subject (a recall session to finish), so the
      // Start sheet shows it above the subject rail (START-1017 D3).
      const plan = learningPlan({ minutes: Number(url.searchParams.get('minutes')) || 10, attempts: noRecord ? [] : PREVIEW_ATTEMPTS });
      if (fixture.get('move') === 'resume') plan.primary = { kind: 'resume_session', title: 'Finish your recall session', reason: '7 cards left from this afternoon. Recall is free and uses no credits.', href: '/review/revise' };
      return json({ ...plan, tonight: tonightCompletion(attempts), episodes: [], supportedConcepts: [], pathwayState: 'blocked_content', recordState: 'ready', ordinaryAttemptCount: noRecord ? 0 : 3 });
    }
    if (url.pathname === '/api/recovery/replay') return json({ chapters: state === 'empty' ? [] : [{ chapter: 'Partnership Fundamentals', state: fixture.get('replay') === 'ready' ? 'available' : 'unavailable', href: '/test?subject=accountancy&mode=quick&count=5&chapter=Partnership+Fundamentals&recoveryFrom=fixture-attempt' }], state: 'ready' });
    if (url.pathname === '/api/ai/credits') {
      // ?wallet=down simulates a missing schema; otherwise a paused wallet with stored balances.
      const page = new URLSearchParams(window.location.search);
      const wallet = page.get('wallet') === 'down' ? unreadableWallet('schema_unavailable')
        : page.get('wallet') === 'zero' ? projectWallet({ included_monthly_credits: 50, included_credits_used: 50, bonus_credits: 0, period_start: walletWindow().periodStart, reset_at: walletWindow().resetAt }, { paid: false, includedMonthlyCredits: 50, paidAiOpen: false })
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
    // The repair's check (a fresh question on the same idea) and the Ask Mobi hand-off. ?check= picks the state (previewRepairCheck.js).
    // This tab remembers the first answer, like the server does, so a reload of a repair shows the stored answer.
    if (url.pathname === '/api/recovery/check') {
      const mode = fixture.get('check') || 'ready';
      const memory = (window.__previewCheck ||= freshCheckMemory());
      const later = (reply, ms) => new Promise((resolve) => setTimeout(() => resolve(reply), ms));
      if (method === 'GET') {
        const got = fixtureCheckGet(mode, memory);
        memory.reads += 1;
        return later(new Response(JSON.stringify(got.body), { status: got.http, headers: { 'Content-Type': 'application/json' } }), got.delay || 25);
      }
      const posted = fixtureCheckPost(mode, JSON.parse(init.body || '{}'), memory);
      Object.assign(memory, posted.remember || {});
      if (posted.lost) return new Promise((resolve, reject) => setTimeout(() => reject(new TypeError('Illustrative: the connection dropped before the answer was marked')), 400));
      return later(new Response(JSON.stringify(posted.body), { status: posted.http, headers: { 'Content-Type': 'application/json' } }), posted.delay || 25);
    }
    if (url.pathname === '/api/recovery/ask-context') return json(fixtureAskContext());
    // Mistake Repair fixtures. Illustrative text, no model call, no credit.
    if (url.pathname === '/api/recovery/repair' && method === 'POST') {
      const kind = fixture.get('repair') === '1' ? 'v3' : fixture.get('repair') || 'explained';
      // ?repair=v3 (or repair=1) is a version 3 repair (trap, why the key is right, other options, rule with hook, another way, pattern) with its check; v3-stored is its free reopen.
      if (kind === 'v3' || kind === 'v3-stored') {
        const check = fixtureCheckField(fixture.get('check') || 'ready');
        return json({ ...fixtureRepairV3({ stored: kind === 'v3-stored' }), ...(check ? { check } : {}) });
      }
      const base = { practiceHref: '/test?subject=accountancy&mode=quick&count=5&chapter=Partnership+Fundamentals&recoveryFrom=fixture-attempt', chosenIndex: 0, keyIndex: 2 };
      if (kind === 'held') return json({ ok: true, status: 'held_for_recheck', charged: 0, ...base, dispute: { ourIndex: 1, secondIndex: 1 }, message: 'Our check of this question didn’t match its answer key, so we’ve held it for review instead of explaining it. You weren’t charged, and it won’t appear in practice until it’s cleared.' });
      if (kind === 'unexplained') return json({ ok: true, status: 'not_explained', charged: 0, ...base, message: 'Illustrative: no explanation was prepared. Review the recorded answer or try another question.' });
      if (kind === 'malformed') return json({ ok: true, status: 'unexpected' });
      if (kind === 'released') return json({ ok: false, error: 'operation_released', message: 'Illustrative: that request was released. Nothing was charged. Try again.' }, 409);
      if (kind === 'pending') return json({ ok: false, error: 'in_progress', message: 'Illustrative: this repair is still being prepared. Nothing extra is charged.' }, 409);
      if (kind === 'insufficient') return json({ ok: false, error: 'insufficient_ai_credits', balance: 0, message: 'This repair uses 1 AI credit. You have 0. The stored explanation and fresh practice are still free.' }, 402);
      if (kind === 'fail') return json({ ok: false, error: 'unusable_output', charged: 0, message: 'The repair could not be prepared reliably this time. You were not charged.' }, 502);
      return json({ ok: true, status: kind === 'stored' ? 'stored' : 'explained', charged: kind === 'stored' ? 0 : 1, wallet: { total: 67, state: 'available' }, ...base, repair: {
        why_tempting: 'Illustrative: the old ratio is the first ratio you see, and it is right in the most common textbook case, so it feels safe.',
        why_wrong: 'Illustrative: here a new ratio is stated, so each partner gave up a different share. The old ratio would make both sacrifice in 3:2.',
        key_idea: 'Illustrative: sacrifice = old share − new share, worked out for each partner. Use the old ratio only when the incoming share is taken in that ratio.',
        next_step: 'Illustrative: redo this question by writing each partner’s old and new share over 10, then subtract.',
        model: 'fixture', generatedAt: new Date().toISOString() } });
    }
    // Study rhythm (Today and Progress). ?rhythm=met|fresh|returning; ?data=empty has no record.
    if (url.pathname === '/api/me/rhythm') {
      const kind = fixture.get('rhythm') || (state === 'returning' ? 'returning' : state === 'sparse' ? 'first' : 'some');
      const day = 86400000;
      const at = (back, hour = 12) => { const d = new Date(Date.now() - back * day); d.setHours(hour, 0, 0, 0); return d.getTime(); };
      let activities = [];
      if (state !== 'empty' && kind !== 'fresh') {
        const backs = kind === 'first' ? [0] : kind === 'returning' ? [9, 10, 11, 16, 17, 23, 24, 30, 31, 32, 38, 45] : kind === 'met' ? [0, 1, 2, 3, 8, 9, 10, 11, 15, 16, 17, 22, 23, 24, 29, 30, 36, 44, 51] : [0, 1, 3, 8, 9, 10, 12, 16, 17, 18, 24, 25, 31, 38, 45];
        activities = backs.map((back, i) => ({ id: `fx${i}`, at: at(back, back === 0 ? 0 : 9 + (i % 5)), kind: i % 4 === 3 ? 'repair' : 'session', answered: 12, fullMock: i === 9 }));
      }
      return json(computeRhythm({ activities, daysPerWeek: kind === 'met' ? 4 : 4, now: Date.now() }));
    }
    // Badges and personal bests (Progress). ?badges=none: one set and nothing earned from papers; ?data=empty has no papers.
    if (url.pathname === '/api/me/study-record') return json(state === 'empty' ? buildStudyRecord([], []) : previewStudyRecord(fixture.get('badges')));
    // Weekly goal (Account and onboarding): read 4 days; a save echoes the choice, in memory only.
    if (url.pathname === '/api/me/goal' && method === 'GET') return json(window.__previewGoal || { daysPerWeek: 4, timezone: 'Asia/Kolkata', pausedUntil: null, weekdays: fixture.get('weekdays') === 'none' ? null : [0, 1, 3, 5] });
    if (url.pathname === '/api/me/goal' && method === 'PUT') {
      if (state === 'save-error') return json({ error: 'Fixture goal save failure' }, 503);
      const body = JSON.parse(init.body || '{}');
      const weekdays = Array.isArray(body.weekdays) ? body.weekdays : (window.__previewGoal?.daysPerWeek === body.daysPerWeek ? window.__previewGoal.weekdays ?? null : null);
      window.__previewGoal = { daysPerWeek: Array.isArray(body.weekdays) ? body.weekdays.length : body.daysPerWeek, timezone: 'Asia/Kolkata', pausedUntil: body.pausedUntil ?? null, weekdays };
      return json(window.__previewGoal);
    }
    // Usage data choice (Account): an adult with usage data off; a save echoes the choice, nothing is stored or deleted.
    if (url.pathname === '/api/me/consent' && method === 'GET') return json(window.__previewConsent || { ageBand: 'adult', analyticsAllowed: false, policyVersion: 'preview', decidedAt: null, withdrawnAt: null });
    if (url.pathname === '/api/me/consent' && method === 'PUT') {
      if (state === 'save-error') return json({ error: 'Fixture consent save failure' }, 503);
      const body = JSON.parse(init.body || '{}');
      window.__previewConsent = { ageBand: body.ageBand, analyticsAllowed: body.analyticsAllowed === true, policyVersion: 'preview', decidedAt: new Date().toISOString(), withdrawnAt: null };
      return json({ ...window.__previewConsent, deletedEvents: 0 });
    }
    if (url.pathname === '/api/questions/mine') return json(state === 'empty' ? [] : fixtureUploads());
    if (url.pathname === '/api/questions/pending') return json(state === 'empty' ? [] : fixtureUploads().filter((question) => question.status === 'pending_moderation'));
    if (url.pathname === '/api/learning/summary') return json(state === 'empty' ? null : { solvedTotal: 7 });
    if (url.pathname.startsWith('/api/auth/')) return json({ user: null }, 200);
    if (url.pathname.startsWith('/api/questions/') && url.pathname.endsWith('/vote')) return json({ score: 0, userVote: 0 });
    // Account > Plan cancel flow. Fixture only: no Razorpay call. ?cancel=fail shows the failure state.
    if (url.pathname === '/api/billing/cancel' && method === 'POST') {
      if (new URLSearchParams(window.location.search).get('cancel') === 'fail') return json({ error: 'Cancellation could not be confirmed. Try again or write to support.' }, 502);
      return json({ ok: true, message: new URLSearchParams(window.location.search).get('plan') === 'monthly-failed-free' ? 'Renewals are cancelled.' : 'Renewals are cancelled. Pro stays active until 16 November 2026.' });
    }
    // Unhandled fixture writes are blocked, including billing and model endpoints.
    if (method !== 'GET') return json({ error: 'Preview only: this action is not available.' }, 418);
    return json({ error: 'Fixture endpoint not supplied.' }, 503);
  };
}

// Account > Plan fixtures for Rs 99 monthly Pro (?plan=monthly and its variants).
const MONTHLY_PROFILES = {
  monthly: { isPremium: true, premiumUntil: '2026-11-16T18:29:59.000Z', razorpaySubscriptionId: 'sub_preview', subscriptionStatus: 'active' },
  'monthly-off': { isPremium: true, premiumUntil: '2026-11-16T18:29:59.000Z', razorpaySubscriptionId: 'sub_preview', subscriptionStatus: 'cancelled' },
  'monthly-failed': { isPremium: true, premiumUntil: '2026-11-16T18:29:59.000Z', razorpaySubscriptionId: 'sub_preview', subscriptionStatus: 'past_due' },
  'monthly-failed-free': { isPremium: false, premiumUntil: null, razorpaySubscriptionId: 'sub_preview', subscriptionStatus: 'past_due' },
  'monthly-lapsed': { isPremium: false, premiumUntil: null, razorpaySubscriptionId: 'sub_preview', subscriptionStatus: 'cancelled' },
};

function PreviewInner({ candidatePathway }) {
  const params = useSearchParams();
  // Layout effects run before any child's passive effect, so the stub has the pathway before the plan is requested.
  const recoveryFixture = params.get('recovery') === 'candidate';
  useLayoutEffect(() => { window.__previewPathway = recoveryFixture ? candidatePathway : null; }, [recoveryFixture, candidatePathway]);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const planParam = params.get('plan');
  const MONTHLY = MONTHLY_PROFILES[planParam] || null;
  const pro = planParam === 'pro' || Boolean(MONTHLY?.isPremium);
  const views = ['dashboard', 'test', 'prepos', 'compass', 'radar', 'saved', 'today', 'review', 'rules', 'revise', 'progress', 'recovery', 'explore', 'ranks', 'profile', 'help', 'upload', 'my-uploads', 'result', 'rival', 'onboarding', 'mob', 'join', ...(params.get('role') === 'moderator' ? ['moderation'] : [])];
  const view = views.includes(params.get('view')) ? params.get('view') : 'dashboard';
  const routeNames = { prepos: 'mentor', compass: 'admission-compass', radar: 'analytics', ranks: 'leaderboard', rules: 'review/rules', revise: 'review/revise' };
  const route = `/${routeNames[view] || view}`;
  const previewHref = (name) => `/preview/arena?${new URLSearchParams({ view: name, plan: params.get('plan') || 'free', data: params.get('data') || 'ready', ...(params.get('role') === 'moderator' ? { role: 'moderator' } : {}), ...(params.get('recovery') ? { recovery: params.get('recovery') } : {}) })}`;
  const previewLinks = Object.fromEntries(views.map((name) => [routeNames[name] || name, previewHref(name)]));
  const auth = useMemo(() => ({
    user: { id: 'preview-user', name: params.get('data') === 'long' ? 'An exceptionally long illustrative display name for responsive checks' : 'Preview Student', email: 'preview@example.test', role: params.get('role') === 'moderator' ? 'moderator' : 'student',
      subjects: ['accountancy', 'economics', 'business_studies', 'english', ...(params.get('stale') === '1' ? ['hindi'] : [])],
      retiredSubjects: params.get('stale') === '1' ? ['teaching_aptitude'] : [],
      isPremium: pro, premiumUntil: pro ? '2027-07-31T18:29:59.000Z' : params.get('plan') === 'expired' ? '2026-09-01T18:29:59.000Z' : null, creditBalance: pro ? 0 : 40, ...(MONTHLY || {}) },
    status: 'authenticated', needsOnboarding: false, isAuthenticated: true,
    signInWithGoogle: async () => ({}), signInWithEmail: async () => ({}), verifyEmailOtp: async () => ({}),
    signOut: async () => {}, refreshSession: async () => {},
  }), [pro, params, MONTHLY]);
  return (
    <AuthContext.Provider value={auth}>
      <RoleProvider>
        <div className="arena-fixture-note" role="note"><b>Development preview</b><span>Illustrative data · {params.get('plan') || 'free'} · {params.get('data') || 'ready'}. No real saves, scores, credits or billing.</span><label>View<select value={view} onChange={(event) => { window.location.href = previewHref(event.target.value); }}>{views.map((name) => <option key={name} value={name}>{name}</option>)}</select></label>{view === 'test' && <ThemeToggle />}{view === 'prepos' && <button type="button" className="arena-chip" onClick={() => setDrawerOpen(true)}>Preview assistant drawer</button>}</div><AssistantDrawer open={drawerOpen} onClose={() => setDrawerOpen(false)} />
        {view === 'join' ? <AuthContext.Provider value={params.get('auth') === 'out' ? { ...auth, user: null, status: 'unauthenticated', isAuthenticated: false } : auth}><JoinMob code="7KQ2M9XR" /></AuthContext.Provider> : view === 'onboarding' ? <OnboardingPageClient preview /> : <AppLayoutClient previewRoute={route} previewLinks={previewLinks} studyEnabled={params.get('study') === 'on'}>{view === 'mob' ? <MobPage user={auth.user} /> : view === 'test' ? <TestPageClient /> : view === 'prepos' ? <MockMobAIHub variant="page" initialTab={params.get('tab') || 'plan'} /> : view === 'compass' ? <AdmissionCompassPageClient /> : view === 'radar' ? <AnalyticsPageClient /> : view === 'saved' ? <SavedPageClient /> : view === 'today' ? <TodayPage /> : view === 'recovery' ? <RecoveryJourney /> : view === 'review' ? <div className="student-page student-page--review"><RecoveryOverview view="review" /></div> : view === 'rules' ? <div className="student-page student-page--review"><RuleBook /></div> : view === 'revise' ? <div className="student-page student-page--review"><ReviseRun /></div> : view === 'progress' ? <ProgressPage /> : view === 'explore' ? <DiscoveryFeed /> : view === 'upload' ? <UploadForm /> : view === 'my-uploads' ? <MyUploadsPageClient /> : view === 'profile' ? <ProfilePageClient /> : view === 'help' ? <HelpPageClient /> : view === 'ranks' ? <LeaderboardPageClient /> : view === 'result' ? <ResultPageClient previewId="fixture-attempt" /> : view === 'moderation' ? <ModerationPageClient /> : view === 'rival' ? <AIRivalArena /> : view === 'onboarding' ? <OnboardingPageClient preview /> : <DashboardPageClient />}</AppLayoutClient>}
      </RoleProvider>
    </AuthContext.Provider>
  );
}

export default function ArenaPreviewClient({ candidatePathway = null }) {
  return <Suspense fallback={null}><PreviewInner candidatePathway={candidatePathway} /></Suspense>;
}
