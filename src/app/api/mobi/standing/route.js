import { auth } from '@/lib/auth';
import { checkPersistentRateLimit } from '@/lib/server/rateLimit';
import { readStanding } from '@/services/mobi/standing';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

// GET /api/mobi/standing: "Where you stand" (C-dec 3 item c). The student's practice range against their own colleges'
// 2026 Round 1 closing marks, the gap and the chapters that close it fastest. Free on every plan (it was Compass Pro):
// arithmetic on the record, no model call, no credits. Bearer (app) or cookie (web).
export async function GET(request) {
  const headers = { 'Cache-Control': 'no-store' };
  const session = await auth(request);
  if (!session?.user?.id) return Response.json({ ok: false, error: 'unauthorized' }, { status: 401, headers });
  if (!(await checkPersistentRateLimit(request, { route: '/api/mobi/standing', limit: 60, keyParts: [session.user.id], fallback: 'memory' })).allowed) {
    return Response.json({ ok: false, error: 'rate_limited' }, { status: 429, headers });
  }
  try {
    return Response.json(await readStanding(session.user.id), { headers });
  } catch {
    return Response.json({ ok: false, error: 'standing_unavailable', message: 'Your record could not be read just now. Try again in a moment.' }, { status: 503, headers });
  }
}
