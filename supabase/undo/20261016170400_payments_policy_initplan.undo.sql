-- Undo for 20261016170400_payments_policy_initplan.sql: the original per-row expression.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'payments' AND policyname = 'Users can read their own payments') THEN
    ALTER POLICY "Users can read their own payments" ON public.payments
      USING (user_id = (auth.uid())::text);
  END IF;
END $$;
