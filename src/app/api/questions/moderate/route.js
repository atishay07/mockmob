import { NextResponse } from 'next/server';
import { Database } from '@/../data/db';
import { auth } from '@/lib/auth';

function canModerate(user) {
  return user?.role === 'moderator' || user?.role === 'admin';
}

export async function POST(request) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (!canModerate(session.user)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { id, action } = await request.json();
    if (!id || !['approve', 'reject'].includes(action)) {
      return NextResponse.json({ error: 'Invalid parameters' }, { status: 400 });
    }

    const result = await Database.moderateQuestion(id, action);
    if (!result) {
      return NextResponse.json({ error: 'Question not found' }, { status: 404 });
    }

    return NextResponse.json(result);
  } catch (error) {
    console.error('[api/questions/moderate] POST failed:', error);
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
  }
}
