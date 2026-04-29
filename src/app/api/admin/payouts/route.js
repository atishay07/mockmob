import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin/roles';
import { writeAudit } from '@/lib/admin/audit';
import { Database } from '@/../data/db';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET() {
  const guard = await requireAdmin();
  if (!guard.ok) return NextResponse.json({ error: guard.reason }, { status: guard.status });

  // "Pending" is computed live from payments; "history" is the payouts table.
  const [stats, history, creators] = await Promise.all([
    Database.getCreatorStats(),
    Database.listPayouts({ limit: 200 }),
    Database.listCreators(),
  ]);

  const creatorsById = new Map(creators.map((c) => [c.id, c]));
  const pending = stats
    .filter((s) => s.pendingPayoutPaise > 0)
    .map((s) => ({
      creatorId: s.creatorId,
      creator: creatorsById.get(s.creatorId) || null,
      pendingPaise: s.pendingPayoutPaise,
      paidPaise: s.paidPayoutPaise,
    }))
    .sort((a, b) => b.pendingPaise - a.pendingPaise);

  const enrichedHistory = history.map((p) => ({
    ...p,
    creator: creatorsById.get(p.creatorId) || null,
  }));

  return NextResponse.json({ pending, history: enrichedHistory });
}

export async function POST(request) {
  const guard = await requireAdmin();
  if (!guard.ok) return NextResponse.json({ error: guard.reason }, { status: guard.status });

  const body = await request.json().catch(() => ({}));
  const creatorId = String(body.creatorId || '').trim();
  if (!creatorId) return NextResponse.json({ error: 'creatorId required' }, { status: 400 });

  let payoutId;
  try {
    payoutId = await Database.createPayoutForCreator(creatorId, guard.session.user.id);
  } catch (err) {
    if (err?.code === 'no_data_found' || /No unpaid earnings/i.test(err?.message || '')) {
      return NextResponse.json({ error: 'No unpaid earnings for this creator' }, { status: 400 });
    }
    throw err;
  }

  await writeAudit({
    actorId: guard.session.user.id,
    actorEmail: guard.session.user.email,
    actorRole: 'admin',
    action: 'payout.mark_paid',
    targetType: 'creator',
    targetId: creatorId,
    metadata: { payoutId },
  });

  return NextResponse.json({ ok: true, payoutId });
}
