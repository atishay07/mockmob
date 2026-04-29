import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin/roles';
import { Database } from '@/../data/db';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET() {
  const guard = await requireAdmin();
  if (!guard.ok) return NextResponse.json({ error: guard.reason }, { status: guard.status });

  const overview = await Database.getPlatformOverview();
  return NextResponse.json({ overview });
}
