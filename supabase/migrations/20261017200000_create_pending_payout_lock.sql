-- MockMob: serialise public.create_pending_payout per creator (security review 17 Oct 2026, group 6).
-- NOT APPLIED to production by the branch that wrote it; the main session applies it under the owner's grant.
--
-- Before: the function summed the unpaid earnings, inserted a 'paid' payouts row, then stamped payout_id on the
-- payments. Two calls for the same creator at the same moment (an admin double-click, two admins) both read the same
-- unpaid sum and both inserted a 'paid' payout for the full amount; only one of them linked the payments.
--
-- Now the first statement takes a transaction-scoped advisory lock keyed on the creator. A second call waits until the
-- first commits; under READ COMMITTED its SELECT then takes a fresh snapshot, finds payout_id already set on every
-- payment, and raises 'No unpaid earnings' (no_data_found), which POST /api/admin/payouts already reports as nothing to
-- pay. Calls for different creators do not wait for each other.
--
-- The body is otherwise the production body read on 17 Oct 2026 (search_path pinned by 20261016170300). CREATE OR
-- REPLACE keeps the ACL; the revoke and grant are repeated so the end state does not depend on history.
-- Idempotent. Undo: supabase/undo/20261017200000_create_pending_payout_lock.undo.sql.

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
  -- One payout run per creator at a time; released at commit or rollback.
  PERFORM pg_advisory_xact_lock(hashtextextended('create_pending_payout:' || coalesce(p_creator_id, ''), 0));

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

REVOKE ALL ON FUNCTION public.create_pending_payout(text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.create_pending_payout(text, text) TO service_role;
