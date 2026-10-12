import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { getRepairRecord, parseLimit } from '@/lib/server/repairRecord';

export const dynamic = 'force-dynamic';
const NO_STORE = { 'Cache-Control': 'no-store' };

// The student's repairs, newest first: found, repaired and checked state per question.
export async function GET(request) {
  const session = await auth(request);
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized', message: 'Please sign in.' }, { status: 401, headers: NO_STORE });
  const limit = parseLimit(new URL(request.url).searchParams.get('limit'));
  if (limit === null) return NextResponse.json({ error: 'invalid_request', message: 'limit must be a positive whole number.' }, { status: 422, headers: NO_STORE });
  try { return NextResponse.json({ repairs: await getRepairRecord(session.user.id, { limit }) }, { headers: NO_STORE }); }
  catch { return NextResponse.json({ error: 'unavailable', message: 'Your repair record could not be loaded. Try again shortly.' }, { status: 503, headers: NO_STORE }); }
}
