-- ============================================================
-- 0032 — Creator + referral system, Phase A
--
-- Adds:
--   1) users.role check (student | moderator | creator | admin)
--   2) Admin-email lock trigger (only atishay07jain@gmail.com may be admin;
--      that email is auto-elevated to admin on insert/update)
--   3) creators table (code -> Razorpay offer_id mapping, commission)
--   4) Creator attribution columns on payments
--   5) webhook_events table for idempotent webhook processing
--   6) audit_logs table for admin action history
--
-- Idempotent — safe to run repeatedly.
-- ============================================================

BEGIN;

-- ============================================================
-- 1) Role check on users
--    Existing values are 'student' | 'moderator'. Extend to allow
--    'creator' and 'admin'.
-- ============================================================

ALTER TABLE public.users
  DROP CONSTRAINT IF EXISTS users_role_check;

ALTER TABLE public.users
  ADD CONSTRAINT users_role_check
  CHECK (role IN ('student', 'moderator', 'creator', 'admin'));

-- ============================================================
-- 2) Admin-email lock
--    Only atishay07jain@gmail.com may hold role='admin'. If anyone else
--    is set to 'admin', the trigger raises. If atishay07jain@gmail.com
--    is created/updated, role is auto-elevated to 'admin'.
--    Lookup is case-insensitive.
-- ============================================================

CREATE OR REPLACE FUNCTION public.enforce_admin_role()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE
  admin_email CONSTANT TEXT := 'atishay07jain@gmail.com';
  norm_email TEXT;
BEGIN
  norm_email := lower(btrim(COALESCE(NEW.email, '')));

  IF NEW.role = 'admin' AND norm_email <> admin_email THEN
    RAISE EXCEPTION 'Only % may hold the admin role (attempted: %)', admin_email, NEW.email
      USING ERRCODE = 'check_violation';
  END IF;

  IF norm_email = admin_email THEN
    NEW.role := 'admin';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_users_enforce_admin_role ON public.users;
CREATE TRIGGER trg_users_enforce_admin_role
  BEFORE INSERT OR UPDATE OF role, email ON public.users
  FOR EACH ROW EXECUTE FUNCTION public.enforce_admin_role();

-- Backfill: if the admin user already exists, ensure they hold the role.
UPDATE public.users
   SET role = 'admin'
 WHERE lower(btrim(email)) = 'atishay07jain@gmail.com'
   AND role IS DISTINCT FROM 'admin';

-- ============================================================
-- 3) creators table
--    Phase A scope: code -> offer_id mapping plus commission rate.
--    Future phases extend with payouts, performance views, etc.
--    user_id is OPTIONAL — a creator may exist before they ever log in.
-- ============================================================

CREATE TABLE IF NOT EXISTS public.creators (
  id              TEXT PRIMARY KEY DEFAULT ('crt_' || replace(gen_random_uuid()::text, '-', '')),
  user_id         TEXT REFERENCES public.users(id) ON DELETE SET NULL,
  name            TEXT NOT NULL,
  email           TEXT,
  code            TEXT NOT NULL,
  offer_id        TEXT,
  commission_rate NUMERIC(5,4) NOT NULL DEFAULT 0.20
                  CHECK (commission_rate >= 0 AND commission_rate <= 1),
  is_active       BOOLEAN NOT NULL DEFAULT TRUE,
  notes           TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Case-insensitive uniqueness on the code (codes are matched in lowercase).
CREATE UNIQUE INDEX IF NOT EXISTS creators_code_lower_idx
  ON public.creators (lower(btrim(code)));

CREATE INDEX IF NOT EXISTS creators_user_id_idx
  ON public.creators (user_id);

CREATE INDEX IF NOT EXISTS creators_active_idx
  ON public.creators (is_active) WHERE is_active = TRUE;

DROP TRIGGER IF EXISTS trg_creators_updated_at ON public.creators;
CREATE TRIGGER trg_creators_updated_at
  BEFORE UPDATE ON public.creators
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.creators ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.creators FROM anon;
REVOKE ALL ON public.creators FROM authenticated;
-- All access goes through service_role from server-only routes.

-- ============================================================
-- 4) Payment attribution columns
--    Attach the creator code, creator id, Razorpay offer_id, and
--    actual amount paid (post-discount) to every payments row.
-- ============================================================

ALTER TABLE public.payments
  ADD COLUMN IF NOT EXISTS creator_code TEXT,
  ADD COLUMN IF NOT EXISTS creator_id   TEXT REFERENCES public.creators(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS offer_id     TEXT,
  ADD COLUMN IF NOT EXISTS amount_paid  INTEGER;

CREATE INDEX IF NOT EXISTS payments_creator_id_idx
  ON public.payments (creator_id) WHERE creator_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS payments_creator_code_idx
  ON public.payments (creator_code) WHERE creator_code IS NOT NULL;

-- ============================================================
-- 5) Webhook idempotency
--    One row per Razorpay webhook event_id. PRIMARY KEY enforces
--    "process once" semantics — duplicate deliveries are no-ops.
-- ============================================================

CREATE TABLE IF NOT EXISTS public.webhook_events (
  event_id      TEXT PRIMARY KEY,
  provider      TEXT NOT NULL DEFAULT 'razorpay',
  event_type    TEXT NOT NULL,
  payload       JSONB NOT NULL,
  received_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  processed_at  TIMESTAMPTZ,
  error_message TEXT
);

CREATE INDEX IF NOT EXISTS webhook_events_received_idx
  ON public.webhook_events (received_at DESC);

CREATE INDEX IF NOT EXISTS webhook_events_unprocessed_idx
  ON public.webhook_events (received_at) WHERE processed_at IS NULL;

ALTER TABLE public.webhook_events ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.webhook_events FROM anon;
REVOKE ALL ON public.webhook_events FROM authenticated;

-- ============================================================
-- 6) Audit logs
--    Append-only history of admin/creator mutations. Used by the
--    admin dashboard's "audit trail" view.
-- ============================================================

CREATE TABLE IF NOT EXISTS public.audit_logs (
  id          BIGSERIAL PRIMARY KEY,
  actor_id    TEXT,
  actor_email TEXT,
  actor_role  TEXT,
  action      TEXT NOT NULL,
  target_type TEXT,
  target_id   TEXT,
  metadata    JSONB NOT NULL DEFAULT '{}'::jsonb,
  ip_address  TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS audit_logs_actor_idx
  ON public.audit_logs (actor_id, created_at DESC);

CREATE INDEX IF NOT EXISTS audit_logs_target_idx
  ON public.audit_logs (target_type, target_id);

CREATE INDEX IF NOT EXISTS audit_logs_action_idx
  ON public.audit_logs (action, created_at DESC);

ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.audit_logs FROM anon;
REVOKE ALL ON public.audit_logs FROM authenticated;

COMMIT;
