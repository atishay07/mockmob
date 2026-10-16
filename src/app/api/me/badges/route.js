import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { getBadges } from '@/lib/server/badgesStore';

export const dynamic = 'force-dynamic';
const NO_STORE = { 'Cache-Control': 'no-store' };

// The 16 badges with dates and exact progress, from the student's own records. Contract:
// docs/design-decisions/badges-api-1016.md. Own rows only (the id comes from the session); private cache for a
// minute plus an ETag, so a repeat call that finds nothing new is a 304 with no body.
export async function GET(request) {
  const session = await auth(request);
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers: NO_STORE });
  try {
    const { body, etag } = await getBadges(session.user.id);
    const headers = { 'Cache-Control': 'private, max-age=60', ETag: etag, Vary: 'Authorization, Cookie' };
    if (request.headers.get('if-none-match') === etag) return new NextResponse(null, { status: 304, headers });
    return NextResponse.json(body, { headers });
  } catch { return NextResponse.json({ error: 'unavailable' }, { status: 503, headers: NO_STORE }); }
}
