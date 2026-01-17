-- =====================================================
-- 社群账户系统 (Community Account System)
-- =====================================================

-- =====================
-- 1. 社群等级配置表
-- =====================
CREATE TABLE IF NOT EXISTS public.community_levels (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  level INTEGER UNIQUE NOT NULL,                          -- 等级 1-6
  name TEXT NOT NULL,                                     -- 等级名称
  reward_pool DECIMAL(18,6) NOT NULL,                     -- 奖励池金额
  daily_rate DECIMAL(6,4) NOT NULL,                       -- 每日利率 (0.01 = 1%)
  unlock_volume_normal DECIMAL(18,6) NOT NULL,            -- 普通用户解锁条件
  unlock_volume_influencer DECIMAL(18,6) NOT NULL,        -- Influencer 解锁条件
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 插入默认等级配置
INSERT INTO public.community_levels (level, name, reward_pool, daily_rate, unlock_volume_normal, unlock_volume_influencer) VALUES
  (1, 'Bronze', 10, 0, 100, 50),
  (2, 'Silver', 100, 0.01, 1000, 500),
  (3, 'Gold', 500, 0.011, 5000, 2500),
  (4, 'Platinum', 1000, 0.012, 10000, 5000),
  (5, 'Diamond', 5000, 0.015, 50000, 25000),
  (6, 'Elite', 10000, 0.02, 100000, 50000)
ON CONFLICT (level) DO NOTHING;

-- =====================
-- 2. 用户社群状态表
-- =====================
CREATE TABLE IF NOT EXISTS public.user_community_status (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE UNIQUE NOT NULL,
  
  -- 真实等级（通过团队业绩自然达到的等级）
  real_level INTEGER DEFAULT 0,                           -- 0 = 未解锁任何等级
  
  -- 当前生效等级（可能是管理员设置的）
  current_level INTEGER DEFAULT 0,
  
  -- 管理员设置状态
  is_admin_set BOOLEAN DEFAULT false,                     -- 是否由管理员手动设置等级
  admin_set_level INTEGER,                                -- 管理员设置的等级
  admin_set_at TIMESTAMPTZ,
  admin_set_by TEXT,
  
  -- Influencer 状态
  is_influencer BOOLEAN DEFAULT false,
  influencer_code TEXT,                                   -- Influencer 专属码
  influencer_set_at TIMESTAMPTZ,
  influencer_set_by TEXT,
  
  -- L1+L2+L3 下线总 volume（缓存值，定期更新）
  team_volume_l123 DECIMAL(18,6) DEFAULT 0,
  team_volume_updated_at TIMESTAMPTZ,
  
  -- 累计从社群账户获得的收益
  total_community_earned DECIMAL(18,6) DEFAULT 0,
  
  -- 上次计算每日收益的日期
  last_daily_earning_date DATE,
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- =====================
-- 3. 已领取的奖励池记录
-- =====================
CREATE TABLE IF NOT EXISTS public.community_pool_claims (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  level INTEGER NOT NULL,                                 -- 领取的等级
  amount DECIMAL(18,6) NOT NULL,                          -- 领取金额
  claim_type TEXT NOT NULL,                               -- 'natural' = 自然升级领取, 'admin_revoke' = 管理员撤销
  status TEXT DEFAULT 'completed',                        -- pending, completed, revoked
  claimed_at TIMESTAMPTZ DEFAULT NOW(),
  credited_at TIMESTAMPTZ,                                -- 计入利润账户的时间
  
  UNIQUE(user_id, level)                                  -- 每个等级只能领取一次
);

-- =====================
-- 4. 社群每日收益记录
-- =====================
CREATE TABLE IF NOT EXISTS public.community_daily_earnings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  earning_date DATE NOT NULL,                             -- 收益日期
  level INTEGER NOT NULL,                                 -- 计算时的等级
  reward_pool DECIMAL(18,6) NOT NULL,                     -- 计算时的奖励池
  daily_rate DECIMAL(6,4) NOT NULL,                       -- 计算时的利率
  earning_amount DECIMAL(18,6) NOT NULL,                  -- 收益金额
  is_credited BOOLEAN DEFAULT false,                      -- 是否已计入利润账户
  credited_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  
  UNIQUE(user_id, earning_date)                           -- 每天每用户只有一条记录
);

-- =====================
-- 5. 函数：计算用户 L1+L2+L3 下线总 volume
-- =====================
CREATE OR REPLACE FUNCTION public.calculate_team_volume_l123(target_user_id UUID)
RETURNS DECIMAL AS $$
DECLARE
  total_volume DECIMAL(18,6) := 0;
BEGIN
  -- 获取 L1, L2, L3 下线的钱包地址，然后需要在应用层查询链上余额
  -- 这里只返回下线数量作为占位，实际 volume 需要在应用层计算
  SELECT COALESCE(SUM(sub.usdc_balance), 0) INTO total_volume
  FROM (
    SELECT r.id, r.wallet_address, 0 AS usdc_balance -- 余额在应用层填充
    FROM public.get_all_referrals(target_user_id) r
    WHERE r.level <= 3
  ) sub;
  
  RETURN total_volume;
END;
$$ LANGUAGE plpgsql;

-- =====================
-- 6. 函数：获取用户当前社群等级信息
-- =====================
CREATE OR REPLACE FUNCTION public.get_user_community_info(target_user_id UUID)
RETURNS TABLE (
  user_id UUID,
  real_level INTEGER,
  current_level INTEGER,
  is_admin_set BOOLEAN,
  is_influencer BOOLEAN,
  team_volume_l123 DECIMAL,
  total_community_earned DECIMAL,
  current_level_name TEXT,
  current_reward_pool DECIMAL,
  current_daily_rate DECIMAL,
  current_daily_earning DECIMAL,
  next_level INTEGER,
  next_unlock_volume DECIMAL,
  volume_to_next_level DECIMAL,
  can_claim_levels INTEGER[]
) AS $$
DECLARE
  user_status RECORD;
  level_info RECORD;
  next_level_info RECORD;
  unlock_volume DECIMAL;
  claimed_levels INTEGER[];
BEGIN
  -- 获取用户状态
  SELECT * INTO user_status 
  FROM public.user_community_status ucs 
  WHERE ucs.user_id = target_user_id;
  
  -- 如果没有记录，创建一个
  IF user_status IS NULL THEN
    INSERT INTO public.user_community_status (user_id, real_level, current_level)
    VALUES (target_user_id, 0, 0)
    RETURNING * INTO user_status;
  END IF;
  
  -- 获取当前等级信息
  SELECT * INTO level_info 
  FROM public.community_levels cl 
  WHERE cl.level = user_status.current_level;
  
  -- 获取下一等级信息
  SELECT * INTO next_level_info 
  FROM public.community_levels cl 
  WHERE cl.level = user_status.current_level + 1;
  
  -- 计算解锁条件
  IF next_level_info IS NOT NULL THEN
    IF user_status.is_influencer THEN
      unlock_volume := next_level_info.unlock_volume_influencer;
    ELSE
      unlock_volume := next_level_info.unlock_volume_normal;
    END IF;
  END IF;
  
  -- 获取已领取的等级
  SELECT ARRAY_AGG(cpc.level) INTO claimed_levels
  FROM public.community_pool_claims cpc
  WHERE cpc.user_id = target_user_id AND cpc.status = 'completed';
  
  -- 计算可领取的等级（真实等级中未领取的，且低于当前等级的）
  -- 只有升级到下一等级后才能领取当前等级
  
  RETURN QUERY SELECT
    target_user_id,
    user_status.real_level,
    user_status.current_level,
    user_status.is_admin_set,
    user_status.is_influencer,
    user_status.team_volume_l123,
    user_status.total_community_earned,
    COALESCE(level_info.name, 'None')::TEXT,
    COALESCE(level_info.reward_pool, 0)::DECIMAL,
    COALESCE(level_info.daily_rate, 0)::DECIMAL,
    COALESCE(level_info.reward_pool * level_info.daily_rate, 0)::DECIMAL,
    COALESCE(next_level_info.level, NULL)::INTEGER,
    COALESCE(unlock_volume, 0)::DECIMAL,
    GREATEST(0, COALESCE(unlock_volume, 0) - user_status.team_volume_l123)::DECIMAL,
    COALESCE(claimed_levels, ARRAY[]::INTEGER[]);
END;
$$ LANGUAGE plpgsql;

-- =====================
-- 7. 索引优化
-- =====================
CREATE INDEX IF NOT EXISTS idx_user_community_status_user_id ON public.user_community_status(user_id);
CREATE INDEX IF NOT EXISTS idx_community_pool_claims_user_id ON public.community_pool_claims(user_id);
CREATE INDEX IF NOT EXISTS idx_community_daily_earnings_user_date ON public.community_daily_earnings(user_id, earning_date);
CREATE INDEX IF NOT EXISTS idx_community_daily_earnings_credited ON public.community_daily_earnings(is_credited) WHERE is_credited = false;

-- =====================
-- 8. RLS 策略
-- =====================
ALTER TABLE public.community_levels ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_community_status ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.community_pool_claims ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.community_daily_earnings ENABLE ROW LEVEL SECURITY;

-- 公开读取等级配置
CREATE POLICY "Anyone can read community levels" ON public.community_levels
  FOR SELECT USING (true);

-- 用户只能读取自己的状态
CREATE POLICY "Users can read own community status" ON public.user_community_status
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can read own pool claims" ON public.community_pool_claims
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can read own daily earnings" ON public.community_daily_earnings
  FOR SELECT USING (auth.uid() = user_id);
