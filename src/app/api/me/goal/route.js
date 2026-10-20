import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { getGoal, saveDailyMinutes, saveGoal } from '@/lib/server/appPrefs';
import { resolveGoalWeekdays } from '@/lib/studyWeekdays.mjs';
import { parseDailyMinutes } from '@/../data/goal_minutes';

export const dynamic = 'force-dynamic';
const NO_STORE = { 'Cache-Control': 'no-store' };
const bad = message => NextResponse.json({ error: 'invalid_request', message }, { status: 422, headers: NO_STORE });

export async function GET(request) {
  const session = await auth(request);
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers: NO_STORE });
  try { return NextResponse.json(await getGoal(session.user.id), { headers: NO_STORE }); }
  catch { return NextResponse.json({ error: 'unavailable' }, { status: 503, headers: NO_STORE }); }
}

// GET -> { daysPerWeek, timezone, pausedUntil, weekdays: [0..6] | null, dailyMinutes: 5-999 | null } (weekdays: 0 = Monday, null when
// none are held; dailyMinutes: the daily goal in minutes, null when none is set).
// PUT { daysPerWeek?: 1-7, pausedUntil?: 'YYYY-MM-DD' | null, weekdays?: [0..6] | null, dailyMinutes?: 5-999 | null }. Pausing never removes earned history.
// dailyMinutes alone (no days, no weekdays, no pause) changes only the daily goal and leaves everything else as it is; sent with
// the days it is saved in the same write. An older app sends no dailyMinutes and reads the extra field as nothing.
// Before the daily_minutes column is applied a save with the days still works (the answer says minutesOnAccount: false and holds
// dailyMinutes: null) and a save of the minutes alone answers 409 minutes_not_on_account.
// weekdays sent: the plan is saved with the goal in one write and daysPerWeek is its count (it may be left out,
// and when sent it must match). weekdays left out: the goal alone changes and the plan is kept only while its
// count still matches. weekdays null: the plan is cleared. Own row only (the session user).
export async function PUT(request) {
  const session = await auth(request);
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers: NO_STORE });
  const body = await request.json().catch(() => null);
  if (!body || typeof body !== 'object' || Array.isArray(body)) return bad('Choose between 1 and 7 days a week.');
  const minutes = parseDailyMinutes(body);
  if (!minutes.ok) return bad('Choose between 5 and 999 minutes a day.');
  const minutesOnly = minutes.minutes !== undefined && body.daysPerWeek === undefined && body.weekdays === undefined && body.pausedUntil === undefined;
  if (minutesOnly) {
    try { return NextResponse.json(await saveDailyMinutes(session.user.id, minutes.minutes), { headers: NO_STORE }); }
    catch (error) {
      if (error?.message === 'GOAL_MINUTES_NOT_ON_ACCOUNT') return NextResponse.json({ error: 'minutes_not_on_account', message: 'Your daily goal is kept on this device for now.' }, { status: 409, headers: NO_STORE });
      return NextResponse.json({ error: 'unavailable' }, { status: 503, headers: NO_STORE });
    }
  }
  const goal = resolveGoalWeekdays(body);
  if (!goal.ok) return bad(goal.message);
  let pausedUntil = null;
  if (body.pausedUntil != null) {
    const d = body.pausedUntil;
    const t = typeof d === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(d) ? Date.parse(`${d}T00:00:00Z`) : NaN;
    if (Number.isNaN(t) || new Date(t).toISOString().slice(0, 10) !== d) return bad('Pause date must look like 2026-11-01.');
    if (t - Date.now() > 100 * 86400000) return bad('A pause can last up to 100 days.');
    pausedUntil = d;
  }
  try { return NextResponse.json(await saveGoal(session.user.id, { daysPerWeek: goal.daysPerWeek, pausedUntil, weekdays: goal.weekdays, dailyMinutes: minutes.minutes }), { headers: NO_STORE }); }
  catch { return NextResponse.json({ error: 'unavailable' }, { status: 503, headers: NO_STORE }); }
}
