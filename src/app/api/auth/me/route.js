import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { Database } from '@/../data/db';
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

    const session = await auth();
    if (!session?.user) {
      return jsonWithDiagnostics(diagnostics, { user: null, needsOnboarding: false }, { status: 401 });
    }

    const dbUser =
      (await Database.getUserById(session.user.id)) ||
      (session.user.email ? await Database.getUserByEmail(session.user.email) : null);

    if (!dbUser) {
      return jsonWithDiagnostics(diagnostics, { user: null, needsOnboarding: false }, { status: 404 });
    }

    const user = {
      id: dbUser.id,
      name: dbUser.name || '',
      email: dbUser.email || '',
      image: dbUser.image || null,
      subjects: [...new Set((dbUser.subjects || []).map((s) => (s === 'GAT' || s === 'gat') ? 'general_test' : s))],
      role: dbUser.role || 'student',
      creditBalance: dbUser.creditBalance || 0,
      subscriptionStatus: dbUser.subscriptionStatus || 'free',
      isPremium: Boolean(dbUser.isPremium),
      premiumUntil: dbUser.premiumUntil || null,
      razorpaySubscriptionId: dbUser.razorpaySubscriptionId || null,
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
