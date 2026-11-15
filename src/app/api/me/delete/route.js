import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { requestDeletion } from '@/lib/server/appPrefs';

export const dynamic = 'force-dynamic';
const NO_STORE = { 'Cache-Control': 'no-store' };

// Records a deletion request only. It does NOT hard-delete: an operator script must process
// pending rows in account_deletion_requests (delete the account and study records within 30
// days, keep payment records required by law, then mark the row completed).
// POST body is optional: { source: 'android' | 'web' }.
// A4 (15 Nov): a browser request (cookie session) must be JSON. A form on another site can only send a form or text/plain
// body, so it cannot file a deletion even in a browser that ignores SameSite (src/proxy.js also refuses its Origin). The
// app's bearer request may come with no body at all, so the rule is for cookie sessions only.
const isJson = (request) => /^application\/json\b/i.test((request.headers.get('content-type') || '').trim());

export async function POST(request) {
  if (!request.headers.get('authorization') && !isJson(request)) {
    return NextResponse.json({ error: 'unsupported_media_type' }, { status: 415, headers: NO_STORE });
  }
  const session = await auth(request);
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers: NO_STORE });
  const body = await request.json().catch(() => null);
  const source = body?.source === 'web' ? 'web' : 'android';
  try { return NextResponse.json(await requestDeletion(session.user.id, source), { headers: NO_STORE }); }
  catch { return NextResponse.json({ error: 'unavailable' }, { status: 503, headers: NO_STORE }); }
}
