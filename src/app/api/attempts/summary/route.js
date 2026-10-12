import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase';
import { listAttemptSummaries } from '@/lib/server/attemptSummary';

export const dynamic = 'force-dynamic';
const NO_STORE = { 'Cache-Control': 'no-store' };

// GET /api/attempts/summary?cursor=&limit= : the caller's own attempts, slim and paged.
export async function GET(request) {
  const session = await auth(request);
  if (!session?.user?.id) return NextResponse.json({ error: 'unauthorized', message: 'Sign in to see your attempts.' }, { status: 401, headers: NO_STORE });
  const params = new URL(request.url).searchParams;
  try {
    const result = await listAttemptSummaries(supabaseAdmin(), session.user.id, { cursor: params.get('cursor'), limit: params.get('limit') });
    if (result.error) return NextResponse.json({ error: 'bad_cursor', message: 'That page marker is not valid. Start again from the first page.' }, { status: 400, headers: NO_STORE });
    return NextResponse.json(result, { headers: NO_STORE });
  } catch (e) {
    console.error('[api/attempts/summary] GET failed:', e);
    return NextResponse.json({ error: 'unavailable', message: 'Could not load your attempts. Try again.' }, { status: 503, headers: NO_STORE });
  }
}
