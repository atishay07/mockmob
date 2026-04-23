import { NextResponse } from 'next/server';
import { Database } from '@/../data/db';

// GET /api/questions/pending           → pending queue
// GET /api/questions/pending?status=rejected → rejected archive
export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status') || 'pending';
    const list = status === 'rejected'
      ? await Database.getRejectedQuestions()
      : await Database.getPendingQuestions();
    return NextResponse.json(list);
  } catch (e) {
    console.error('[api/questions/pending] GET failed:', e);
    return NextResponse.json({ error: 'Failed to load moderation queue' }, { status: 500 });
  }
}
