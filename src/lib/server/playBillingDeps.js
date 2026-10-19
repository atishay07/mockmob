import 'server-only';
// Production wiring for the Google Play billing handlers (playBillingHttp.js): Supabase for the store, the shared Google
// client for Play, the persistent rate limiter, and webhook_events (provider 'google_play') for once-per-message processing.
import { auth } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase';
import { Database } from '@/../data/db';
import { checkPersistentRateLimit } from '@/lib/server/rateLimit';
import { countStepOnce } from '@/lib/server/funnelOnceStore';
import { playClient } from '@/lib/payments/playGoogle';
import { createCertSource } from '@/lib/payments/playRtdn';
import { playBillingEnabled } from '@/lib/payments/playBilling';

const COLUMNS = 'purchase_token,order_id,user_id,product_id,kind,state,granted,acknowledged_at,consumed_at,voided_at';
// The subscription columns (migration 20261019210000). Read when present; a database without them still serves packs.
const SUB_COLUMNS = `${COLUMNS},access_until,sub_state,expiry_time,auto_renewing,linked_purchase_token,superseded_by`;
const missingColumn = (error) => /column .* does not exist|schema cache/i.test(error?.message || '') || error?.code === '42703' || error?.code === 'PGRST204';

async function rpc(name, params) {
  const { data, error } = await supabaseAdmin().rpc(name, params);
  if (error) throw error;
  return data;
}

/** The play_purchases database, as the billing core wants it. */
export const playStore = {
  async getByToken(purchaseToken) {
    let { data, error } = await supabaseAdmin().from('play_purchases').select(SUB_COLUMNS).eq('purchase_token', purchaseToken).maybeSingle();
    if (error && missingColumn(error)) {
      ({ data, error } = await supabaseAdmin().from('play_purchases').select(COLUMNS).eq('purchase_token', purchaseToken).maybeSingle());
    }
    if (error) throw error;
    return data || null;
  },
  grant: (g) => rpc('mm_play_grant_purchase', {
    p_user_id: g.userId, p_purchase_token: g.purchaseToken, p_order_id: g.orderId, p_product_id: g.productId, p_kind: g.kind,
    p_credits: g.credits, p_access_until: g.accessUntil, p_raw: g.raw || {},
  }),
  async markFinished(purchaseToken, { acknowledged = false, consumed = false } = {}) {
    const stamp = new Date().toISOString();
    const patch = { updated_at: stamp };
    if (acknowledged) patch.acknowledged_at = stamp;
    if (consumed) patch.consumed_at = stamp;
    const { error } = await supabaseAdmin().from('play_purchases').update(patch).eq('purchase_token', purchaseToken);
    if (error) throw error;
  },
  /** One subscription, as Google holds it now, and the user's plan with it (mm_play_sync_subscription, one transaction). */
  syncSubscription: (x) => rpc('mm_play_sync_subscription', {
    p_user_id: x.userId || null, p_purchase_token: x.purchaseToken, p_product_id: x.productId, p_state: x.state,
    p_expiry: x.expiresAt || null, p_auto_renewing: typeof x.autoRenewing === 'boolean' ? x.autoRenewing : null,
    p_linked_token: x.linkedToken || null, p_order_id: x.orderId || null, p_base_plan_id: x.basePlanId || null,
    p_raw: x.raw || {}, p_reason: x.reason || null,
  }),
  revoke: (r) => rpc('mm_play_revoke_purchase', { p_purchase_token: r.purchaseToken, p_reason: r.reason || 'voided', p_order_id: r.orderId || null, p_raw: r.raw || {} }),
};

const certs = createCertSource();

export function playVerifyDeps(request) {
  const google = playClient();
  return {
    enabled: () => playBillingEnabled(),
    auth: (request) => auth(request),
    rateLimit: checkPersistentRateLimit,
    billing: {
      store: playStore,
      google,
      packageName: google.packageName(),
      // Aggregate funnel: first captured payment of this student (once per person; no-op while FUNNEL_ENABLED is off).
      onGranted: async ({ userId }) => { countStepOnce(userId, 'payment_captured', request?.headers || null); },
    },
  };
}

export function playRtdnDeps() {
  const google = playClient();
  return {
    enabled: () => playBillingEnabled(),
    certs,
    // Subscriptions are re-read from Google on every notification, so the RTDN core gets the Google client too.
    billing: { store: playStore, google, packageName: google.packageName() },
    claimEvent: ({ eventId, eventType, payload }) => Database.claimWebhookEvent({ eventId, eventType, payload, provider: 'google_play' }),
    markProcessed: (eventId, note) => Database.markWebhookEventProcessed(eventId, note),
    markFailed: (eventId, message) => Database.markWebhookEventFailed(eventId, message),
  };
}
