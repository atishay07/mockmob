import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { Database } from '@/../data/db';
import { getUsageSnapshot, planTierFor } from '@/services/usage/getDailyUsage';
import { consumeAIAllowance } from '@/services/credits/consumeAIAllowance';
import { AI_CREDIT_PACKS } from '@/services/credits/aiCreditWallet';
import { logAIUsage } from '@/services/ai/usageLogger';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const ALLOWED_ACTIONS = new Set([
  'launch_ai_rival',
  'create_next_mock',
  'create_trap_drill',
  'create_mistake_replay',
  'show_admission_path',
  'explain_mistake',
  'start_revision_queue',
  'show_mock_autopsy',
  'buy_credits',
  'upgrade_plan',
]);

export async function POST(request) {
  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'invalid_json_body' }, { status: 400 });
  }

  const action = typeof body?.action === 'string' ? body.action : '';
  const params = body?.params && typeof body.params === 'object' ? body.params : {};

  if (!ALLOWED_ACTIONS.has(action)) {
    return NextResponse.json({ error: 'unknown_action' }, { status: 400 });
  }

  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  const dbUser = await Database.getUserById(session.user.id);
  if (!dbUser) {
    return NextResponse.json({ error: 'user_not_found' }, { status: 404 });
  }

  const snapshot = await getUsageSnapshot(dbUser);
  const isPaid = planTierFor(dbUser) === 'paid';

  switch (action) {
    case 'launch_ai_rival':
      return NextResponse.json({
        ok: true,
        kind: 'redirect',
        target: '/rival',
        params: {
          rivalType: params.rivalType || 'NORTH_CAMPUS_RIVAL',
          subjects: Array.isArray(params.subjects) ? params.subjects : null,
        },
      });

    case 'create_next_mock': {
      const subject = params.subject || dbUser.subjects?.[0] || null;
      const mode = ['quick', 'smart', 'full', 'nta'].includes(params.mode) ? params.mode : 'quick';
      if (!subject) {
        return NextResponse.json({
          ok: false,
          error: 'no_subject',
          message: 'Set at least one subject in your profile first.',
          target: '/profile',
        }, { status: 400 });
      }

      let chargeRecord = null;
      if (params.custom === true) {
        const charged = await chargeActionAllowance({
          user: dbUser,
          action: 'custom_mock_plan',
          prefix: 'custom_mock_plan',
          params,
        });
        if (charged.error) return NextResponse.json(charged.error, { status: charged.status });
        chargeRecord = charged.record;
      }

      return NextResponse.json({
        ok: true,
        kind: 'redirect',
        target: '/dashboard',
        params: { subject, mode, count: clampInt(params.count, 5, 50, 10) },
        charge: chargeRecord,
      });
    }

    case 'create_trap_drill':
    case 'create_mistake_replay': {
      if (!isPaid) {
        return NextResponse.json(
          { error: 'paid_plan_required', message: 'Mistake Replay is a paid feature when personalized.' },
          { status: 402 },
        );
      }

      const subject = params.subject || dbUser.subjects?.[0] || null;
      return NextResponse.json({
        ok: true,
        kind: 'inline',
        message:
          'Mistake Replay ready: run 8-10 questions from the weakest available area, cap it at 10 minutes, review only wrong or skipped questions, then take a benchmark while the pattern is fresh.',
        params: {
          subject,
          suggestedRoute: '/dashboard',
          suggestedMode: 'quick',
          count: clampInt(params.questionCount, 5, 30, 10),
          difficulty: 'hard',
          focusConcepts: Array.isArray(params.focusConcepts) ? params.focusConcepts.slice(0, 6) : [],
        },
        charge: { kind: 'covered_by_mentor', amount: 0, creditUnits: 0 },
      });
    }

    case 'show_admission_path':
      return NextResponse.json({
        ok: true,
        kind: 'redirect',
        target: '/admission-compass',
        params: {},
      });

    case 'explain_mistake':
      return NextResponse.json({
        ok: true,
        kind: 'inline',
        message:
          'Open the question from Saved or Result. PrepOS will use that exact question context on your next prompt.',
        target: params.questionId ? '/saved' : '/dashboard',
        params: { questionId: params.questionId || null },
      });

    case 'start_revision_queue':
      return NextResponse.json({
        ok: true,
        kind: 'redirect',
        target: '/saved',
        params: { intent: 'revise', subjects: params.subjects || dbUser.subjects || [] },
      });

    case 'show_mock_autopsy': {
      if (!isPaid) {
        return NextResponse.json(
          { error: 'paid_plan_required', message: 'Deep mock autopsy is a paid feature.' },
          { status: 402 },
        );
      }
      const attempts = await Database.getAttempts(session.user.id).catch(() => []);
      if (!attempts.length) {
        return NextResponse.json({
          ok: false,
          error: 'no_attempts',
          message: 'Take at least one mock so the autopsy has data to read.',
          target: '/dashboard',
        }, { status: 400 });
      }

      return NextResponse.json({
        ok: true,
        kind: 'mentor_followup',
        target: '/mentor',
        params: {
          attemptId: attempts[0].id,
          subject: attempts[0].subject,
          mode: 'autopsy',
          prompt: `Analyze my last mock (${attempts[0].subject}, score ${attempts[0].score}).`,
        },
        charge: { kind: 'charged_on_mentor_followup', amount: 0, creditUnits: 0 },
      });
    }

    case 'buy_credits':
      return NextResponse.json({
        ok: true,
        kind: 'redirect',
        target: '/pricing/prepos',
        message: 'Open PrepOS credit packs to top up without changing your subscription.',
        params: { reason: 'ai_credits', balance: snapshot.creditBalance || 0 },
        packs: AI_CREDIT_PACKS,
      });

    case 'upgrade_plan':
      return NextResponse.json({
        ok: true,
        kind: 'redirect',
        target: '/pricing',
        params: { reason: 'ai_mentor' },
      });

    default:
      return NextResponse.json({ error: 'unhandled_action' }, { status: 400 });
  }
}

async function chargeActionAllowance({ user, action, prefix, params }) {
  const allowance = await consumeAIAllowance({
    user,
    action,
    params,
    referencePrefix: prefix,
  });

  if (!allowance.ok) {
    return {
      error: {
        error: allowance.error || 'insufficient_credits',
        required: allowance.required,
        balance: allowance.balance,
        upgrade: true,
      },
      status: allowance.status || 402,
    };
  }

  await logAIUsage({
    userId: user.id,
    feature: action,
    provider: 'none',
    model: 'none',
    actionTriggered: action,
    metadata: { charge: allowance.charge, creditUnits: allowance.charge?.creditUnits || 0 },
  });

  return { ok: true, record: allowance.charge };
}

function clampInt(v, lo, hi, fallback) {
  const n = Number(v);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(lo, Math.min(hi, Math.round(n)));
}
