-- ============================================================
-- Robust referral attribution
--
-- Razorpay only changes checkout/payment evidence when a subscription has
-- an offer_id. These fields keep first-party referral evidence even when a
-- valid creator code has no discount offer, or when a user entered an
-- inactive/unknown code.
-- ============================================================

BEGIN;

ALTER TABLE public.payments
  ADD COLUMN IF NOT EXISTS referral_code_attempted TEXT,
  ADD COLUMN IF NOT EXISTS referral_status TEXT NOT NULL DEFAULT 'none',
  ADD COLUMN IF NOT EXISTS referral_reason TEXT;

ALTER TABLE public.payments
  DROP CONSTRAINT IF EXISTS payments_referral_status_check;

ALTER TABLE public.payments
  ADD CONSTRAINT payments_referral_status_check
  CHECK (referral_status IN (
    'none',
    'offer_attached',
    'tracked_no_offer',
    'inactive',
    'unknown'
  ));

UPDATE public.payments
   SET referral_code_attempted = COALESCE(referral_code_attempted, creator_code),
       referral_status = CASE
         WHEN referral_status IS DISTINCT FROM 'none' THEN referral_status
         WHEN creator_code IS NOT NULL AND offer_id IS NOT NULL THEN 'offer_attached'
         WHEN creator_code IS NOT NULL THEN 'tracked_no_offer'
         ELSE 'none'
       END,
       referral_reason = COALESCE(
         referral_reason,
         CASE
           WHEN creator_code IS NOT NULL AND offer_id IS NOT NULL THEN 'Backfilled from existing creator offer attribution'
           WHEN creator_code IS NOT NULL THEN 'Backfilled from existing creator attribution without offer'
           ELSE NULL
         END
       )
 WHERE referral_status = 'none'
    OR referral_code_attempted IS NULL
    OR referral_reason IS NULL;

CREATE INDEX IF NOT EXISTS payments_referral_status_idx
  ON public.payments (referral_status, created_at DESC)
  WHERE referral_status <> 'none';

CREATE INDEX IF NOT EXISTS payments_referral_attempted_idx
  ON public.payments (lower(btrim(referral_code_attempted)))
  WHERE referral_code_attempted IS NOT NULL;

CREATE OR REPLACE FUNCTION public.create_pending_payout(
  p_creator_id TEXT,
  p_actor_id   TEXT
)
RETURNS TEXT
LANGUAGE plpgsql AS $$
DECLARE
  v_payout_id TEXT;
  v_amount    INTEGER;
  v_count     INTEGER;
BEGIN
  SELECT COALESCE(SUM(creator_earning), 0)::INTEGER, COUNT(*)::INTEGER
    INTO v_amount, v_count
    FROM public.payments
   WHERE creator_id = p_creator_id
     AND payout_id IS NULL
     AND payment_id IS NOT NULL
     AND amount_paid > 0
     AND status IN ('captured', 'completed', 'paid')
     AND COALESCE(creator_earning, 0) > 0;

  IF v_amount <= 0 OR v_count = 0 THEN
    RAISE EXCEPTION 'No unpaid earnings for creator %', p_creator_id
      USING ERRCODE = 'no_data_found';
  END IF;

  INSERT INTO public.payouts (creator_id, amount, payment_count, status, paid_at, marked_paid_by)
  VALUES (p_creator_id, v_amount, v_count, 'paid', NOW(), p_actor_id)
  RETURNING id INTO v_payout_id;

  UPDATE public.payments
     SET payout_id = v_payout_id
   WHERE creator_id = p_creator_id
     AND payout_id IS NULL
     AND payment_id IS NOT NULL
     AND amount_paid > 0
     AND status IN ('captured', 'completed', 'paid')
     AND COALESCE(creator_earning, 0) > 0;

  RETURN v_payout_id;
END;
$$;

COMMIT;
