import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase';
import { Database } from '@/../data/db';
import { checkRateLimit, rateLimitHeaders } from '@/lib/server/rateLimit';
import {
  failRequestDiagnostics,
  finishRequestDiagnostics,
  startRequestDiagnostics,
} from '@/lib/server/requestDiagnostics';

export const dynamic = 'force-dynamic';

const FREE_BOOKMARK_LIMIT = 25;
const FREE_WEEKLY_GOAL = 30;
const PREMIUM_WEEKLY_GOAL = 80;
const ROUTE = '/api/learning/summary';
const SUMMARY_RATE_LIMIT = 120;

function jsonWithDiagnostics(context, body, init, extra) {
  const response = NextResponse.json(body, init);
  finishRequestDiagnostics(context, { status: response.status, extra });
  return response;
}

function startOfToday() {
  const date = new Date();
  date.setHours(0, 0, 0, 0);
  return date;
}

function startOfWeek() {
  const date = startOfToday();
  const day = date.getDay();
  const diff = date.getDate() - day + (day === 0 ? -6 : 1);
  date.setDate(diff);
  return date;
}

function countStreak(days) {
  const set = new Set(days);
  let cursor = startOfToday();
  let streak = 0;

  while (set.has(cursor.toISOString().slice(0, 10))) {
    streak += 1;
    cursor.setDate(cursor.getDate() - 1);
  }

  return streak;
}

function normalizeDay(value) {
  if (!value) return null;
  return new Date(value).toISOString().slice(0, 10);
}

function lastSevenDays() {
  const days = [];
  const cursor = startOfToday();
  cursor.setDate(cursor.getDate() - 6);
  for (let i = 0; i < 7; i += 1) {
    const next = new Date(cursor);
    next.setDate(cursor.getDate() + i);
    days.push(next.toISOString().slice(0, 10));
  }
  return days;
}

export async function GET(request) {
  const diagnostics = startRequestDiagnostics(request, ROUTE);
  try {
    const rateLimit = checkRateLimit(request, {
      route: ROUTE,
      limit: SUMMARY_RATE_LIMIT,
    });
    if (!rateLimit.allowed) {
      return jsonWithDiagnostics(
        diagnostics,
        { error: 'Too many requests' },
        { status: 429, headers: rateLimitHeaders(rateLimit) },
      );
    }

    const session = await auth();
    if (!session?.user) {
      return jsonWithDiagnostics(diagnostics, { error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const subject = searchParams.get('subject');
    const user = await Database.getUserById(session.user.id);
    const isPremium = Boolean(user?.isPremium);
    const weekStart = startOfWeek().getTime();

    const [attempts, bookmarksResult, progressResult, contributorResult] = await Promise.all([
      Database.getAttempts(session.user.id).catch(() => []),
      supabaseAdmin()
        .from('question_bookmarks')
        .select('question_id, created_at')
        .eq('user_id', session.user.id)
        .order('created_at', { ascending: false }),
      supabaseAdmin()
        .from('user_question_progress')
        .select('question_id, subject, chapter, seen_count, attempt_count, correct_count, skip_count, best_dwell_ms, updated_at, last_attempted_at')
        .eq('user_id', session.user.id),
      supabaseAdmin()
        .from('questions')
        .select('uploaded_by, author_id, status')
        .eq('is_deleted', false)
        .eq('status', 'live')
        .limit(500),
    ]);

    const scopedAttempts = subject ? attempts.filter((attempt) => attempt.subject === subject) : attempts;
    const progressRows = progressResult.error ? [] : (progressResult.data || []);
    const scopedProgress = subject ? progressRows.filter((row) => row.subject === subject) : progressRows;
    const bookmarks = bookmarksResult.error ? [] : (bookmarksResult.data || []);

    const attemptSolvedIds = new Set();
    let correct = 0;
    let answered = 0;
    let weeklySolved = 0;
    const activeDays = [];

    for (const attempt of scopedAttempts) {
      const completedAt = Number(attempt.completedAt || 0);
      const day = normalizeDay(completedAt);
      if (day) activeDays.push(day);
      for (const detail of attempt.details || []) {
        if (detail?.givenIndex === null || detail?.givenIndex === undefined) continue;
        answered += 1;
        if (detail?.qid) attemptSolvedIds.add(detail.qid);
        if (detail?.isCorrect === true) correct += 1;
        if (completedAt >= weekStart) weeklySolved += 1;
      }
    }

    const feedSolvedIds = new Set(scopedProgress.filter((row) => row.attempt_count > 0).map((row) => row.question_id));
    const solvedIds = new Set([...attemptSolvedIds, ...feedSolvedIds]);
    const progressWeekly = scopedProgress.filter((row) => {
      const last = row.last_attempted_at || row.updated_at;
      return last && new Date(last).getTime() >= weekStart && row.attempt_count > 0;
    }).length;

    const dwellValues = scopedProgress
      .map((row) => Number(row.best_dwell_ms))
      .filter((value) => Number.isFinite(value) && value > 0);
    const avgDwellMs = dwellValues.length
      ? Math.round(dwellValues.reduce((sum, value) => sum + value, 0) / dwellValues.length)
      : null;

    const totalAttempts = scopedAttempts.reduce((sum, attempt) => sum + (attempt.total || 0), 0);
    const mockAvg = scopedAttempts.length
      ? Math.round(scopedAttempts.reduce((sum, attempt) => sum + (attempt.score || 0), 0) / scopedAttempts.length)
      : 0;
    const activityDays = lastSevenDays();
    const activityMap = new Map(activityDays.map((day) => [day, 0]));
    for (const attempt of scopedAttempts) {
      const day = normalizeDay(attempt.completedAt);
      if (activityMap.has(day)) activityMap.set(day, activityMap.get(day) + (attempt.total || 0));
    }
    for (const row of scopedProgress) {
      const day = normalizeDay(row.last_attempted_at || row.updated_at);
      if (activityMap.has(day) && row.attempt_count > 0) activityMap.set(day, activityMap.get(day) + 1);
    }

    const contributorCounts = new Map();
    for (const row of contributorResult.error ? [] : (contributorResult.data || [])) {
      const id = row.uploaded_by || row.author_id;
      if (!id) continue;
      contributorCounts.set(id, (contributorCounts.get(id) || 0) + 1);
    }
    const contributorIds = [...contributorCounts.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([id]) => id);
    let topContributors = contributorIds.map((id) => ({ id, name: 'Contributor', count: contributorCounts.get(id) || 0 }));
    if (contributorIds.length > 0) {
      const { data: users } = await supabaseAdmin()
        .from('users')
        .select('id, name')
        .in('id', contributorIds);
      const userMap = new Map((users || []).map((row) => [row.id, row.name]));
      topContributors = topContributors.map((row) => ({
        ...row,
        name: userMap.get(row.id) || 'Contributor',
      }));
    }

    const accuracy = answered > 0 ? Math.round((correct / answered) * 100) : 0;
    const weeklyGoal = isPremium ? PREMIUM_WEEKLY_GOAL : FREE_WEEKLY_GOAL;
    const solvedThisWeek = Math.max(weeklySolved, progressWeekly);
    const solvedTotal = Math.max(solvedIds.size, answered);

    return jsonWithDiagnostics(diagnostics, {
      plan: {
        status: user?.subscriptionStatus || 'free',
        isPremium,
        label: isPremium ? 'Premium' : 'Free',
      },
      progress: {
        solvedTotal,
        solvedThisWeek,
        weeklyGoal,
        weeklyPercent: Math.min(100, Math.round((solvedThisWeek / weeklyGoal) * 100)),
        accuracy,
        mockAvg,
        testsCompleted: scopedAttempts.length,
        totalMockQuestions: totalAttempts,
        feedAttempts: scopedProgress.reduce((sum, row) => sum + (row.attempt_count || 0), 0),
        skipped: scopedProgress.reduce((sum, row) => sum + (row.skip_count || 0), 0),
        streakDays: countStreak([
          ...activeDays,
          ...scopedProgress.map((row) => normalizeDay(row.updated_at)).filter(Boolean),
        ]),
        avgDwellMs,
      },
      bookmarks: {
        count: bookmarks.length,
        limit: isPremium ? null : FREE_BOOKMARK_LIMIT,
        remaining: isPremium ? null : Math.max(0, FREE_BOOKMARK_LIMIT - bookmarks.length),
        questionIds: bookmarks.map((row) => row.question_id),
      },
      premium: {
        mockCost: isPremium ? 0 : 10,
        mockAllowance: isPremium ? 'Unlimited mocks' : 'Credit-gated mocks',
        speedBenefit: isPremium
          ? 'Fast-lane generation and deeper speed diagnostics are active.'
          : 'Premium unlocks fast-lane generation, unlimited mocks, and deeper speed diagnostics.',
        bookmarkBenefit: isPremium ? 'Unlimited bookmarks' : `${FREE_BOOKMARK_LIMIT} saved questions included`,
        arenaBenefit: isPremium ? 'Arena sprints run without credit friction.' : 'Upgrade to remove credit friction in Arena.',
      },
      activity: activityDays.map((day) => ({
        day,
        label: new Date(`${day}T00:00:00`).toLocaleDateString('en-US', { weekday: 'short' }),
        solved: activityMap.get(day) || 0,
      })),
      topContributors,
    }, undefined, { subject: subject || 'all' });
  } catch (e) {
    failRequestDiagnostics(diagnostics, e);
    console.error('[api/learning/summary] GET failed:', e);
    return NextResponse.json({ error: 'Failed to load learning summary' }, { status: 500 });
  }
}
