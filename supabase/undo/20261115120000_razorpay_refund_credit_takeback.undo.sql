-- Undo of supabase/migrations/20261115120000_razorpay_refund_credit_takeback.sql. SAVED ONLY, never applied by an agent; run
-- only with the owner's grant. Drops the one function. Ledger rows it wrote (feature 'razorpay_refund') stay as history, and
-- the credits it took back are not given back. With the function gone the webhook records billing.refund_credits_manual
-- again and the owner follows the refund runbook (REFUND-RUNBOOK.md).
drop function if exists public.mm_ai_take_back_refunded_credits(text, integer, text, text, jsonb);
