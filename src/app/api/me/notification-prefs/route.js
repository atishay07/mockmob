import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { getNotificationPrefs, saveNotificationPrefs, TIMEZONES, CHANNEL_KEYS } from '@/lib/server/appPrefs';

export const dynamic = 'force-dynamic';
const NO_STORE = { 'Cache-Control': 'no-store' };
const HHMM = /^([01]\d|2[0-3]):[0-5]\d$/;
const bad = message => NextResponse.json({ error: 'invalid_request', message }, { status: 422, headers: NO_STORE });
const unavailable = () => NextResponse.json({ error: 'unavailable' }, { status: 503, headers: NO_STORE });

export async function GET(request) {
  const session = await auth(request);
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers: NO_STORE });
  try { return NextResponse.json(await getNotificationPrefs(session.user.id), { headers: NO_STORE }); }
  catch { return unavailable(); }
}

// PUT accepts any subset of: timezone, quietStart, quietEnd, channels, studyWindow, weeklyCap.
export async function PUT(request) {
  const session = await auth(request);
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers: NO_STORE });
  const body = await request.json().catch(() => null);
  if (!body || typeof body !== 'object' || Array.isArray(body)) return bad('Send a JSON object.');
  const patch = {};
  if (body.timezone !== undefined) {
    if (!TIMEZONES.includes(body.timezone)) return bad('That timezone is not supported.');
    patch.timezone = body.timezone;
  }
  for (const [key, column] of [['quietStart', 'quiet_start'], ['quietEnd', 'quiet_end']]) {
    if (body[key] === undefined) continue;
    if (typeof body[key] !== 'string' || !HHMM.test(body[key])) return bad('Quiet hours must look like 23:00.');
    patch[column] = body[key];
  }
  if (body.weeklyCap !== undefined) {
    if (!Number.isInteger(body.weeklyCap) || body.weeklyCap < 0 || body.weeklyCap > 14) return bad('Weekly reminders must be between 0 and 14.');
    patch.weekly_cap = body.weeklyCap;
  }
  if (body.channels !== undefined) {
    const c = body.channels;
    if (!c || typeof c !== 'object' || Array.isArray(c)) return bad('Channels must be an object.');
    if (Object.keys(c).some(k => !CHANNEL_KEYS.includes(k) || typeof c[k] !== 'boolean')) return bad('Unknown notification channel.');
    try {
      const current = await getNotificationPrefs(session.user.id);
      patch.channels = { ...current.channels, ...c };
    } catch { return unavailable(); }
  }
  if (body.studyWindow !== undefined) {
    const w = body.studyWindow;
    if (w === null) patch.study_window = null;
    else {
      if (typeof w !== 'object' || Array.isArray(w) || typeof w.start !== 'string' || !HHMM.test(w.start) || typeof w.end !== 'string' || !HHMM.test(w.end)) return bad('Study window needs start and end like 18:00.');
      patch.study_window = { start: w.start, end: w.end };
    }
  }
  if (!Object.keys(patch).length) return bad('Nothing to update.');
  try { return NextResponse.json(await saveNotificationPrefs(session.user.id, patch), { headers: NO_STORE }); }
  catch { return unavailable(); }
}
