import { NextResponse } from 'next/server';
import { Database } from '@/../data/db';
import { auth } from '@/lib/auth';

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');
    const attempts = await Database.getAttempts(userId);
    return NextResponse.json(attempts);
  } catch (e) {
    console.error('[api/attempts] GET failed:', e);
    return NextResponse.json({ error: 'Failed to load attempts' }, { status: 500 });
  }
}

function validateAttemptPayload(a) {
  const errors = [];
  if (!a || typeof a !== 'object') { errors.push('Body must be an object'); return errors; }
  if (typeof a.subject !== 'string' || !a.subject.trim()) errors.push('subject is required');
  if (!Number.isFinite(a.score)) errors.push('score must be a number');
  if (!Number.isInteger(a.total) || a.total <= 0) errors.push('total must be a positive integer');
  if (!Array.isArray(a.details)) errors.push('details must be an array');
  if (!Array.isArray(a.questionsSnapshot)) errors.push('questionsSnapshot must be an array');
  if (a.selectionMeta !== undefined && (!a.selectionMeta || typeof a.selectionMeta !== 'object' || Array.isArray(a.selectionMeta))) {
    errors.push('selectionMeta must be an object');
  }
  return errors;
}

export async function POST(request) {
  try {
    const session = await auth();
    if (!session || !session.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const errors = validateAttemptPayload(body);
    if (errors.length) {
      return NextResponse.json({ error: 'Validation failed', details: errors }, { status: 400 });
    }

    const newAttempt = await Database.addAttempt({
      ...body,
      userId: session.user.id,
    });
    return NextResponse.json(newAttempt, { status: 201 });
  } catch (e) {
    console.error('[api/attempts] POST failed:', e);
    return NextResponse.json({ error: 'Failed to save attempt' }, { status: 500 });
  }
}
