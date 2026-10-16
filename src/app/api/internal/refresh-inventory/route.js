import { sameSecret as same } from '@/lib/server/secretCompare';
import { refreshInventorySnapshot } from '@/lib/server/inventory';
import { refreshCohortStats, describeCohortRun } from '@/lib/server/cohortStats';
import { supabaseAdmin } from '@/lib/supabase';
import { refreshStaleNtaIndexes, describeNtaIndexRun } from '@/../data/nta_index';
import { isFullBankReadBlocked } from '@/../data/full_bank_guard';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export const maxDuration = 300;

// The function may run 300 s (maxDuration). The passes run in order: inventory, NTA index, cohort table.
// The NTA index pass stops starting subjects at 200 s after the request began (one subject is a few seconds), so
// the cohort pass, which needs about 15 s and is capped by COHORT_DEADLINE_FROM_START_MS below, always has room.
const NTA_INDEX_DEADLINE_FROM_START_MS = 200000;

function authorised(request) {
  const cron = process.env.CRON_SECRET;
  const internal = process.env.INTERNAL_API_SECRET;
  if (cron && same(request.headers.get('authorization'), `Bearer ${cron}`)) return true;
  return Boolean(internal) && same(request.headers.get('x-internal-secret'), internal);
}

// The NTA index safety rebuild (data/nta_index.js refreshStaleNtaIndexes). It rides on this cron because
// vercel.json has no room for another one. It never changes this route's status code: the inventory refresh
// is what this cron is for, and a stale or failed index is already harmless (the NTA pool falls back to the
// full read while an index is older than its newest question). A failure is logged with console.error and
// is in the response body under ntaIndex.
async function refreshNtaIndex(startedAt) {
  const began = Date.now();
  try {
    const result = await refreshStaleNtaIndexes(supabaseAdmin(), {
      secret: process.env.CUET_EVIDENCE_SIGNING_KEY,
      deadlineMs: Math.max(0, NTA_INDEX_DEADLINE_FROM_START_MS - (began - startedAt)),
    });
    const line = describeNtaIndexRun(result, { ms: Date.now() - began });
    if (result.status === 'partial') console.error(line); else console.info(line);
    return { status: result.status, reason: result.reason, rebuilt: result.rebuilt ?? 0, subjects: result.subjects };
  } catch (error) {
    console.error(`[nta-index] daily refresh failed: ${error?.message || 'unknown error'}`);
    return { status: 'failed', subjects: [] };
  }
}

// The cohort table refresh (the database rebuilds question_option_stats) gets
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

// Vercel cron (see vercel.json) refreshes the public inventory snapshot once a day (3:00 AM IST), then the
// NTA question index (nta_question_index): see refreshNtaIndex, then the cohort table: see refreshCohortTable.
// The inventory refresh is the only place the counts are recomputed: requests serve the stored row and never
// refresh it. The passes read the whole bank or whole subjects, so they run only on Vercel production
// (data/full_bank_guard.js).
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
  const ntaIndex = await refreshNtaIndex(startedAt);
  const cohortStats = await refreshCohortTable(startedAt);
  if (inventoryFailed) {
    return Response.json({ error: 'inventory_unavailable', message: 'The inventory could not be refreshed.', ntaIndex, cohortStats }, { status: 503, headers });
  }
  return Response.json({ ok: true, bankSize: inventory.bankSize, checkedAt: inventory.checkedAt, ntaIndex, cohortStats }, { headers });
}
