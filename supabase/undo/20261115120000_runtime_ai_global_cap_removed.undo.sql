-- Undo of supabase/migrations/20261115120000_runtime_ai_global_cap_removed.sql. NOT APPLIED. A NO-OP ON PRODUCTION. Saved
-- only, never applied by an agent; run only with the owner's grant.
--
-- It lowers the global 'student_ai' row back to the USD 25 seed only where the forward file raised it, which that file marks
-- with a comment on the column. Production's 1000000 was set by hand, not by the forward file, so it carries no such mark and
-- this file leaves it alone. Tested in PGlite by data/tests/runtime_ai_global_cap_1115.test.mjs.

do $$
begin
  if coalesce(col_description('public.runtime_ai_budget'::regclass,
       (select attnum from pg_attribute where attrelid = 'public.runtime_ai_budget'::regclass and attname = 'monthly_cap_usd')), '')
     like '%20261115120000%' then
    update public.runtime_ai_budget set monthly_cap_usd = 25 where id = 'student_ai' and monthly_cap_usd = 1000000;
    comment on column public.runtime_ai_budget.monthly_cap_usd is null;
  end if;
end $$;
