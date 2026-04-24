import { NextResponse } from 'next/server';
import { Database } from '@/../data/db';
import { auth } from '@/lib/auth';

export async function POST(request) {
  try {
    const session = await auth();
    // Assuming only authenticated users or internal services can grant.
    // For production, you'd add role checks here (e.g. check if admin or internal secret).
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { user_id, amount, reference } = await request.json();

    if (!user_id || !amount || amount <= 0 || !reference) {
      return NextResponse.json({ error: 'Invalid input' }, { status: 400 });
    }

    await Database.grantCredits(user_id, amount, reference);

    return NextResponse.json({ success: true, granted: amount, user_id, reference });
  } catch (e) {
    console.error('[api/credits/grant] POST failed:', e);
    return NextResponse.json({ error: 'Failed to grant credits' }, { status: 500 });
  }
}
