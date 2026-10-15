import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { Database } from '@/../data/db';
import { checkRateLimit } from '@/lib/server/rateLimit';
import { loadRuleSources, writeRule } from '@/lib/server/ruleBook';
import { PLAYBOOK_COPY, parseSubject, playbookBody, postPlaybook } from '@/lib/server/playbook';

export const dynamic = 'force-dynamic';
const NO_STORE = { 'Cache-Control': 'no-store' };
const unavailable = () => NextResponse.json({ error: 'unavailable', message: PLAYBOOK_COPY.unavailable }, { status: 503, headers: NO_STORE });

// The rule in force for the student's next mock, and the two strings MockMob's own sheet shows before the clock starts
// (spec tmp/mistake-lab-v4/SPEC.md 4.12). `?subject=` (the paper about to start) leaves out a repair rule of another subject.
export async function GET(request) {
  const session = await auth(request);
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers: NO_STORE });
  const subject = parseSubject(new URL(request.url).searchParams.get('subject'));
  if (subject === undefined) return NextResponse.json({ error: 'invalid_request', message: 'subject must be a subject id.' }, { status: 422, headers: NO_STORE });
  try {
    const attempts = await Database.getAttempts(session.user.id);
    const sources = await loadRuleSources(session.user.id, attempts);
    return NextResponse.json(playbookBody({ attempts, sources, subject }), { headers: NO_STORE });
  } catch (e) {
    console.warn('[api/me/playbook] GET failed:', e?.message);
    return unavailable();
  }
}

// "Use in my next mock": POST { ruleId } keeps that rule as the one in force (one per student, idempotent).
export async function POST(request) {
  const session = await auth(request);
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers: NO_STORE });
  if (!checkRateLimit(request, { route: '/api/me/playbook', limit: 20, keyParts: [session.user.id] }).allowed) {
    return NextResponse.json({ error: 'Too many requests' }, { status: 429, headers: NO_STORE });
  }
  const body = await request.json().catch(() => null);
  try {
    const userId = session.user.id;
    const attempts = await Database.getAttempts(userId);
    const sources = await loadRuleSources(userId, attempts);
    const out = await postPlaybook({ body, attempts, sources, write: (rule, opts) => writeRule(userId, rule, opts) });
    return NextResponse.json(out.body, { status: out.status, headers: NO_STORE });
  } catch (e) {
    console.warn('[api/me/playbook] POST failed:', e?.message);
    return unavailable();
  }
}
