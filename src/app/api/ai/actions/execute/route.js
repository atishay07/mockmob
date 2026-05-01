import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { Database } from '@/../data/db';
import { getUsageSnapshot, resolveActionQuota, planTierFor } from '@/services/usage/getDailyUsage';
import { checkAndConsumeCredits } from '@/services/credits/checkAndConsumeCredits';
import { logAIUsage } from '@/services/ai/usageLogger';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const ALLOWED_ACTIONS = new Set([
  'launch_ai_rival',
  'create_next_mock',
  'create_trap_drill',
  'show_admission_path',
  'explain_mistake',
  'start_revision_queue',
  'show_mock_autopsy',
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

  // Each action has its own gating + cost.
  switch (action) {
    case 'launch_ai_rival': {
      // Front-end should call /api/ai/rival/start directly with full params.
      // This branch returns a redirect descriptor so the executor can be
      // called from a mentor card without leaving the chat.
      return NextResponse.json({
        ok: true,
        kind: 'redirect',
        target: '/rival',
        params: {
          rivalType: params.rivalType || 'NORTH_CAMPUS_RIVAL',
          subjects: Array.isArray(params.subjects) ? params.subjects : null,
        },
      });
    }

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
      return NextResponse.json({
        ok: true,
        kind: 'redirect',
        target: '/dashboard',
        params: { subject, mode, count: clampInt(params.count, 5, 50, 10) },
      });
    }

    case 'create_trap_drill': {
      const quota = resolveActionQuota({ user: dbUser, snapshot, action: 'trap_drill' });
      if (!quota.allowed) {
        return NextResponse.json(
          { error: 'paid_plan_required', message: 'Trap drills are a paid feature.' },
          { status: 402 },
        );
      }
      const charge = await chargeIfNeeded({
        quota,
        userId: session.user.id,
        action: 'trap_drill',
        prefix: 'trap_drill',
      });
      if (charge.error) return NextResponse.json(charge.error, { status: charge.status });

      // TODO: full trap-drill generator. For MVP we hand back a structured
      // recommendation that the client can render and route to /dashboard
      // with prefilled subject + chapter filters.
      const subject = params.subject || dbUser.subjects?.[0] || null;
      return NextResponse.json({
        ok: true,
        kind: 'recommendation',
        message:
          'Trap drill generated. We will route you to a focused practice on your weakest chapter. Full custom drills are coming.',
        target: '/dashboard',
        params: {
          subject,
          mode: 'quick',
          count: clampInt(params.questionCount, 5, 30, 10),
          difficulty: 'hard',
          focusConcepts: Array.isArray(params.focusConcepts) ? params.focusConcepts.slice(0, 6) : [],
        },
        charge: charge.record,
      });
    }

    case 'show_admission_path': {
      return NextResponse.json({
        ok: true,
        kind: 'redirect',
        target: '/admission-compass',
        params: {},
      });
    }

    case 'explain_mistake': {
      // No-charge inline action — UI already has the context.
      return NextResponse.json({
        ok: true,
        kind: 'inline',
        message:
          'Open the question on the Saved or Result page to read the canonical explanation. Mentor will reference it on the next prompt.',
        target: params.questionId ? `/saved` : `/dashboard`,
        params: { questionId: params.questionId || null },
      });
    }

    case 'start_revision_queue': {
      // Routes to the saved questions page where revision queue lives.
      return NextResponse.json({
        ok: true,
        kind: 'redirect',
        target: '/saved',
        params: { intent: 'revise', subjects: params.subjects || dbUser.subjects || [] },
      });
    }

    case 'show_mock_autopsy': {
      const quota = resolveActionQuota({ user: dbUser, snapshot, action: 'mock_autopsy' });
      if (!quota.allowed) {
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
      const charge = await chargeIfNeeded({
        quota,
        userId: session.user.id,
        action: 'mock_autopsy',
        prefix: 'autopsy',
      });
      if (charge.error) return NextResponse.json(charge.error, { status: charge.status });

      // Hand the most recent attempt id to the mentor — UI will then call
      // /api/ai/mentor/chat with mode=autopsy and a "Analyse attempt X" message.
      return NextResponse.json({
        ok: true,
        kind: 'mentor_followup',
        target: '/mentor',
        params: {
          attemptId: attempts[0].id,
          subject: attempts[0].subject,
          mode: 'autopsy',
          prompt: `Analyse my last mock (${attempts[0].subject}, score ${attempts[0].score}).`,
        },
        charge: charge.record,
      });
    }

    default:
      return NextResponse.json({ error: 'unhandled_action' }, { status: 400 });
  }
}

async function chargeIfNeeded({ quota, userId, action, prefix }) {
  if (!quota.requiresCredits || !quota.creditCost) {
    return { ok: true, record: { kind: 'included', amount: 0 } };
  }
  const reference = `${prefix}_${userId}_${Date.now()}`;
  const charge = await checkAndConsumeCredits({
    userId,
    amount: quota.creditCost,
    action,
    reference,
  });
  if (!charge.ok) {
    return {
      error: {
        error: charge.error || 'insufficient_credits',
        required: charge.required ?? quota.creditCost,
        balance: charge.balance,
        upgrade: true,
      },
      status: 402,
    };
  }
  // Log the action separately from mentor chat.
  await logAIUsage({
    userId,
    feature: action,
    provider: 'none',
    model: 'none',
    actionTriggered: action,
    metadata: { reference, charged: charge.charged },
  });
  return { ok: true, record: { kind: 'credits', amount: charge.charged, reference } };
}

function clampInt(v, lo, hi, fallback) {
  const n = Number(v);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(lo, Math.min(hi, Math.round(n)));
}
