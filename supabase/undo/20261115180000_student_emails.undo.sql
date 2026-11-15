-- Undo for supabase/migrations/20261115180000_student_emails.sql. NOT a migration: it lives outside supabase/migrations on
-- purpose, so the Supabase CLI never applies it by itself.
-- Dropping email_sends forgets which students were already sent the welcome or day-2 email, and dropping email_optouts forgets
-- who unsubscribed. While the tables are missing the code sends neither email (studentMailStore ready() is false) and the
-- unsubscribe page says it could not save. Turn EMAILS_ENABLED off before running this, and keep a copy of email_optouts if
-- the tables may come back: re-creating them empty would email students who had unsubscribed.
drop table if exists public.email_optouts;
drop table if exists public.email_sends;
