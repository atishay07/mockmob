import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { getGoal, saveGoal } from '@/lib/server/appPrefs';

export const dynamic = 'force-dynamic';
const NO_STORE = { 'Cache-Control': 'no-store' };
const bad = message => NextResponse.json({ error: 'invalid_request', message }, { status: 422, headers: NO_STORE });

export async function GET(request) {
  const session = await auth(request);
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers: NO_STORE });
  try { return NextResponse.json(await getGoal(session.user.id), { headers: NO_STORE }); }
  catch { return NextResponse.json({ error: 'unavailable' }, { status: 503, headers: NO_STORE }); }
}

// PUT { daysPerWeek: 1-7, pausedUntil?: 'YYYY-MM-DD' | null }. Pausing never removes earned history.
export async function PUT(request) {
  const session = await auth(request);
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers: NO_STORE });
  const body = await request.json().catch(() => null);
  if (!body || !Number.isInteger(body.daysPerWeek) || body.daysPerWeek < 1 || body.daysPerWeek > 7) return bad('Choose between 1 and 7 days a week.');
  let pausedUntil = null;
  if (body.pausedUntil != null) {
    const d = body.pausedUntil;
    const t = typeof d === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(d) ? Date.parse(`${d}T00:00:00Z`) : NaN;
    if (Number.isNaN(t) || new Date(t).toISOString().slice(0, 10) !== d) return bad('Pause date must look like 2026-11-01.');
    if (t - Date.now() > 100 * 86400000) return bad('A pause can last up to 100 days.');
    pausedUntil = d;
  }
  try { return NextResponse.json(await saveGoal(session.user.id, { daysPerWeek: body.daysPerWeek, pausedUntil }), { headers: NO_STORE }); }
  catch { return NextResponse.json({ error: 'unavailable' }, { status: 503, headers: NO_STORE }); }
}
