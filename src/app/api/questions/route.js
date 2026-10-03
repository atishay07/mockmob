import { NextResponse } from 'next/server';
import { Database } from '@/../data/db';
import { auth } from '@/lib/auth';
import { normalizeSubjectSelection } from '@/../data/cuet_controls';
import { isValidTopSyllabusPair } from '@/../data/canonical_syllabus';

// Scored practice uses owner-bound server-selected sessions. Contributions stay pending.
export async function GET() {
  return Response.json({ error: 'SERVER_SESSION_REQUIRED', message: 'Start practice using /api/sessions.' }, { status: 409 });
}

// Basic server-side validation for question payloads.
function validateQuestionPayload(q) {
  const errors = [];
  if (!q || typeof q !== 'object') { errors.push('Body must be an object'); return errors; }
  const subjectSelection = normalizeSubjectSelection({ subject: q.subject });
  if (!subjectSelection.valid) errors.push(subjectSelection.error || 'SUBJECT_NOT_SUPPORTED');
  if (typeof q.chapter !== 'string' || !q.chapter.trim()) errors.push('chapter is required');
  if (subjectSelection.valid && q.chapter && !isValidTopSyllabusPair(subjectSelection.internalSubject, q.chapter)) errors.push('unsupported CUET subject/chapter');
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
      subject: normalizeSubjectSelection({ subject: body.subject }).internalSubject,
      uploadedBy: session.user.id,
    });
    return NextResponse.json(newQuestion, { status: 201 });
  } catch (e) {
    console.error('[api/questions] POST failed:', e);
    return NextResponse.json({ error: 'Failed to submit question' }, { status: 500 });
  }
}
