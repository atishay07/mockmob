-- Evaluate auth.uid() once per query in the payments read policy (health audit 16 Oct 2026, finding 5d; advisor
-- auth_rls_initplan). Same rule as before (a student reads only their own rows, SELECT, authenticated), written so
-- Postgres computes the user id once instead of per row. ALTER POLICY keeps the roles and the command and never leaves a
-- moment with no policy. Nothing reads payments with the browser key today (the server uses service_role).
-- Idempotent. Undo: supabase/undo/20261016170400_payments_policy_initplan.undo.sql.

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'payments' AND policyname = 'Users can read their own payments') THEN
    ALTER POLICY "Users can read their own payments" ON public.payments
      USING (user_id = ((SELECT auth.uid()))::text);
  END IF;
END $$;
