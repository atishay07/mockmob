-- Undo for 20261016170200_server_only_functions_drift.sql: put back the PUBLIC execute default on the two functions.
-- Run only where the migration changed something (staging). Production already had both closed before it.
DO $$
DECLARE
  sig text;
BEGIN
  FOREACH sig IN ARRAY ARRAY[
    'public.mm_ai_consume_credits(text, integer, text, text, text, integer, timestamptz, timestamptz, jsonb)',
    'public.link_creator_role()'
  ]
  LOOP
    IF to_regprocedure(sig) IS NOT NULL THEN
      EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO PUBLIC, anon, authenticated, service_role', sig);
    END IF;
  END LOOP;
END $$;
