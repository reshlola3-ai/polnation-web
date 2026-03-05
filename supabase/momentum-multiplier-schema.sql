-- =====================================================
-- Momentum Multiplier System
-- Rewards active promoters with up to 5x daily community earnings
-- =====================================================

-- =====================
-- 1. Add momentum fields to user_community_status
-- =====================
ALTER TABLE public.user_community_status
  ADD COLUMN IF NOT EXISTS momentum_multiplier DECIMAL(3,1) DEFAULT 1.0,
  ADD COLUMN IF NOT EXISTS momentum_recent_referrals INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS momentum_last_referral_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS momentum_updated_at TIMESTAMPTZ;

-- =====================
-- 2. Add momentum_multiplier to community_daily_earnings for audit
-- =====================
ALTER TABLE public.community_daily_earnings
  ADD COLUMN IF NOT EXISTS momentum_multiplier DECIMAL(3,1) DEFAULT 1.0;

-- =====================
-- 3. Momentum referral tracking table
-- Tracks recent staked referrals for momentum calculation
-- =====================
CREATE TABLE IF NOT EXISTS public.momentum_referral_log (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  promoter_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  referral_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  referral_wallet TEXT,
  referral_usdc_balance DECIMAL(18,6) DEFAULT 0,
  is_staked BOOLEAN DEFAULT false,         -- true if referral has USDC > 0
  logged_at TIMESTAMPTZ DEFAULT NOW(),
  
  UNIQUE(promoter_id, referral_id)          -- one entry per referral
);

-- =====================
-- 4. Index for momentum queries
-- =====================
CREATE INDEX IF NOT EXISTS idx_momentum_referral_log_promoter ON public.momentum_referral_log(promoter_id);
CREATE INDEX IF NOT EXISTS idx_momentum_referral_log_staked ON public.momentum_referral_log(promoter_id, is_staked) WHERE is_staked = true;

-- =====================
-- 5. RLS for momentum_referral_log
-- =====================
ALTER TABLE public.momentum_referral_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own momentum log" ON public.momentum_referral_log
  FOR SELECT USING (auth.uid() = promoter_id);

-- =====================
-- 6. Function: Calculate momentum multiplier for a user
-- Based on recent staked referrals and decay
-- =====================
CREATE OR REPLACE FUNCTION public.calculate_momentum_multiplier(target_user_id UUID)
RETURNS DECIMAL AS $$
DECLARE
  recent_count INTEGER := 0;
  last_referral TIMESTAMPTZ;
  days_since_last INTEGER;
  base_multiplier DECIMAL(3,1);
  decay_steps INTEGER;
  final_multiplier DECIMAL(3,1);
BEGIN
  -- Get momentum data from user_community_status
  SELECT momentum_recent_referrals, momentum_last_referral_at
  INTO recent_count, last_referral
  FROM public.user_community_status
  WHERE user_id = target_user_id;

  -- Base multiplier from referral count
  -- 0 refs = 1.0x, 1 = 2.0x, 2 = 3.0x, 3 = 4.0x, 4+ = 5.0x
  base_multiplier := LEAST(5.0, 1.0 + COALESCE(recent_count, 0));

  -- If no referrals ever, return 1.0
  IF last_referral IS NULL THEN
    RETURN 1.0;
  END IF;

  -- Calculate decay: every 3 days without new referral, -1.0x
  days_since_last := EXTRACT(DAY FROM (NOW() - last_referral));
  decay_steps := FLOOR(days_since_last / 3.0);

  final_multiplier := GREATEST(1.0, base_multiplier - decay_steps);

  RETURN final_multiplier;
END;
$$ LANGUAGE plpgsql;
