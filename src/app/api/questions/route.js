import { NextResponse } from 'next/server';
import { Database } from '@/../data/db';
import { auth } from '@/lib/auth';
import { normalizeSubjectSelection } from '@/../data/cuet_controls';
import { isValidTopSyllabusPair } from '@/../data/canonical_syllabus';
import { contributeEnabled } from '@/lib/contribute';
import { checkPersistentRateLimit, rateLimitHeaders } from '@/lib/server/rateLimit';

// Scored practice uses owner-bound server-selected sessions. Contributions stay pending.
export async function GET() {
  return Response.json({ error: 'SERVER_SESSION_REQUIRED', message: 'Start practice using /api/sessions.' }, { status: 409 });
}

// POST /api/questions (security pass 15 Nov 2026): nothing calls it and contributions are paused, so while CONTRIBUTE_ENABLED
// is not 'true' it does not exist (404), before any auth, body or database work, the same gate /api/questions/upload checks
// first. Switched on, it takes only the fields below (never an id or a source from the body), caps every field and the body,
// and is limited per student like the upload route.
const BODY_MAX_BYTES = 16_384;
const MAX = Object.freeze({ subject: 60, chapter: 160, question: 2_000, option: 500, options: 5, explanation: 3_000 });
const DIFFICULTIES = ['easy', 'medium', 'hard'];
const POST_LIMITS = [
  { route: '/api/questions:post', limit: 30, windowMs: 60_000 },
  { route: '/api/questions:post:day', limit: 200, windowMs: 86_400_000 },
];

// Basic server-side validation for question payloads.
function validateQuestionPayload(q) {
  const errors = [];
  if (!q || typeof q !== 'object' || Array.isArray(q)) { errors.push('Body must be an object'); return errors; }
  if (typeof q.subject !== 'string' || q.subject.length > MAX.subject) { errors.push('subject is required'); return errors; }
  const subjectSelection = normalizeSubjectSelection({ subject: q.subject });
  if (!subjectSelection.valid) errors.push(subjectSelection.error || 'SUBJECT_NOT_SUPPORTED');
  if (typeof q.chapter !== 'string' || !q.chapter.trim()) errors.push('chapter is required');
  else if (q.chapter.length > MAX.chapter) errors.push(`chapter must be at most ${MAX.chapter} characters`);
  else if (subjectSelection.valid && !isValidTopSyllabusPair(subjectSelection.internalSubject, q.chapter)) errors.push('unsupported CUET subject/chapter');
  if (typeof q.question !== 'string' || q.question.trim().length < 5) errors.push('question must be at least 5 characters');
  else if (q.question.length > MAX.question) errors.push(`question must be at most ${MAX.question} characters`);
  if (!Array.isArray(q.options) || q.options.length < 2) errors.push('options must be an array of at least 2 items');
  else if (q.options.length > MAX.options) errors.push(`options must have at most ${MAX.options} items`);
  else if (q.options.some(o => typeof o !== 'string' || !o.trim())) errors.push('every option must be a non-empty string');
  else if (q.options.some(o => o.length > MAX.option)) errors.push(`every option must be at most ${MAX.option} characters`);
  if (!Number.isInteger(q.correctIndex) || q.correctIndex < 0 || (Array.isArray(q.options) && q.correctIndex >= q.options.length)) {
    errors.push('correctIndex must be a valid index into options');
  }
  if (q.explanation != null && (typeof q.explanation !== 'string' || q.explanation.length > MAX.explanation)) errors.push(`explanation must be text of at most ${MAX.explanation} characters`);
  if (q.difficulty != null && !DIFFICULTIES.includes(q.difficulty)) errors.push('difficulty must be easy, medium or hard');
  return errors;
}

export async function POST(request) {
  if (!contributeEnabled()) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  try {
    const session = await auth(request);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    for (const window of POST_LIMITS) {
      const limited = await checkPersistentRateLimit(request, { ...window, keyParts: [session.user.id], identityOnly: true, fallback: 'memory' });
      if (!limited.allowed) {
        return NextResponse.json(
          { error: 'Too many questions sent. Please wait before sending more.' },
          { status: 429, headers: rateLimitHeaders({ ...limited, retryAfterSeconds: limited.retryAfterSeconds || 60 }) },
        );
      }
    }

    const text = await request.text();
    if (Buffer.byteLength(text, 'utf8') > BODY_MAX_BYTES) {
      return NextResponse.json({ error: 'Validation failed', details: [`body must be at most ${BODY_MAX_BYTES} bytes`] }, { status: 413 });
    }
    let body;
    try { body = JSON.parse(text); } catch { body = null; }
    const errors = validateQuestionPayload(body);
    if (errors.length) {
      return NextResponse.json({ error: 'Validation failed', details: errors }, { status: 400 });
    }
    // Only these fields reach the bank table: the id is always made by the server and the source is never the caller's.
    const newQuestion = await Database.addPendingQuestion({
      subject: normalizeSubjectSelection({ subject: body.subject }).internalSubject,
      chapter: body.chapter,
      question: body.question,
      options: body.options,
      correctIndex: body.correctIndex,
      explanation: body.explanation ?? null,
      difficulty: body.difficulty ?? null,
      uploadedBy: session.user.id,
    });
    return NextResponse.json(newQuestion, { status: 201 });
  } catch (e) {
    console.error('[api/questions] POST failed:', e);
    return NextResponse.json({ error: 'Failed to submit question' }, { status: 500 });
  }
}
