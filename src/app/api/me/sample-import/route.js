import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase';
import { validateSampleImport, saveSampleImport } from '@/lib/server/sampleImport';

export const dynamic = 'force-dynamic';
const NO_STORE = { 'Cache-Control': 'no-store' };
const err = (status, error, message) => NextResponse.json({ error, message }, { status, headers: NO_STORE });

// Stores the guest's five landing-sample answers once per user. Idempotent on importKey and on
// (user, sampleVersion). Never creates an attempt, spends credits, counts toward rhythm or
// appears as a mock.
export async function POST(request) {
  const session = await auth(request);
  if (!session?.user?.id) return err(401, 'unauthorized', 'Sign in to save your sample answers.');
  const body = await request.json().catch(() => null);
  const v = validateSampleImport(body);
  if (!v.ok) return err(400, v.error, v.message);
  try {
    return NextResponse.json(await saveSampleImport(supabaseAdmin(), session.user.id, v.value), { headers: NO_STORE });
  } catch (e) {
    if (e?.code === 'KEY_TAKEN') return err(409, 'import_key_taken', 'This import key is already in use. Try again.');
    return err(503, 'unavailable', 'We could not save your answers right now. Try again.');
  }
}
