import { NextResponse } from 'next/server';
import { authWithStatus } from '@/lib/auth';
import { Database } from '@/../data/db';
import { getUnifiedWallet } from '@/services/credits/unifiedWallet';
import { pendingDeletionAt } from '@/lib/server/pendingDeletion.mjs';
import { supabaseAdmin } from '@/lib/supabase';
import { checkRateLimit, rateLimitHeaders } from '@/lib/server/rateLimit';
import {
  failRequestDiagnostics,
  finishRequestDiagnostics,
  startRequestDiagnostics,
} from '@/lib/server/requestDiagnostics';

const ROUTE = '/api/auth/me';
const AUTH_ME_RATE_LIMIT = 300;

function jsonWithDiagnostics(context, body, init) {
  const response = NextResponse.json(body, init);
  finishRequestDiagnostics(context, { status: response.status });
  return response;
}

export async function GET(request) {
  const diagnostics = startRequestDiagnostics(request, ROUTE);
  try {
    const rateLimit = checkRateLimit(request, {
      route: ROUTE,
      limit: AUTH_ME_RATE_LIMIT,
    });
    if (!rateLimit.allowed) {
      return jsonWithDiagnostics(
        diagnostics,
        { error: 'Too many requests' },
        { status: 429, headers: rateLimitHeaders(rateLimit) },
      );
    }

    const { session, transient } = await authWithStatus(request);
    if (!session?.user && transient) {
      // Supabase or the network failed; the session may be fine. 503 makes the web and the
      // Android app retry and keep the student signed in, where 401 would sign them out.
      return jsonWithDiagnostics(
        diagnostics,
        { error: 'auth_unavailable', user: null, needsOnboarding: false },
        { status: 503, headers: { 'Retry-After': '2', 'Cache-Control': 'no-store' } },
      );
    }
    if (!session?.user) {
      return jsonWithDiagnostics(diagnostics, { user: null, needsOnboarding: false }, { status: 401 });
    }

    const dbUser =
      (await Database.getUserById(session.user.id)) ||
      (session.user.email ? await Database.getUserByEmail(session.user.email) : null);

    if (!dbUser) {
      return jsonWithDiagnostics(diagnostics, { user: null, needsOnboarding: false }, { status: 404 });
    }

    // One credits balance (18 Oct 2026): creditBalance is the one total every screen shows and prices against
    // (this month's free credits + bought/held credits). users.credit_balance alone is the fallback if the wallet read fails.
    const credits = await getUnifiedWallet(dbUser).catch(() => null);
    // A Google Play subscription (monthly Pro bought in the app): its renewal is managed in Google Play, not here.
    const playSubscription = await Database.getPlaySubscription(dbUser.id).catch(() => null);
    // A deletion the student asked for and we have not processed yet (app v16, A2): the account keeps working until then, and
    // the app says so instead of leaving odd credits unexplained.
    const deletionRequestedAt = await pendingDeletionAt(dbUser.id, supabaseAdmin());
    const user = {
      id: dbUser.id,
      name: dbUser.name || '',
      email: dbUser.email || '',
      image: dbUser.image || null,
      subjects: [...new Set((dbUser.subjects || []).map((s) => (s === 'GAT' || s === 'gat') ? 'general_test' : s))],
      // Papers CUET dropped in 2025 that the account still holds: named in a note, never offered or launched.
      retiredSubjects: dbUser.retiredSubjects || [],
      role: dbUser.role || 'student',
      creditBalance: credits?.known ? credits.total : (dbUser.creditBalance || 0),
      credits: credits?.known ? { total: credits.total, freeLeft: credits.freeLeft, freeAllowance: credits.freeAllowance, resetAt: credits.resetAt, held: credits.held, parts: credits.parts } : null,
      subscriptionStatus: dbUser.subscriptionStatus || 'free',
      isPremium: Boolean(dbUser.isPremium),
      premiumUntil: dbUser.premiumUntil || null,
      razorpaySubscriptionId: dbUser.razorpaySubscriptionId || null,
      playSubscription: playSubscription || null,
      deletionRequestedAt,
    };

    return jsonWithDiagnostics(diagnostics, {
      user,
      needsOnboarding: user.subjects.length === 0,
    });
  } catch (e) {
    failRequestDiagnostics(diagnostics, e);
    console.error('[api/auth/me] GET failed:', e);
    return NextResponse.json({ error: 'Failed to resolve auth session' }, { status: 500 });
  }
}
