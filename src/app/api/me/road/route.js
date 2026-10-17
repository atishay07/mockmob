import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { getRoad, saveRoad } from '@/lib/server/studyRoad';
import { parseRoadInput } from '@/lib/today/road.mjs';
import { todayKeyIn } from '@/lib/today/week.mjs';

export const dynamic = 'force-dynamic';
const NO_STORE = { 'Cache-Control': 'no-store' };

// The Road to May on the account (TODAY-1017 P0): the exam day the student aims for and their full-mock target.
// GET -> { onAccount, examDate: 'YYYY-MM-DD' | null, mockTarget: 1-60 | null }. onAccount false = the columns are not
//        applied yet; the client then shows the expected window and a suggested target.
// PUT { examDate?: 'YYYY-MM-DD' | null, mockTarget?: 1-60 | null } -> the same body. Own row only (the session user).
//     409 road_not_on_account before the migration; 422 for a date outside tomorrow to 30 June, or a target outside 1-60.
export async function GET(request) {
  const session = await auth(request);
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers: NO_STORE });
  try { return NextResponse.json(await getRoad(session.user.id), { headers: NO_STORE }); }
  catch { return NextResponse.json({ error: 'unavailable' }, { status: 503, headers: NO_STORE }); }
}

export async function PUT(request) {
  const session = await auth(request);
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers: NO_STORE });
  const body = await request.json().catch(() => null);
  const parsed = parseRoadInput(body, todayKeyIn('Asia/Kolkata'));
  if (!parsed.ok) return NextResponse.json({ error: 'invalid_request', message: parsed.message }, { status: 422, headers: NO_STORE });
  try { return NextResponse.json(await saveRoad(session.user.id, parsed.patch), { headers: NO_STORE }); }
  catch (e) {
    if (e?.message === 'ROAD_NOT_ON_ACCOUNT') return NextResponse.json({ error: 'road_not_on_account', message: 'Your road is kept on this device for now.' }, { status: 409, headers: NO_STORE });
    return NextResponse.json({ error: 'unavailable', message: 'Your road could not be saved. Try again.' }, { status: 503, headers: NO_STORE });
  }
}
