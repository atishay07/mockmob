-- Undo of supabase/migrations/20261117090000_free_ai_cap_350.sql. NOT applied by an agent or a deploy; run only by the owner.
-- Puts the Free per-student monthly AI cap back to USD 0.0284 (Rs 2.50 at Rs 88), the value 20261018130000_free_ai_wallet_50.sql
-- set. Pro's row and the global 'student_ai' row are not touched. Tested by data/tests/free_ai_cap_350.test.mjs.

update public.runtime_ai_budget set monthly_cap_usd = 0.0284 where id = 'student_user_free';
