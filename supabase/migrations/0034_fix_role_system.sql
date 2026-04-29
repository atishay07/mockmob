-- ============================================================
-- 0034 — Defensive role-system fix
--
-- Symptom: users.role rejected values other than 'student' on some
-- environments, and /admin crashed because session.user.role wasn't
-- 'admin' for the admin email. This migration:
--
--   1. Drops every role-related CHECK constraint we know about (in
--      case earlier migrations were partially applied with different
--      constraint names).
--   2. Forces users.role to be TEXT (no enum). If it somehow was an
--      enum, the column is converted in place.
--   3. Sets default 'student' and backfills NULLs.
--   4. Re-adds the CHECK with the four supported roles.
--   5. Forces atishay07jain@gmail.com to role='admin'.
--   6. Softens the admin trigger: instead of raising an exception
--      when a non-admin email is set to 'admin' (which would crash
--      whatever caller did the write), it silently rolls the role
--      back to its previous value. The app-layer guard is the
--      authoritative check; the trigger is a safety net.
--
-- Idempotent. Safe to run multiple times.
-- ============================================================

BEGIN;

-- 1) Drop any prior role check constraints by every name we've used.
ALTER TABLE public.users DROP CONSTRAINT IF EXISTS users_role_check;
ALTER TABLE public.users DROP CONSTRAINT IF EXISTS users_role_chk;
ALTER TABLE public.users DROP CONSTRAINT IF EXISTS chk_users_role;

-- 2) Force TEXT, only if it's not already TEXT (handles enum -> text).
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
      FROM information_schema.columns
     WHERE table_schema = 'public'
       AND table_name   = 'users'
       AND column_name  = 'role'
       AND data_type   <> 'text'
  ) THEN
    EXECUTE 'ALTER TABLE public.users ALTER COLUMN role TYPE TEXT USING role::text';
  END IF;
END $$;

-- 3) Default + backfill NULLs.
ALTER TABLE public.users ALTER COLUMN role SET DEFAULT 'student';

UPDATE public.users
   SET role = 'student'
 WHERE role IS NULL OR btrim(role) = '';

-- 4) Re-add CHECK with all four roles (drop-if-exists first so the
--    constraint definition is always the latest).
ALTER TABLE public.users DROP CONSTRAINT IF EXISTS users_role_check;
ALTER TABLE public.users
  ADD CONSTRAINT users_role_check
  CHECK (role IN ('student', 'moderator', 'creator', 'admin'));

-- 5) Force admin on the right email (case + whitespace tolerant).
UPDATE public.users
   SET role = 'admin'
 WHERE lower(btrim(email)) = 'atishay07jain@gmail.com'
   AND role IS DISTINCT FROM 'admin';

-- 6) Replace the admin trigger with a non-throwing version. If a write
--    tries to set role='admin' for the wrong email, we silently
--    downgrade rather than aborting. The application uses isAdmin() in
--    src/lib/admin/roles.js as the authoritative check; this trigger is
--    a guardrail.
CREATE OR REPLACE FUNCTION public.enforce_admin_role()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE
  admin_email CONSTANT TEXT := 'atishay07jain@gmail.com';
  norm_email TEXT;
BEGIN
  norm_email := lower(btrim(COALESCE(NEW.email, '')));

  -- Wrong email being set to admin -> roll back to previous role
  -- (or 'student' on insert).
  IF NEW.role = 'admin' AND norm_email <> admin_email THEN
    IF TG_OP = 'UPDATE' AND OLD.role IS NOT NULL AND OLD.role <> 'admin' THEN
      NEW.role := OLD.role;
    ELSE
      NEW.role := 'student';
    END IF;
  END IF;

  -- Right email -> always admin.
  IF norm_email = admin_email THEN
    NEW.role := 'admin';
  END IF;

  RETURN NEW;
END;
$$;

-- Trigger may not exist if 0032 was never applied — recreate it.
DROP TRIGGER IF EXISTS trg_users_enforce_admin_role ON public.users;
CREATE TRIGGER trg_users_enforce_admin_role
  BEFORE INSERT OR UPDATE OF role, email ON public.users
  FOR EACH ROW EXECUTE FUNCTION public.enforce_admin_role();

COMMIT;
