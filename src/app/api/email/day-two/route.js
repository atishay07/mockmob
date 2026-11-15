import { sameSecret as same } from '@/lib/server/secretCompare';
import { runDayTwoJob } from '@/lib/email/studentMailServer';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

// The day-2 email (src/lib/email): Vercel cron, once a day at 12:30 UTC (about 6:00 pm India time; Hobby crons fire within the
// hour). Does nothing unless EMAILS_ENABLED is "true", and sends only between 5:00 pm and 9:00 pm India time whoever calls it.
// The answer holds counts only.

function authorised(request) {
  const cron = process.env.CRON_SECRET;
  const internal = process.env.INTERNAL_API_SECRET;
  if (cron && same(request.headers.get('authorization'), `Bearer ${cron}`)) return true;
  return Boolean(internal) && same(request.headers.get('x-internal-secret'), internal);
}

async function run(request) {
  const headers = { 'Cache-Control': 'no-store' };
  if (!authorised(request)) return Response.json({ error: 'forbidden', message: 'Not allowed.' }, { status: 403, headers });
  try {
    return Response.json(await runDayTwoJob(), { headers });
  } catch {
    return Response.json({ error: 'day_two_unavailable', message: 'The day-2 email job could not run.' }, { status: 503, headers });
  }
}

// Vercel cron issues GET with Authorization: Bearer ${CRON_SECRET}; POST serves the internal header.
export const GET = run;
export const POST = run;
