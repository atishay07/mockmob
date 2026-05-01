import 'server-only';
import { supabaseAdmin } from '@/lib/supabase';

/**
 * Atomically check + spend credits for AI features.
 *
 * Uses the public.mm_spend_credits_amount RPC defined in the
 * 2026_05_01_ai_mentor_rival.sql migration. Independent from the
 * existing fixed-cost spend_credits RPC so we can charge variable
 * amounts (1, 2, 3 credits) without modifying the original.
 *
 * Returns:
 *   { ok: true,  balance, charged }     on success
 *   { ok: false, error, balance?, required? }  on failure
 *
 * Premium-included usage should pass amount=0 to bypass charge while
 * still recording a successful transaction shape.
 */
export async function checkAndConsumeCredits({ userId, amount, action, reference }) {
  if (!userId) {
    return { ok: false, error: 'missing_user' };
  }
  if (!Number.isFinite(amount) || amount < 0) {
    return { ok: false, error: 'invalid_amount' };
  }
  if (amount === 0) {
    return { ok: true, balance: null, charged: 0, action, reference: reference || null };
  }

  const { data, error } = await supabaseAdmin().rpc('mm_spend_credits_amount', {
    p_user_id: userId,
    p_amount: Math.round(amount),
    p_action: action || 'ai_unspecified',
    p_reference: reference || `${action || 'ai'}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
  });

  if (error) {
    console.error('[credits] mm_spend_credits_amount RPC failed:', error);
    return { ok: false, error: 'rpc_failure' };
  }

  if (!data) {
    return { ok: false, error: 'rpc_no_data' };
  }
  if (data.ok === false) {
    return {
      ok: false,
      error: data.error || 'unknown_failure',
      balance: data.balance ?? 0,
      required: data.required ?? amount,
    };
  }

  return {
    ok: true,
    balance: data.balance ?? null,
    charged: data.charged ?? amount,
    action,
    reference: reference || null,
  };
}
