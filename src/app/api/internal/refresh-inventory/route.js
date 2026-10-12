import { timingSafeEqual } from 'node:crypto';
import { refreshInventorySnapshot } from '@/lib/server/inventory';

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

// Vercel cron (see vercel.json) refreshes the public inventory snapshot once a day (3:00 AM IST);
// between runs, publicInventory refreshes a snapshot older than 15 minutes after a response.
export async function GET(request) {
  const headers = { 'Cache-Control': 'no-store' };
  if (!authorised(request)) return Response.json({ error: 'forbidden', message: 'Not allowed.' }, { status: 403, headers });
  try {
    const value = await refreshInventorySnapshot();
    return Response.json({ ok: true, bankSize: value.bankSize, checkedAt: value.checkedAt }, { headers });
  } catch {
    return Response.json({ error: 'inventory_unavailable', message: 'The inventory could not be refreshed.' }, { status: 503, headers });
  }
}
