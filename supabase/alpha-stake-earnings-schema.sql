-- AlphaStake 每日利润发放记录
-- Run in Supabase SQL editor
-- 每个链上仓位每天最多发放一次：UNIQUE(position_id, earning_date)

CREATE TABLE IF NOT EXISTS public.alpha_stake_daily_earnings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  wallet_address TEXT NOT NULL,
  position_id INTEGER NOT NULL,
  earning_date DATE NOT NULL,
  principal_usdc DECIMAL(18,6) NOT NULL,
  tier_id INTEGER NOT NULL,
  daily_rate_bps INTEGER NOT NULL,           -- 100 = 1.00%/day
  earning_amount DECIMAL(18,6) NOT NULL,
  is_credited BOOLEAN NOT NULL DEFAULT true,
  credited_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(position_id, earning_date)
);

CREATE INDEX IF NOT EXISTS idx_alpha_daily_earnings_user_date
  ON public.alpha_stake_daily_earnings (user_id, earning_date);

ALTER TABLE public.alpha_stake_daily_earnings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "No public access alpha_stake_daily_earnings"
  ON public.alpha_stake_daily_earnings FOR ALL USING (false);
