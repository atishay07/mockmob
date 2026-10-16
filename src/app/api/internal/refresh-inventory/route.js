import { timingSafeEqual } from 'node:crypto';
import { refreshInventorySnapshot } from '@/lib/server/inventory';
import { refreshCohortStats, describeCohortRun } from '@/lib/server/cohortStats';
import { isFullBankReadBlocked } from '@/../data/full_bank_guard';

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

// The function may run 300 s (maxDuration). The cohort table refresh (the database rebuilds question_option_stats) gets
// whatever is left of 250 s after the request began, and at most 120 s, which is the database function's own limit.
const COHORT_DEADLINE_FROM_START_MS = 250000;
const COHORT_MAX_BUDGET_MS = 120000;

// The cohort table refresh (src/lib/server/cohortStats.js refreshCohortStats). It rides on this cron because vercel.json
// has no room for another one. It never changes this route's status code: the inventory refresh is what this cron is
// for, and a missing or old table is already harmless (the result page reads the committed snapshot of other students'
// picks while the table is missing or older than 48 hours). A failure is logged and is in the response body under cohortStats.
async function refreshCohortTable(startedAt) {
  try {
    const result = await refreshCohortStats({ budgetMs: Math.max(0, Math.min(COHORT_MAX_BUDGET_MS, COHORT_DEADLINE_FROM_START_MS - (Date.now() - startedAt))) });
    const line = describeCohortRun(result);
    if (result.status === 'ok' || result.status === 'skipped' || result.status === 'blocked' || result.status === 'missing') console.info(line); else console.error(line);
    return { status: result.status, ...(result.status === 'ok' ? { questions: result.questions, withTime: result.withTime } : {}) };
  } catch (error) {
    console.error(`[cohort-stats] daily refresh failed: ${error?.message || 'unknown error'}`);
    return { status: 'failed' };
  }
}

// Vercel cron (see vercel.json) refreshes the public inventory snapshot once a day (3:00 AM IST), then the cohort table.
// The inventory refresh is the only place the counts are recomputed: requests serve the stored row and never refresh it.
// The refresh reads the whole bank, so it runs only on Vercel production (data/full_bank_guard.js).
export async function GET(request) {
  const headers = { 'Cache-Control': 'no-store' };
  if (!authorised(request)) return Response.json({ error: 'forbidden', message: 'Not allowed.' }, { status: 403, headers });
  const startedAt = Date.now();
  let inventory = null;
  let inventoryFailed = false;
  try {
    inventory = await refreshInventorySnapshot();
    console.info(`[inventory] daily refresh stored ${inventory.bankSize} questions at ${inventory.checkedAt}`);
  } catch (error) {
    if (isFullBankReadBlocked(error)) {
      return Response.json({ error: 'full_bank_read_blocked', message: 'The whole-bank refresh runs only on Vercel production. The stored counts are unchanged.' }, { status: 409, headers });
    }
    inventoryFailed = true;
    console.error(`[inventory] daily refresh failed: ${error?.message || 'unknown error'}`);
  }
  const cohortStats = await refreshCohortTable(startedAt);
  if (inventoryFailed) {
    return Response.json({ error: 'inventory_unavailable', message: 'The inventory could not be refreshed.', cohortStats }, { status: 503, headers });
  }
  return Response.json({ ok: true, bankSize: inventory.bankSize, checkedAt: inventory.checkedAt, cohortStats }, { headers });
}
