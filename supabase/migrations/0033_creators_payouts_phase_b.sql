-- ============================================================
-- 0033 — Creator + payout system, Phase B
--
-- Adds:
--   1) creators.payout_per_sale (paise) — fixed earning per sale
--   2) payouts table (executed payout runs)
--   3) payments.creator_earning + payments.payout_id
--   4) Auto-link triggers: when a user signs up with an email matching
--      an active creator, role becomes 'creator' and creators.user_id
--      is set automatically. Backfills existing rows.
--   5) RPC: create_pending_payout(creator_id, actor_id) — bundles all
--      unpaid earnings into a single payouts row atomically.
--
-- Idempotent — safe to run repeatedly.
-- ============================================================

BEGIN;

-- ============================================================
-- 1) payout_per_sale on creators (paise; default ₹20 = 2000 paise)
-- ============================================================

ALTER TABLE public.creators
  ADD COLUMN IF NOT EXISTS payout_per_sale INTEGER NOT NULL DEFAULT 2000
                          CHECK (payout_per_sale >= 0);

-- ============================================================
-- 2) payouts table (must exist before payments.payout_id FK below)
-- ============================================================

CREATE TABLE IF NOT EXISTS public.payouts (
  id             TEXT PRIMARY KEY DEFAULT ('pyt_' || replace(gen_random_uuid()::text, '-', '')),
  creator_id     TEXT NOT NULL REFERENCES public.creators(id) ON DELETE RESTRICT,
  amount         INTEGER NOT NULL CHECK (amount >= 0),
  payment_count  INTEGER NOT NULL DEFAULT 0,
  status         TEXT NOT NULL DEFAULT 'pending'
                 CHECK (status IN ('pending', 'paid', 'cancelled')),
  notes          TEXT,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  paid_at        TIMESTAMPTZ,
  marked_paid_by TEXT
);

CREATE INDEX IF NOT EXISTS payouts_creator_status_idx
  ON public.payouts (creator_id, status, created_at DESC);

CREATE INDEX IF NOT EXISTS payouts_status_created_idx
  ON public.payouts (status, created_at DESC);

ALTER TABLE public.payouts ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.payouts FROM anon;
REVOKE ALL ON public.payouts FROM authenticated;

-- ============================================================
-- 3) Earnings + payout link on payments
--    creator_earning is paise; nullable until first success event.
--    payout_id is set when this payment is bundled into a payout run.
-- ============================================================

ALTER TABLE public.payments
  ADD COLUMN IF NOT EXISTS creator_earning INTEGER,
  ADD COLUMN IF NOT EXISTS payout_id       TEXT REFERENCES public.payouts(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS payments_payout_id_idx
  ON public.payments (payout_id);

CREATE INDEX IF NOT EXISTS payments_creator_unpaid_idx
  ON public.payments (creator_id)
  WHERE creator_id IS NOT NULL AND payout_id IS NULL AND creator_earning IS NOT NULL;

-- ============================================================
-- 4) Creator linking
--    BEFORE trigger sets role='creator' when signing up with a
--    creator's email. AFTER trigger writes the new user_id back
--    to the creators row.
--
--    Naming: trg_users_aa_link_creator_role fires alphabetically
--    BEFORE trg_users_enforce_admin_role, so the admin trigger
--    always wins for the admin email.
-- ============================================================

CREATE OR REPLACE FUNCTION public.link_creator_role()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE
  norm_email TEXT;
  has_creator BOOLEAN;
BEGIN
  norm_email := lower(btrim(COALESCE(NEW.email, '')));
  IF norm_email = '' THEN RETURN NEW; END IF;

  SELECT EXISTS (
    SELECT 1 FROM public.creators
     WHERE lower(btrim(email)) = norm_email
       AND is_active = TRUE
  ) INTO has_creator;

  IF has_creator AND NEW.role NOT IN ('admin', 'moderator') THEN
    NEW.role := 'creator';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_users_aa_link_creator_role ON public.users;
CREATE TRIGGER trg_users_aa_link_creator_role
  BEFORE INSERT OR UPDATE OF role, email ON public.users
  FOR EACH ROW EXECUTE FUNCTION public.link_creator_role();

CREATE OR REPLACE FUNCTION public.link_user_to_creator()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.email IS NULL THEN RETURN NEW; END IF;
  UPDATE public.creators
     SET user_id = NEW.id
   WHERE lower(btrim(email)) = lower(btrim(NEW.email))
     AND user_id IS DISTINCT FROM NEW.id;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_users_link_to_creator ON public.users;
CREATE TRIGGER trg_users_link_to_creator
  AFTER INSERT OR UPDATE OF email ON public.users
  FOR EACH ROW EXECUTE FUNCTION public.link_user_to_creator();

-- Backfill: existing users matching active creators
UPDATE public.users u
   SET role = 'creator'
  FROM public.creators c
 WHERE lower(btrim(u.email)) = lower(btrim(c.email))
   AND c.is_active = TRUE
   AND u.role NOT IN ('admin', 'moderator')
   AND u.role IS DISTINCT FROM 'creator';

UPDATE public.creators c
   SET user_id = u.id
  FROM public.users u
 WHERE lower(btrim(c.email)) = lower(btrim(u.email))
   AND c.user_id IS NULL;

-- ============================================================
-- 5) Atomic payout creation
--    Sums all unpaid creator_earning rows for the given creator,
--    inserts a single payouts row with status='paid' (since the
--    admin clicks "Mark as Paid" to settle outside the system),
--    and stamps payout_id on every covered payment.
--    Raises if there is nothing to pay out.
-- ============================================================

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
     AND status IN ('active', 'authenticated', 'captured')
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
     AND status IN ('active', 'authenticated', 'captured')
     AND COALESCE(creator_earning, 0) > 0;

  RETURN v_payout_id;
END;
$$;

COMMIT;
