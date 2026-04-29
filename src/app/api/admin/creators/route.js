import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin/roles';
import { writeAudit } from '@/lib/admin/audit';
import { Database } from '@/../data/db';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const CODE_PATTERN = /^[a-z0-9._-]{1,64}$/;
const OFFER_PATTERN = /^offer_[A-Za-z0-9]{6,40}$/;

export async function GET() {
  const guard = await requireAdmin();
  if (!guard.ok) return NextResponse.json({ error: guard.reason }, { status: guard.status });

  const [creators, stats] = await Promise.all([
    Database.listCreators(),
    Database.getCreatorStats(),
  ]);

  const statsById = new Map(stats.map((s) => [s.creatorId, s]));
  const enriched = creators.map((c) => ({
    ...c,
    stats: statsById.get(c.id) || {
      creatorId: c.id,
      totalSales: 0,
      totalRevenuePaise: 0,
      totalEarningsPaise: 0,
      pendingPayoutPaise: 0,
      paidPayoutPaise: 0,
    },
  }));

  return NextResponse.json({ creators: enriched });
}

export async function POST(request) {
  const guard = await requireAdmin();
  if (!guard.ok) return NextResponse.json({ error: guard.reason }, { status: guard.status });

  const body = await request.json().catch(() => ({}));
  const name = String(body.name || '').trim();
  const email = body.email ? String(body.email).trim().toLowerCase() : null;
  const code = String(body.code || '').trim().toLowerCase();
  const offerId = body.offerId ? String(body.offerId).trim() : null;
  const payoutPerSale = Number.isFinite(Number(body.payoutPerSale))
    ? Math.round(Number(body.payoutPerSale))
    : 2000;

  if (!name) return NextResponse.json({ error: 'name is required' }, { status: 400 });
  if (!code || !CODE_PATTERN.test(code)) {
    return NextResponse.json({ error: 'code must be 1-64 chars [a-z0-9._-]' }, { status: 400 });
  }
  if (offerId && !OFFER_PATTERN.test(offerId)) {
    return NextResponse.json({ error: 'offerId must look like offer_XXXXXXXX' }, { status: 400 });
  }
  if (payoutPerSale < 0) {
    return NextResponse.json({ error: 'payoutPerSale must be >= 0 (paise)' }, { status: 400 });
  }

  const existing = await Database.getCreatorByCode(code);
  if (existing) return NextResponse.json({ error: 'code already exists' }, { status: 409 });

  let creator;
  try {
    creator = await Database.createCreator({
      name,
      email,
      code,
      offerId,
      payoutPerSale,
      isActive: body.isActive !== false,
      notes: body.notes || null,
    });
  } catch (err) {
    if (err?.code === '23505') {
      return NextResponse.json({ error: 'code already exists' }, { status: 409 });
    }
    throw err;
  }

  await writeAudit({
    actorId: guard.session.user.id,
    actorEmail: guard.session.user.email,
    actorRole: 'admin',
    action: 'creator.create',
    targetType: 'creator',
    targetId: creator.id,
    metadata: { code: creator.code, payoutPerSale: creator.payoutPerSale, offerId: creator.offerId },
  });

  return NextResponse.json({ creator }, { status: 201 });
}
