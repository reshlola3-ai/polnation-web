ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS twitter_verified BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS twitter_id TEXT,
  ADD COLUMN IF NOT EXISTS twitter_username TEXT;

-- Ensure one Twitter account per Polnation account
CREATE UNIQUE INDEX IF NOT EXISTS idx_profiles_twitter_id
  ON profiles (twitter_id)
  WHERE twitter_id IS NOT NULL;
