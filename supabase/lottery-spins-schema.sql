-- =====================================================
-- LOTTERY SPINS SYSTEM
-- 抽奖次数管理系统
-- =====================================================

-- 1. 用户抽奖次数表
CREATE TABLE IF NOT EXISTS public.user_lottery_spins (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE,
  
  -- 总可用次数
  total_spins INTEGER DEFAULT 0,
  -- 已使用次数
  used_spins INTEGER DEFAULT 0,
  -- 是否 influencer（无限次数）
  is_influencer BOOLEAN DEFAULT false,
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_user_lottery_spins_user 
ON public.user_lottery_spins (user_id);

-- RLS
ALTER TABLE public.user_lottery_spins ENABLE ROW LEVEL SECURITY;

-- 用户可以读取自己的记录
CREATE POLICY "Users can read own lottery spins"
ON public.user_lottery_spins FOR SELECT
USING (auth.uid() = user_id);

-- 只有 service role 可以写入
CREATE POLICY "Service role can manage lottery spins"
ON public.user_lottery_spins FOR ALL
USING (true)
WITH CHECK (true);

-- 2. 抽奖次数获取记录（用于追踪和防止重复发放）
CREATE TABLE IF NOT EXISTS public.lottery_spin_grants (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  
  -- 获得原因
  grant_reason TEXT NOT NULL, 
  -- 'referral_airdrop_7' = 推荐人的下线领取7次空投
  -- 'self_airdrop_7x'    = 自己空投领取达到7的倍数
  -- 'admin_grant'         = 管理员手动发放
  -- 'influencer'          = influencer身份
  
  -- 关联的推荐人ID（如果是referral类型）
  referral_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  
  -- 关联的空投里程碑值（例如 7, 14, 21...）
  milestone_count INTEGER,
  
  -- 发放的次数
  spins_granted INTEGER DEFAULT 1,
  
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_lottery_spin_grants_user 
ON public.lottery_spin_grants (user_id, grant_reason);

CREATE INDEX IF NOT EXISTS idx_lottery_spin_grants_referral 
ON public.lottery_spin_grants (referral_id, grant_reason);

-- RLS
ALTER TABLE public.lottery_spin_grants ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own spin grants"
ON public.lottery_spin_grants FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Service role can manage spin grants"
ON public.lottery_spin_grants FOR ALL
USING (true)
WITH CHECK (true);

-- 3. 给 lottery_records 增加 reward_credited 字段追踪奖励是否已发放
ALTER TABLE public.lottery_records 
ADD COLUMN IF NOT EXISTS reward_credited BOOLEAN DEFAULT false;
