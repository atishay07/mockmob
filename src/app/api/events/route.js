import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase';
import { canCollect, normalizeBatch, MAX_BATCH } from '@/lib/server/usage';
const headers = { 'Cache-Control': 'no-store' };
const json = (body, status = 200) => NextResponse.json(body, { status, headers });

export async function POST(request) {
  const session = await auth(request);
  if (!session?.user?.id) return json({ error: 'Unauthorized' }, 401);
  const text = await request.text();
  if (text.length > 100000) return json({ error: 'Request too large.' }, 413);
  let body;
  try { body = JSON.parse(text); } catch { return json({ error: 'Invalid request.' }, 400); }
  const events = body?.events;
  if (!Array.isArray(events)) return json({ error: 'events must be an array.' }, 400);
  if (events.length > MAX_BATCH) return json({ error: `At most ${MAX_BATCH} events per request.` }, 400);
  const db = supabaseAdmin();
  const { data: consent, error: consentError } = await db.from('usage_consent').select('age_band,analytics_allowed,withdrawn_at').eq('user_id', session.user.id).maybeSingle();
  if (consentError) return json({ error: 'Temporarily unavailable.' }, 503);
  if (!canCollect(consent)) return json({ accepted: 0, dropped: events.length, collecting: false }, 202);
  const { rows, dropped } = normalizeBatch(events, session.user.id);
  let accepted = 0;
  if (rows.length) {
    // Consent is checked and rows inserted atomically in the database, so a withdrawal cannot be raced.
    const { data: inserted, error } = await db.rpc('insert_usage_events', { p_user_id: session.user.id, p_rows: rows });
    if (error) return json({ error: 'Temporarily unavailable.' }, 503);
    accepted = Number(inserted) || 0;
  }
  return json({ accepted, dropped: dropped + (rows.length - accepted), collecting: accepted > 0 || rows.length === 0 }, 202);
}
