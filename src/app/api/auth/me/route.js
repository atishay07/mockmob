import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { Database } from '@/../data/db';

export async function GET() {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ user: null, needsOnboarding: false }, { status: 401 });
    }

    const dbUser =
      (await Database.getUserById(session.user.id)) ||
      (session.user.email ? await Database.getUserByEmail(session.user.email) : null);

    if (!dbUser) {
      return NextResponse.json({ user: null, needsOnboarding: false }, { status: 404 });
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

    return NextResponse.json({
      user,
      needsOnboarding: user.subjects.length === 0,
    });
  } catch (e) {
    console.error('[api/auth/me] GET failed:', e);
    return NextResponse.json({ error: 'Failed to resolve auth session' }, { status: 500 });
  }
}
