import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { Database } from '@/../data/db';
import { getStudentAIContext } from '@/services/ai/getStudentAIContext';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  const dbUser = await Database.getUserById(session.user.id);
  if (!dbUser) {
    return NextResponse.json({ error: 'user_not_found' }, { status: 404 });
  }

  const context = await getStudentAIContext({ user: dbUser });
  return NextResponse.json({
    ok: true,
    context: {
      planType: context.planType,
      isPaid: context.isPaid,
      selectedSubjects: context.selectedSubjects,
      recentMockSummary: context.recentMockSummary,
      lastMockSummary: context.lastMockSummary,
      weaknessSummary: context.weaknessSummary,
      mistakeDNA: context.mistakeDNA,
      timeBehavior: context.timeBehavior,
      savedQuestionSummary: context.savedQuestionSummary,
      skippedQuestionSummary: context.skippedQuestionSummary,
      admissionCompassSummary: context.admissionCompassSummary,
      aiConfidence: context.aiConfidence,
      revisionPriority: context.revisionPriority,
      recommendedDeterministicActions: context.recommendedDeterministicActions,
      aiCredits: context.aiCredits,
      normalCreditBalance: context.normalCreditBalance,
    },
  });
}
