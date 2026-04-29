import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin/roles';
import { Database } from '@/../data/db';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(request) {
  const guard = await requireAdmin();
  if (!guard.ok) return NextResponse.json({ error: guard.reason }, { status: guard.status });

  const url = new URL(request.url);
  const limit = Math.min(Math.max(Number(url.searchParams.get('limit')) || 100, 1), 500);
  const offset = Math.max(Number(url.searchParams.get('offset')) || 0, 0);

  const orders = await Database.listOrders({ limit, offset });
  return NextResponse.json({ orders });
}
