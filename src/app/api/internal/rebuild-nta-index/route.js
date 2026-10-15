import { timingSafeEqual } from 'node:crypto';
import { supabaseAdmin } from '@/lib/supabase';
import { refreshStaleNtaIndexes, NTA_INDEX_SUBJECTS } from '@/../data/nta_index';
import { isFullBankReadBlocked } from '@/../data/full_bank_guard';
import { toInternalSubjectId } from '@/../data/cuet_controls';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export const maxDuration = 300;

function same(a, b) {
  const x = Buffer.from(String(a || ''));
  const y = Buffer.from(String(b || ''));
  return x.length > 0 && x.length === y.length && timingSafeEqual(x, y);
}

function authorised(request) {
  const cron = process.env.CRON_SECRET;
  const internal = process.env.INTERNAL_API_SECRET;
  if (cron && same(request.headers.get('authorization'), `Bearer ${cron}`)) return true;
  return Boolean(internal) && same(request.headers.get('x-internal-secret'), internal);
}

// Vercel cron (see vercel.json) keeps nta_question_index current once a day (3:30 AM IST): any subject whose
// index is older than its newest live question is rebuilt, one subject at a time. Publishing already rebuilds
// the subjects it touches and the NTA pool falls back to the full read while an index is stale, so this is the
// safety net for questions published by other paths (the factory, moderation). Runs only on Vercel production
// (data/full_bank_guard.js). ?subject=<id> limits a manual run to one subject.
async function run(request) {
  const headers = { 'Cache-Control': 'no-store' };
  if (!authorised(request)) return Response.json({ error: 'forbidden', message: 'Not allowed.' }, { status: 403, headers });
  const only = new URL(request.url).searchParams.get('subject');
  const internal = only ? toInternalSubjectId(only) : null;
  if (internal && !NTA_INDEX_SUBJECTS.includes(internal)) return Response.json({ error: 'unknown_subject', message: 'Not an NTA subject.' }, { status: 400, headers });
  try {
    const result = await refreshStaleNtaIndexes(supabaseAdmin(), {
      secret: process.env.CUET_EVIDENCE_SIGNING_KEY,
      subjects: internal ? [internal] : NTA_INDEX_SUBJECTS,
    });
    console.info(`[nta-index] daily refresh ${result.status}: ${JSON.stringify(result.subjects.map((s) => [s.subject, s.skipped || s.error || `rebuilt ${s.indexed}`]))}`);
    return Response.json({ ok: result.status === 'ok' || result.status === 'skipped', ...result }, { headers });
  } catch (error) {
    if (isFullBankReadBlocked(error)) {
      return Response.json({ error: 'full_bank_read_blocked', message: 'The NTA index rebuild runs only on Vercel production. Nothing was changed.' }, { status: 409, headers });
    }
    console.error(`[nta-index] daily refresh failed: ${error?.message || 'unknown error'}`);
    return Response.json({ error: 'nta_index_unavailable', message: 'The NTA index could not be refreshed.' }, { status: 503, headers });
  }
}

// Vercel cron issues GET with Authorization: Bearer ${CRON_SECRET}; POST serves the internal header.
export const GET = run;
export const POST = run;
