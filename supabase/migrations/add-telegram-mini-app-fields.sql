-- Phase 1 — Telegram Mini App auth backbone
-- Builds on add-telegram-verification.sql (which created telegram_chat_id,
-- telegram_username, telegram_verified — but they're currently unused in app code).
--
-- Reuses telegram_chat_id as the canonical TG user_id (for 1:1 private chats
-- they're the same value).
--
-- Adds:
--   - UNIQUE constraint on telegram_chat_id so we can look up users by it
--     during /api/auth/telegram (deferred via partial unique index — only
--     enforced where the value is non-null)
--   - telegram_photo_url for displaying TG avatars in the Mini App

ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS telegram_photo_url TEXT;

-- Partial unique index: enforce uniqueness only where telegram_chat_id is set.
-- Existing rows with NULL telegram_chat_id are unaffected.
CREATE UNIQUE INDEX IF NOT EXISTS uq_profiles_telegram_chat_id
  ON profiles (telegram_chat_id)
  WHERE telegram_chat_id IS NOT NULL;

-- Fast lookup index for the auth path (in addition to the unique).
-- Already implicit from the unique index above; including for clarity.
COMMENT ON INDEX uq_profiles_telegram_chat_id IS
  'Phase 1 TG Mini App: enforces 1 polnation account per Telegram user_id.';
