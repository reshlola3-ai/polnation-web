-- AlphaStake admin config + allowlist
-- Run in Supabase SQL editor

CREATE TABLE IF NOT EXISTS public.alpha_stake_config (
  id INTEGER PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  staking_open BOOLEAN NOT NULL DEFAULT false,
  allowlist_required BOOLEAN NOT NULL DEFAULT true,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO public.alpha_stake_config (id, staking_open, allowlist_required)
VALUES (1, false, true)
ON CONFLICT (id) DO NOTHING;

CREATE TABLE IF NOT EXISTS public.alpha_stake_allowlist (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  wallet_address TEXT,
  note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id)
);

CREATE INDEX IF NOT EXISTS idx_alpha_stake_allowlist_wallet
  ON public.alpha_stake_allowlist (wallet_address);

ALTER TABLE public.alpha_stake_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.alpha_stake_allowlist ENABLE ROW LEVEL SECURITY;

CREATE POLICY "No public access alpha_stake_config"
  ON public.alpha_stake_config FOR ALL USING (false);

CREATE POLICY "No public access alpha_stake_allowlist"
  ON public.alpha_stake_allowlist FOR ALL USING (false);
