-- Security fix (16 Oct 2026 review): the question bank is no longer readable with the public anon key.
--
-- Found: public.questions had a SELECT grant for anon and authenticated and the policy "anon read live questions"
-- (0002_rls.sql: status = 'live'). The anon key ships in the browser bundle (NEXT_PUBLIC_SUPABASE_ANON_KEY), so anyone
-- could call /rest/v1/questions directly and read every live row (8,196 on production, read-only check 16 Oct 2026)
-- with every column: correct_answer, explanation, evidence, provenance, ai_score and the uploader and author ids.
-- That path skips everything the product puts in front of the bank: the eligibility gate (readablePracticeQuestions),
-- the column list of /api/questions/feed, and its rate limit. A scraper could take the whole bank in a few requests.
--
-- Nothing in MockMob reads questions with the anon or the authenticated role: every server read uses the service
-- role (src/lib/supabase.js supabaseAdmin), and the browser client (src/lib/supabase-browser.js) and the Android app
-- use Supabase only for sign-in. So the grant is removed entirely rather than narrowed by column.
-- Row level security stays on, the policy stays (it matches nothing without a grant), service_role keeps full access.
-- Additive and idempotent. Not applied to production by this change; dry run on staging (onwkqxmjqjrhfbjjdydu) 16 Oct:
-- anon and authenticated lose SELECT, service_role keeps SELECT and UPDATE, and the undo restores the old grants.
-- Undo: supabase/undo/20261016141000_questions_private_to_browser_roles.undo.sql
revoke all on public.questions from anon, authenticated;
grant all on public.questions to service_role;
