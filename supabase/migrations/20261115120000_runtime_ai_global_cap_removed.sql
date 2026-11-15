-- NOT APPLIED. A NO-OP ON PRODUCTION. Saved by the 15 Nov 2026 production pass (ledger M-010, finding L2); run only with the
-- owner's grant, like every migration here.
--
-- Why: the owner removed the global monthly ceiling on student AI on 17 Oct 2026 (AGENTS.md: "the global monthly ceiling was
-- removed by the owner on 17 Oct 2026"; the cap now is per student per IST month, the 'student_user_paid' and
-- 'student_user_free' rows of 20261017120000_runtime_ai_user_cap.sql). Production's global row was raised by hand to
-- USD 1,000,000 (noted in 20261017120000_runtime_ai_user_cap.sql, lines 33-34), but no migration says so:
-- 20261004120000_runtime_ai_monthly_cap.sql still seeds the global 'student_ai' row at USD 25, and reserve_runtime_ai (latest
-- body in 20261018210000_one_credits_balance.sql) still refuses once a month's spend passes that row's monthly_cap_usd. Guest
-- Ask Mobi reserves against the same row. So a database rebuilt from this repository would stop every student and guest AI
-- reply at USD 25 a month, a ceiling the owner removed. This file brings such a database to production's state.
--
-- On production: the row reads 1000000, so the update matches nothing and nothing else runs (no comment is written). On a
-- rebuilt database the row reads the 25 seed: it is raised to 1000000 and the column is marked, so the undo file can tell the
-- two apart and never lowers production's value.
-- Undo: supabase/undo/20261115120000_runtime_ai_global_cap_removed.undo.sql. Tested in PGlite by
-- data/tests/runtime_ai_global_cap_1115.test.mjs.

do $$
begin
  update public.runtime_ai_budget set monthly_cap_usd = 1000000 where id = 'student_ai' and monthly_cap_usd = 25;
  if found then
    comment on column public.runtime_ai_budget.monthly_cap_usd is
      'student_ai: raised from the 25 seed to 1000000 by 20261115120000 (global ceiling removed by the owner, 17 Oct 2026)';
  end if;
end $$;
