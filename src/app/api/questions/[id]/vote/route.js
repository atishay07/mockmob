import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { Database } from '@/../data/db';

export async function POST(request, { params }) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id: questionId } = await params;
    const body = await request.json().catch(() => ({}));
    const voteType = body.vote_type;

    if (![null, 'up', 'down'].includes(voteType)) {
      return NextResponse.json({ error: 'vote_type must be "up", "down", or null' }, { status: 400 });
    }

    const result = await Database.voteQuestion(session.user.id, questionId, voteType);
    return NextResponse.json(result);
  } catch (e) {
    const message = e?.message || 'Failed to vote';
    const status = /question not found/i.test(message) ? 404 : 500;
    console.error('[api/questions/vote] POST failed:', e);
    return NextResponse.json({ error: message }, { status });
  }
}
