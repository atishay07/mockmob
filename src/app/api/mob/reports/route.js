import { auth } from '@/lib/auth';
import { errorBody, errorStatus } from '@/lib/mob/model.mjs';
import { listMobReports, mobEnabled, resolveMobReport } from '@/lib/server/mob/deps';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

// Moderation's "Mob reports" list (SOCIAL-SPEC section 6, report handling). Moderators and admins only.
//   GET                               -> { reports: [{ id, reason, name, createdAt, canRemove }] }
//   POST { id, remove?: boolean }      -> { result: 'resolved' | 'removed' }  (remove takes the member out of that Mob)
const headers = { 'Cache-Control': 'no-store' };
const fail = (code, status = errorStatus(code)) => Response.json(errorBody(code), { status, headers });
const forbidden = () => Response.json({ error: { code: 'FORBIDDEN', message: 'Only moderators can see Mob reports.' } }, { status: 403, headers });

async function moderator(request) {
  const session = await auth(request).catch(() => null);
  if (!session?.user?.id) return { error: fail('UNAUTHENTICATED') };
  if (!['moderator', 'admin'].includes(session.user.role)) return { error: forbidden() };
  return { user: session.user };
}

export async function GET(request) {
  if (!mobEnabled()) return fail('MOB_DISABLED');
  const who = await moderator(request);
  if (who.error) return who.error;
  try { return Response.json({ reports: await listMobReports() }, { headers }); } catch { return fail('UNAVAILABLE'); }
}

export async function POST(request) {
  if (!mobEnabled()) return fail('MOB_DISABLED');
  const who = await moderator(request);
  if (who.error) return who.error;
  const body = await request.json().catch(() => null);
  const id = Number(body?.id);
  if (!Number.isSafeInteger(id) || id <= 0 || (body.remove !== undefined && typeof body.remove !== 'boolean')) return fail('BODY_INVALID');
  try {
    const result = await resolveMobReport(id, { remove: body.remove === true });
    if (result === 'not_found') return Response.json({ error: { code: 'NOT_FOUND', message: 'That report is not there any more.' } }, { status: 404, headers });
    return Response.json({ result }, { headers });
  } catch { return fail('UNAVAILABLE'); }
}
