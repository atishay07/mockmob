import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

const ACTIVE_EVENTS = new Set([
  'subscription.active',
  'subscription.paid',
  'payment.success',
  'checkout.success',
]);

const INACTIVE_EVENTS = new Set([
  'subscription.cancelled',
  'subscription.canceled',
  'subscription.expired',
  'payment.failed',
]);

export async function POST(request) {
  try {
    const secret = process.env.BILLING_WEBHOOK_SECRET;
    if (secret) {
      const provided = request.headers.get('x-mockmob-signature');
      if (provided !== secret) {
        return NextResponse.json({ error: 'Invalid webhook signature' }, { status: 401 });
      }
    }

    const body = await request.json();
    const event = body?.event || body?.type;
    const userId = body?.userId || body?.user_id || body?.metadata?.userId || body?.metadata?.user_id;
    const email = body?.email || body?.customer_email || body?.metadata?.email;

    if (!event || (!userId && !email)) {
      return NextResponse.json({ error: 'event and user identity are required' }, { status: 400 });
    }

    const subscriptionStatus = ACTIVE_EVENTS.has(event)
      ? 'active'
      : INACTIVE_EVENTS.has(event)
        ? 'cancelled'
        : body?.subscriptionStatus || body?.subscription_status;

    if (!['active', 'free', 'cancelled', 'past_due'].includes(subscriptionStatus)) {
      return NextResponse.json({ error: 'Unsupported subscription event' }, { status: 422 });
    }

    let query = supabaseAdmin().from('users').update({ subscription_status: subscriptionStatus });
    query = userId ? query.eq('id', userId) : query.eq('email', email);
    const { data, error } = await query.select('id, subscription_status').maybeSingle();
    if (error) throw error;
    if (!data) return NextResponse.json({ error: 'User not found' }, { status: 404 });

    return NextResponse.json({
      ok: true,
      userId: data.id,
      subscriptionStatus: data.subscription_status,
      isPremium: data.subscription_status === 'active',
    });
  } catch (e) {
    console.error('[api/billing/webhook] POST failed:', e);
    return NextResponse.json({ error: 'Failed to update subscription' }, { status: 500 });
  }
}
