import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin/roles';
import { writeAudit } from '@/lib/admin/audit';
import { Database } from '@/../data/db';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const CODE_PATTERN = /^[a-z0-9._-]{1,64}$/;
const OFFER_PATTERN = /^offer_[A-Za-z0-9]{6,40}$/;

export async function PATCH(request, { params }) {
  const guard = await requireAdmin();
  if (!guard.ok) return NextResponse.json({ error: guard.reason }, { status: guard.status });
  const { id } = await params;
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 });

  const body = await request.json().catch(() => ({}));
  const updates = {};

  if ('name' in body) {
    const name = String(body.name || '').trim();
    if (!name) return NextResponse.json({ error: 'name cannot be empty' }, { status: 400 });
    updates.name = name;
  }
  if ('email' in body) {
    updates.email = body.email ? String(body.email).trim().toLowerCase() : null;
  }
  if ('code' in body) {
    const code = String(body.code || '').trim().toLowerCase();
    if (!CODE_PATTERN.test(code)) {
      return NextResponse.json({ error: 'code must be 1-64 chars [a-z0-9._-]' }, { status: 400 });
    }
    updates.code = code;
  }
  if ('offerId' in body) {
    const offerId = body.offerId ? String(body.offerId).trim() : null;
    if (offerId && !OFFER_PATTERN.test(offerId)) {
      return NextResponse.json({ error: 'offerId must look like offer_XXXXXXXX' }, { status: 400 });
    }
    updates.offerId = offerId;
  }
  if ('payoutPerSale' in body) {
    const value = Math.round(Number(body.payoutPerSale));
    if (!Number.isFinite(value) || value < 0) {
      return NextResponse.json({ error: 'payoutPerSale must be >= 0 (paise)' }, { status: 400 });
    }
    updates.payoutPerSale = value;
  }
  if ('isActive' in body) updates.isActive = Boolean(body.isActive);
  if ('notes' in body) updates.notes = body.notes ? String(body.notes) : null;

  let creator;
  try {
    creator = await Database.updateCreator(id, updates);
  } catch (err) {
    if (err?.code === '23505') {
      return NextResponse.json({ error: 'code already exists' }, { status: 409 });
    }
    throw err;
  }

  if (!creator) return NextResponse.json({ error: 'not found' }, { status: 404 });

  await writeAudit({
    actorId: guard.session.user.id,
    actorEmail: guard.session.user.email,
    actorRole: 'admin',
    action: 'creator.update',
    targetType: 'creator',
    targetId: id,
    metadata: { changes: Object.keys(updates) },
  });

  return NextResponse.json({ creator });
}

export async function DELETE(_request, { params }) {
  const guard = await requireAdmin();
  if (!guard.ok) return NextResponse.json({ error: guard.reason }, { status: guard.status });
  const { id } = await params;

  const creator = await Database.deleteCreator(id);
  if (!creator) return NextResponse.json({ error: 'not found' }, { status: 404 });

  await writeAudit({
    actorId: guard.session.user.id,
    actorEmail: guard.session.user.email,
    actorRole: 'admin',
    action: 'creator.deactivate',
    targetType: 'creator',
    targetId: id,
  });

  return NextResponse.json({ creator });
}
