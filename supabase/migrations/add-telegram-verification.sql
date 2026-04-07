-- Add Telegram verification fields to profiles
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS telegram_verified       BOOLEAN   NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS telegram_chat_id        BIGINT,
  ADD COLUMN IF NOT EXISTS telegram_username       TEXT,
  ADD COLUMN IF NOT EXISTS telegram_verify_code    TEXT,
  ADD COLUMN IF NOT EXISTS telegram_verify_expires_at TIMESTAMPTZ;

-- Index for fast lookup by verification code
CREATE INDEX IF NOT EXISTS idx_profiles_telegram_verify_code
  ON profiles (telegram_verify_code)
  WHERE telegram_verify_code IS NOT NULL;
