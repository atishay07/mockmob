import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase';
import { AGE_BANDS, POLICY_VERSION } from '@/lib/server/usage';
const headers = { 'Cache-Control': 'no-store' };
const json = (body, status = 200) => NextResponse.json(body, { status, headers });
const shape = r => ({ ageBand: r?.age_band || 'unknown', analyticsAllowed: r?.analytics_allowed === true, policyVersion: r?.policy_version || POLICY_VERSION, decidedAt: r?.decided_at || null, withdrawnAt: r?.withdrawn_at || null });

export async function GET(request) {
  const session = await auth(request);
  if (!session?.user?.id) return json({ error: 'Unauthorized' }, 401);
  const { data, error } = await supabaseAdmin().from('usage_consent').select('*').eq('user_id', session.user.id).maybeSingle();
  if (error) return json({ error: 'Could not load your choice. Please try again.' }, 503);
  return json(shape(data));
}

export async function PUT(request) {
  const session = await auth(request);
  if (!session?.user?.id) return json({ error: 'Unauthorized' }, 401);
  let body;
  try { body = await request.json(); } catch { return json({ error: 'Invalid request.' }, 400); }
  if (!body || !AGE_BANDS.includes(body.ageBand) || typeof body.analyticsAllowed !== 'boolean') return json({ error: 'Send ageBand (adult, minor or unknown) and analyticsAllowed (true or false).' }, 400);
  if (body.analyticsAllowed && body.ageBand !== 'adult') return json({ error: 'Usage data can only be turned on for adults (18 or older).' }, 400);
  const db = supabaseAdmin();
  const userId = session.user.id;
  const { data: prev, error: readError } = await db.from('usage_consent').select('*').eq('user_id', userId).maybeSingle();
  if (readError) return json({ error: 'Could not save your choice. Please try again.' }, 503);
  const now = new Date().toISOString();
  const withdrawing = body.analyticsAllowed === false && prev?.analytics_allowed === true;
  const row = {
    user_id: userId, age_band: body.ageBand, analytics_allowed: body.analyticsAllowed, policy_version: POLICY_VERSION,
    decided_at: now, updated_at: now,
    withdrawn_at: body.analyticsAllowed ? null : withdrawing ? now : (prev?.withdrawn_at || null),
  };
  const { data, error } = await db.from('usage_consent').upsert(row, { onConflict: 'user_id' }).select().single();
  if (error) return json({ error: 'Could not save your choice. Please try again.' }, 503);
  let deletedEvents = 0;
  // Delete stored events on withdrawal, and whenever analytics is not allowed (minor/unknown).
  if (!body.analyticsAllowed) {
    const { data: gone, error: delError } = await db.from('usage_events').delete().eq('user_id', userId).select('id');
    if (delError) return json({ error: 'Your choice was saved, but deleting earlier data failed. Please try again.' }, 503);
    deletedEvents = gone?.length || 0;
  }
  return json({ ...shape(data), deletedEvents });
}
