import { NextResponse } from 'next/server';
import { Database } from '@/../data/db';
import { auth } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const subjectId = searchParams.get('subject');
    const chapter = searchParams.get('chapter');
    const countRaw = parseInt(searchParams.get('count') || '10', 10);
    const count = Number.isFinite(countRaw) ? Math.max(1, Math.min(100, countRaw)) : 10;

    if (!subjectId) {
      return NextResponse.json({ error: 'Subject is required' }, { status: 400 });
    }

    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const questions = await Database.getQuestions(subjectId, count, {
      chapter: chapter || undefined,
      userId: session.user.id,
    });
    return NextResponse.json(questions);
  } catch (e) {
    console.error('[api/questions] GET failed:', e);
    return NextResponse.json({ error: 'Failed to load questions' }, { status: 500 });
  }
}

// Basic server-side validation for question payloads.
function validateQuestionPayload(q) {
  const errors = [];
  if (!q || typeof q !== 'object') { errors.push('Body must be an object'); return errors; }
  if (typeof q.subject !== 'string' || !q.subject.trim()) errors.push('subject is required');
  if (typeof q.chapter !== 'string' || !q.chapter.trim()) errors.push('chapter is required');
  if (typeof q.question !== 'string' || q.question.trim().length < 5) errors.push('question must be at least 5 characters');
  if (!Array.isArray(q.options) || q.options.length < 2) errors.push('options must be an array of at least 2 items');
  else if (q.options.some(o => typeof o !== 'string' || !o.trim())) errors.push('every option must be a non-empty string');
  if (!Number.isInteger(q.correctIndex) || q.correctIndex < 0 || (Array.isArray(q.options) && q.correctIndex >= q.options.length)) {
    errors.push('correctIndex must be a valid index into options');
  }
  return errors;
}

export async function POST(request) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const errors = validateQuestionPayload(body);
    if (errors.length) {
      return NextResponse.json({ error: 'Validation failed', details: errors }, { status: 400 });
    }
    const newQuestion = await Database.addPendingQuestion({
      ...body,
      uploadedBy: session.user.id,
    });
    return NextResponse.json(newQuestion, { status: 201 });
  } catch (e) {
    console.error('[api/questions] POST failed:', e);
    return NextResponse.json({ error: 'Failed to submit question' }, { status: 500 });
  }
}
