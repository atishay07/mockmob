import { NextResponse } from 'next/server';
import { Database } from '@/../data/db';
import { auth } from '@/lib/auth';

export async function POST(request) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { amount, reference } = await request.json();

    if (!amount || amount <= 0 || !reference) {
      return NextResponse.json({ error: 'Invalid input' }, { status: 400 });
    }

    const success = await Database.spendCredits(session.user.id, amount, reference);

    if (!success) {
      return NextResponse.json({ error: 'Insufficient credits' }, { status: 402 }); // Payment required equivalent
    }

    return NextResponse.json({ success: true, deducted: amount, reference });
  } catch (e) {
    console.error('[api/credits/spend] POST failed:', e);
    return NextResponse.json({ error: 'Failed to spend credits' }, { status: 500 });
  }
}
