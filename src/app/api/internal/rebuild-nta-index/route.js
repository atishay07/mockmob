import { timingSafeEqual } from 'node:crypto';
import { supabaseAdmin } from '@/lib/supabase';
import { refreshStaleNtaIndexes, describeNtaIndexRun, NTA_INDEX_SUBJECTS } from '@/../data/nta_index';
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

// A manual run of the NTA index safety rebuild. The daily run is part of /api/internal/refresh-inventory (the
// only cron entry it can use: vercel.json is at its limit), and this route is not in vercel.json. Anything that
// can sign in with the internal secret may call it (POST with x-internal-secret, or GET with the cron bearer):
//   ?subject=<id>  limits the run to one subject;
//   ?force=1       rebuilds every subject that has index rows, fresh or not (a rebuild of an unchanged
//                  subject writes the same rows, so it is safe to repeat; it costs one full read per subject).
// Without force, only subjects with newer questions, changed content or an index older than 7 days are rebuilt.
// Runs only on Vercel production (data/full_bank_guard.js). The signing key must be in the production environment.
async function run(request) {
  const headers = { 'Cache-Control': 'no-store' };
  if (!authorised(request)) return Response.json({ error: 'forbidden', message: 'Not allowed.' }, { status: 403, headers });
  const only = new URL(request.url).searchParams.get('subject');
  const internal = only ? toInternalSubjectId(only) : null;
  if (internal && !NTA_INDEX_SUBJECTS.includes(internal)) return Response.json({ error: 'unknown_subject', message: 'Not an NTA subject.' }, { status: 400, headers });
  const force = new URL(request.url).searchParams.get('force') === '1';
  const began = Date.now();
  try {
    const result = await refreshStaleNtaIndexes(supabaseAdmin(), {
      secret: process.env.CUET_EVIDENCE_SIGNING_KEY,
      subjects: internal ? [internal] : NTA_INDEX_SUBJECTS,
      ...(force ? { maxAgeMs: -1 } : {}),
    });
    console.info(describeNtaIndexRun(result, { ms: Date.now() - began }).replace('daily refresh', force ? 'manual forced refresh' : 'manual refresh'));
    return Response.json({ ok: result.status === 'ok' || result.status === 'skipped', ...result }, { headers });
  } catch (error) {
    if (isFullBankReadBlocked(error)) {
      return Response.json({ error: 'full_bank_read_blocked', message: 'The NTA index rebuild runs only on Vercel production. Nothing was changed.' }, { status: 409, headers });
    }
    console.error(`[nta-index] manual refresh failed: ${error?.message || 'unknown error'}`);
    return Response.json({ error: 'nta_index_unavailable', message: 'The NTA index could not be refreshed.' }, { status: 503, headers });
  }
}

// GET takes Authorization: Bearer ${CRON_SECRET}; POST takes the x-internal-secret header.
export const GET = run;
export const POST = run;
