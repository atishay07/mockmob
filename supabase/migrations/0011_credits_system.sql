-- Add credit balance to users table
ALTER TABLE users ADD COLUMN IF NOT EXISTS credit_balance INTEGER NOT NULL DEFAULT 0;

-- Create enum for transaction types if it doesn't exist
DO $$ BEGIN
    CREATE TYPE credit_transaction_type AS ENUM ('earn', 'spend', 'bonus');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Create ledger table
CREATE TABLE IF NOT EXISTS credit_transactions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    amount INTEGER NOT NULL,
    type credit_transaction_type NOT NULL,
    reference TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_credit_transactions_user ON credit_transactions(user_id);

-- Atomic RPC for spending credits
CREATE OR REPLACE FUNCTION spend_credits(
  p_user_id TEXT,
  p_amount INTEGER,
  p_reference TEXT
) RETURNS BOOLEAN
LANGUAGE plpgsql
AS $$
DECLARE
  v_balance INTEGER;
BEGIN
  -- Lock the user row to prevent race conditions
  SELECT credit_balance INTO v_balance FROM users WHERE id = p_user_id FOR UPDATE;

  IF v_balance < p_amount THEN
    RETURN FALSE; -- Insufficient funds
  END IF;

  -- Deduct
  UPDATE users SET credit_balance = credit_balance - p_amount WHERE id = p_user_id;

  -- Insert ledger entry
  INSERT INTO credit_transactions (user_id, amount, type, reference)
  VALUES (p_user_id, -p_amount, 'spend', p_reference);

  RETURN TRUE;
END;
$$;

-- Atomic RPC for granting credits
CREATE OR REPLACE FUNCTION grant_credits(
  p_user_id TEXT,
  p_amount INTEGER,
  p_reference TEXT
) RETURNS VOID
LANGUAGE plpgsql
AS $$
BEGIN
  -- Add credits
  UPDATE users SET credit_balance = credit_balance + p_amount WHERE id = p_user_id;

  -- Insert ledger entry
  INSERT INTO credit_transactions (user_id, amount, type, reference)
  VALUES (p_user_id, p_amount, 'earn', p_reference);
END;
$$;
