import { NextResponse } from 'next/server';
import { Database } from '@/../data/db';

export async function POST(request) {
  try {
    const { id, action } = await request.json(); // action = 'approve' | 'reject'
    if (!id || !['approve', 'reject'].includes(action)) {
      return NextResponse.json({ error: 'Invalid parameters' }, { status: 400 });
    }
    const result = await Database.moderateQuestion(id, action);
    if (!result) {
      return NextResponse.json({ error: 'Question not found' }, { status: 404 });
    }

    // Phase 3: Grant credits on approval
    if (action === 'approve' && result.uploadedBy) {
      try {
        await Database.grantCredits(
          result.uploadedBy,
          15, // 15 credits for approved question
          `question_approved_${id}`
        );
      } catch (err) {
        console.error('[api/questions/moderate] Failed to grant credits:', err);
      }
    }

    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
  }
}
