import { NextResponse } from 'next/server';
import { Database } from '@/../data/db';

export async function GET(request, { params }) {
  try {
    const { id } = await params;
    const attempt = await Database.getAttemptById(id);
    if (!attempt) {
      return NextResponse.json({ error: 'Attempt not found' }, { status: 404 });
    }
    return NextResponse.json(attempt);
  } catch (e) {
    console.error('[api/attempts/:id] GET failed:', e);
    return NextResponse.json({ error: 'Failed to load attempt' }, { status: 500 });
  }
}
