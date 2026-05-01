import { NextResponse } from 'next/server';
import { Database } from '@/../data/db';
import { auth } from '@/lib/auth';
import { normalizeSubjectSelection } from '@/../data/cuet_controls';
import { isValidTopSyllabusPair } from '@/../data/canonical_syllabus';
import { getMode, isValidModeId, resolveCount } from '@/../data/test_modes';

export const dynamic = 'force-dynamic';

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const subjectId = searchParams.get('subject');
    const chapter = searchParams.get('chapter');
    const chapters = (searchParams.get('chapters') || '')
      .split(',')
      .map((entry) => entry.trim())
      .filter(Boolean)
      .slice(0, 12);
    const difficulty = searchParams.get('difficulty') || '';
    const countRaw = parseInt(searchParams.get('count') || '10', 10);
    const requestedCount = Number.isFinite(countRaw) ? Math.max(1, Math.min(100, countRaw)) : 10;
    const generationKey = (searchParams.get('generationKey') || '').trim();
    const modeIdRaw = (searchParams.get('mode') || '').trim();
    const modeId = isValidModeId(modeIdRaw) ? modeIdRaw : 'quick';
    const mode = getMode(modeId);
    const count = resolveCount(mode, requestedCount);
    const includeMeta = searchParams.get('includeMeta') === '1';

    const subjectSelection = normalizeSubjectSelection({ subject: subjectId });
    if (!subjectSelection.valid && subjectSelection.error === 'SUBJECT_REQUIRED') {
      return NextResponse.json({ error: 'SUBJECT_REQUIRED' }, { status: 400 });
    }
    if (!subjectSelection.valid) {
      return NextResponse.json({ error: 'SUBJECT_NOT_SUPPORTED' }, { status: 422 });
    }
    if (chapter && !isValidTopSyllabusPair(subjectSelection.internalSubject, chapter)) {
      return NextResponse.json({ error: 'Unsupported CUET chapter for this subject.' }, { status: 422 });
    }

    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const dbUser = await Database.getUserById(session.user.id);
    const isPremium = dbUser?.subscriptionStatus === 'active';

    if (mode.premium && !isPremium) {
      return NextResponse.json({
        error: 'PREMIUM_REQUIRED',
        details: `${mode.label} is a premium mode. Upgrade to access it.`,
      }, { status: 402 });
    }

    // Difficulty override is only meaningful for modes that allow it AND
    // remains a premium control for free users on those modes.
    const wantsDifficultyOverride = ['easy', 'medium', 'hard'].includes(difficulty);
    const effectiveDifficulty =
      wantsDifficultyOverride && mode.allowDifficultyOverride && isPremium ? difficulty : '';
    if (wantsDifficultyOverride && !mode.allowDifficultyOverride) {
      return NextResponse.json({
        error: 'DIFFICULTY_NOT_ALLOWED',
        details: `${mode.label} does not allow manual difficulty selection.`,
      }, { status: 422 });
    }
    if (wantsDifficultyOverride && mode.allowDifficultyOverride && !isPremium) {
      return NextResponse.json({
        error: 'PREMIUM_REQUIRED',
        details: 'Difficulty targeting is a premium control.',
      }, { status: 402 });
    }

    // Deduct mock-attempt credits at test START. The RPC is atomic
    // (row lock + balance check + ledger insert), and idempotent by
    // reference — a refresh that reuses the same generationKey will not
    // double-charge. Premium users are exempt (matches frontend gating).
    //
    // Cost depends on mode:
    //   Quick Practice -> 'attempt'      (10 credits)
    //   Full Mock      -> 'attempt_full' (50 credits)
    //   Smart / NTA    -> premium-only, never charged here
    if (generationKey && generationKey.length >= 12 && !isPremium && mode.creditAction) {
      const reference = `generate_mock_${mode.id}_${generationKey}`;
      console.log('[credits] spend attempt', {
        userId: session.user.id,
        mode: mode.id,
        action: mode.creditAction,
        cost: mode.creditCost,
        reference,
        balanceBefore: dbUser?.creditBalance,
      });
      let ok = false;
      try {
        ok = await Database.spendCredits(session.user.id, mode.creditAction, reference);
      } catch (rpcErr) {
        console.error('[credits] spend_credits RPC failed:', rpcErr);
        return NextResponse.json(
          { error: 'Failed to verify credits' },
          { status: 500 },
        );
      }
      if (!ok) {
        console.log('[credits] insufficient', {
          userId: session.user.id,
          mode: mode.id,
          required: mode.creditCost,
          balance: dbUser?.creditBalance,
        });
        return NextResponse.json(
          {
            error: 'Insufficient credits',
            upgrade: true,
            creditBalance: dbUser?.creditBalance ?? 0,
            required: mode.creditCost,
          },
          { status: 402 },
        );
      }
      const after = await Database.getUserById(session.user.id);
      console.log('[credits] spend ok', {
        userId: session.user.id,
        mode: mode.id,
        balanceAfter: after?.creditBalance,
      });
    }

    const questions = await Database.getQuestions(subjectSelection.internalSubject, count, {
      mode: mode.id,
      requestedCount,
      chapter: chapter || undefined,
      chapters: chapters.length > 0 ? chapters : undefined,
      difficulty: effectiveDifficulty || undefined,
      userId: session.user.id,
      generationKey,
      returnMeta: includeMeta,
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
