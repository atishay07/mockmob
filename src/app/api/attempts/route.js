import { NextResponse } from 'next/server';
import { Database } from '@/../data/db';
import { auth } from '@/lib/auth';

export async function GET(request) {
  try {
    const session = await auth(request);
    if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const attempts = await Database.getAttempts(session.user.id);
    return NextResponse.json(attempts);
  } catch (e) {
    console.error('[api/attempts] GET failed:', e);
    return NextResponse.json({ error: 'Failed to load attempts' }, { status: 500 });
  }
}

// Compatibility endpoint: old client scores are never accepted.
export { PATCH as POST } from '@/app/api/sessions/route';
