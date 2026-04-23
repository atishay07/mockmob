import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';

export async function GET() {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ user: null, needsOnboarding: false }, { status: 401 });
    }

    const user = {
      id: session.user.id,
      name: session.user.name || '',
      email: session.user.email || '',
      image: session.user.image || null,
      subjects: session.user.subjects || [],
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

