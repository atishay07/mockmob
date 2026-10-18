-- Undo for supabase/migrations/20261018200000_practice_credit_packs.sql. NOT a migration: it lives outside supabase/migrations
-- on purpose, so the Supabase CLI never applies it by itself.
-- Turn WALLET_COMMERCE_OPEN off first (no new order is then created) and let any payment already taken settle: with the function
-- gone a Practice pack's verify and webhook answer 503 'practice_credit_grant_rpc_required', and Razorpay retries the webhook.
-- Credits already granted stay: their credit_transactions rows (type 'purchase', reference 'purchase:<payment id>') and the added
-- balance are real money's worth, so this undo never removes them. The enum value 'purchase' also stays: Postgres cannot drop a
-- value from an enum, and an unused value does nothing.

drop function if exists public.mm_grant_practice_credits(text, integer, text, text);
