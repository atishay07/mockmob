import 'server-only';
import { supabaseAdmin } from '@/lib/supabase';
import { isMissingFunction } from './aiWalletState';

/**
 * A captured practice-credit purchase goes through the atomic grant RPC only (public.mm_grant_practice_credits, migration
 * 20261018200000_practice_credit_packs.sql). The checkout verify and the Razorpay webhook both call it with the same payment
 * id, so one payment adds credits once. A missing RPC is a 503, never a direct balance write.
 */
export async function grantPurchasedPracticeCredits({ userId, credits, packId, paymentId }) {
  const amount = Math.max(0, Math.round(Number(credits) || 0));
  if (!userId) return { ok: false, error: 'missing_user', status: 400 };
  if (!paymentId) return { ok: false, error: 'missing_payment', status: 400 };
  if (amount <= 0) return { ok: false, error: 'invalid_credit_amount', status: 400 };
  try {
    const { data, error } = await supabaseAdmin().rpc('mm_grant_practice_credits', {
      p_user_id: userId,
      p_amount: amount,
      p_payment_id: paymentId,
      p_pack_id: packId || null,
    });
    if (error) {
      return isMissingFunction(error)
        ? { ok: false, error: 'practice_credit_grant_rpc_required', status: 503 }
        : { ok: false, error: error.message || 'practice_credit_grant_failed', status: 500 };
    }
    if (!data?.ok) return { ok: false, error: data?.error || 'practice_credit_grant_failed', status: 500 };
    return { ok: true, granted: Number(data.granted || amount), balance: Number(data.balance ?? 0), idempotent: Boolean(data.idempotent) };
  } catch (err) {
    return isMissingFunction(err)
      ? { ok: false, error: 'practice_credit_grant_rpc_required', status: 503 }
      : { ok: false, error: err?.message || 'practice_credit_grant_failed', status: 500 };
  }
}
