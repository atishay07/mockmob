import { timingSafeEqual } from 'node:crypto';
import { refreshInventorySnapshot } from '@/lib/server/inventory';
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

// Vercel cron (see vercel.json) refreshes the public inventory snapshot once a day (3:00 AM IST).
// This is the only place the counts are recomputed: requests serve the stored row and never refresh it.
// The refresh reads the whole bank, so it runs only on Vercel production (data/full_bank_guard.js).
export async function GET(request) {
  const headers = { 'Cache-Control': 'no-store' };
  if (!authorised(request)) return Response.json({ error: 'forbidden', message: 'Not allowed.' }, { status: 403, headers });
  try {
    const value = await refreshInventorySnapshot();
    console.info(`[inventory] daily refresh stored ${value.bankSize} questions at ${value.checkedAt}`);
    return Response.json({ ok: true, bankSize: value.bankSize, checkedAt: value.checkedAt }, { headers });
  } catch (error) {
    if (isFullBankReadBlocked(error)) {
      return Response.json({ error: 'full_bank_read_blocked', message: 'The whole-bank refresh runs only on Vercel production. The stored counts are unchanged.' }, { status: 409, headers });
    }
    console.error(`[inventory] daily refresh failed: ${error?.message || 'unknown error'}`);
    return Response.json({ error: 'inventory_unavailable', message: 'The inventory could not be refreshed.' }, { status: 503, headers });
  }
}
