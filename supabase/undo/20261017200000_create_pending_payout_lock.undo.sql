-- Undo for supabase/migrations/20261017200000_create_pending_payout_lock.sql. NOT a migration: it lives outside
-- supabase/migrations on purpose, so the Supabase CLI never applies it by itself.
-- Restores the production body read on 17 Oct 2026 (no advisory lock). Grants are unchanged by either file.

CREATE OR REPLACE FUNCTION public.create_pending_payout(p_creator_id text, p_actor_id text)
 RETURNS text
 LANGUAGE plpgsql
 SET search_path TO 'public', 'pg_temp'
AS $function$
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
$function$;
