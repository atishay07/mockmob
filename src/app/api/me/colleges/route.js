import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { listBody, parseEntry, parseList } from '@/lib/colleges/model.mjs';
import { addCollege, getColleges, removeCollege, replaceColleges } from '@/lib/server/myColleges';

// My colleges: one ordered list per student, up to 8. Bearer or cookie (the app and the website share it).
//   GET                                   -> the list
//   PUT    { colleges: [entry, ...] }      -> replaces the whole ordered list (the order sent is the order kept)
//   POST   entry                          -> adds at the end; 201 added, 200 already there, 409 list_full
//   DELETE ?programmeId=..&college=..     -> removes one; 200 even when it was not there (a retry is safe)
// entry = { programmeId, programme?, college }. Every success answers { colleges, count, max }.
export const dynamic = 'force-dynamic';
const NO_STORE = { 'Cache-Control': 'no-store' };
const unauthorized = () => NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers: NO_STORE });
const invalid = (message) => NextResponse.json({ error: 'invalid_request', message }, { status: 422, headers: NO_STORE });
const unavailable = () => NextResponse.json({ error: 'unavailable' }, { status: 503, headers: NO_STORE });
const ok = (rows, status = 200, extra = {}) => NextResponse.json({ ...listBody(rows), ...extra }, { status, headers: NO_STORE });

export async function GET(request) {
  const session = await auth(request);
  if (!session?.user?.id) return unauthorized();
  try { return ok(await getColleges(session.user.id)); } catch { return unavailable(); }
}

export async function PUT(request) {
  const session = await auth(request);
  if (!session?.user?.id) return unauthorized();
  const body = await request.json().catch(() => null);
  const parsed = parseList(body);
  if (!parsed.ok) return invalid(parsed.message);
  try { return ok(await replaceColleges(session.user.id, parsed.list)); } catch { return unavailable(); }
}

export async function POST(request) {
  const session = await auth(request);
  if (!session?.user?.id) return unauthorized();
  const body = await request.json().catch(() => null);
  const parsed = parseEntry(body);
  if (!parsed.ok) return invalid(parsed.message);
  try {
    const result = await addCollege(session.user.id, parsed.entry);
    const rows = await getColleges(session.user.id);
    if (result === 'full') {
      return NextResponse.json({ error: 'list_full', message: 'My colleges is full. Remove one to add another.', ...listBody(rows) }, { status: 409, headers: NO_STORE });
    }
    return ok(rows, result === 'added' ? 201 : 200, { result });
  } catch { return unavailable(); }
}

export async function DELETE(request) {
  const session = await auth(request);
  if (!session?.user?.id) return unauthorized();
  const q = new URL(request.url).searchParams;
  const parsed = parseEntry({ programmeId: q.get('programmeId'), college: q.get('college') });
  if (!parsed.ok) return invalid(parsed.message);
  try {
    await removeCollege(session.user.id, parsed.entry);
    return ok(await getColleges(session.user.id));
  } catch { return unavailable(); }
}
