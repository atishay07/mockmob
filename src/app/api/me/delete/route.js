import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { requestDeletion } from '@/lib/server/appPrefs';

export const dynamic = 'force-dynamic';
const NO_STORE = { 'Cache-Control': 'no-store' };

// Records a deletion request only. It does NOT hard-delete: an operator script must process
// pending rows in account_deletion_requests (delete the account and study records within 30
// days, keep payment records required by law, then mark the row completed).
// POST body is optional: { source: 'android' | 'web' }.
export async function POST(request) {
  const session = await auth(request);
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers: NO_STORE });
  const body = await request.json().catch(() => null);
  const source = body?.source === 'web' ? 'web' : 'android';
  try { return NextResponse.json(await requestDeletion(session.user.id, source), { headers: NO_STORE }); }
  catch { return NextResponse.json({ error: 'unavailable' }, { status: 503, headers: NO_STORE }); }
}
