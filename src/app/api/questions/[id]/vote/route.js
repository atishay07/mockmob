import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { Database } from '@/../data/db';
import { checkPersistentRateLimit, rateLimitHeaders } from '@/lib/server/rateLimit';

const VOTE_LIMIT = { route: '/api/questions/vote', limit: 60, windowMs: 60_000 };

export async function POST(request, { params }) {
  try {
    const session = await auth(request);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const limited = await checkPersistentRateLimit(request, { ...VOTE_LIMIT, keyParts: [session.user.id], identityOnly: true, fallback: 'memory' });
    if (!limited.allowed) {
      return NextResponse.json({ error: 'Too many votes. Please wait a moment.' }, { status: 429, headers: rateLimitHeaders(limited) });
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
    // Votes are refused on questions that are not live (data/question_votes.js): they answer 404 like a missing one.
    const notFound = e?.code === 'question_not_found';
    const message = notFound ? 'Question not found' : 'Failed to vote';
    const status = notFound ? 404 : 500;
    console.error('[api/questions/vote] POST failed:', e);
    return NextResponse.json({ error: message }, { status });
  }
}
