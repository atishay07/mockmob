import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { registerDevice, revokeDevice } from '@/lib/server/appPrefs';

export const dynamic = 'force-dynamic';
const NO_STORE = { 'Cache-Control': 'no-store' };
const validToken = t => typeof t === 'string' && t.length >= 20 && t.length <= 4096 && !/\s/.test(t);

async function parse(request) {
  const session = await auth(request);
  if (!session?.user?.id) return { response: NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers: NO_STORE }) };
  const body = await request.json().catch(() => null);
  if (!body || !validToken(body.token)) return { response: NextResponse.json({ error: 'invalid_request', message: 'A device token is required.' }, { status: 422, headers: NO_STORE }) };
  return { userId: session.user.id, body };
}

// POST { token, appVersion }: upsert by token. A token seen on another account moves to this one.
export async function POST(request) {
  const { response, userId, body } = await parse(request);
  if (response) return response;
  const appVersion = typeof body.appVersion === 'string' ? body.appVersion.slice(0, 32) : null;
  try { await registerDevice(userId, body.token, appVersion); return NextResponse.json({ ok: true }, { headers: NO_STORE }); }
  catch { return NextResponse.json({ error: 'unavailable' }, { status: 503, headers: NO_STORE }); }
}

// DELETE { token }: stop sending to this device (sets revoked_at).
export async function DELETE(request) {
  const { response, userId, body } = await parse(request);
  if (response) return response;
  try { await revokeDevice(userId, body.token); return NextResponse.json({ ok: true }, { headers: NO_STORE }); }
  catch { return NextResponse.json({ error: 'unavailable' }, { status: 503, headers: NO_STORE }); }
}
