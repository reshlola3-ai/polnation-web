-- =====================================================
-- REFERRAL COMMISSION SCHEMA
-- 推荐佣金系统数据库设计
-- =====================================================

-- 1. 推荐佣金比例配置表
CREATE TABLE IF NOT EXISTS referral_commission_rates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  level INTEGER NOT NULL UNIQUE,
  -- 佣金比例（百分比），例如 10 表示 10%
  rate_percent DECIMAL(10, 4) NOT NULL,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 初始化佣金比例
INSERT INTO referral_commission_rates (level, rate_percent) VALUES
  (1, 10),   -- L1: 10%
  (2, 5),    -- L2: 5%
  (3, 4),    -- L3: 4%
  (4, 3),    -- L4: 3%
  (5, 2),    -- L5: 2%
  (6, 1)     -- L6: 1%
ON CONFLICT (level) DO UPDATE SET
  rate_percent = EXCLUDED.rate_percent;

-- 2. 推荐佣金记录表
CREATE TABLE IF NOT EXISTS referral_commissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  -- 获得佣金的用户（上线）
  beneficiary_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  -- 产生收益的用户（下线）
  source_user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  -- 关联的空投轮次
  round_id UUID REFERENCES airdrop_rounds(id) ON DELETE SET NULL,
  -- 层级（1-6）
  level INTEGER NOT NULL,
  -- 下线的原始收益
  source_profit DECIMAL(18, 6) NOT NULL,
  -- 佣金比例
  commission_rate DECIMAL(10, 4) NOT NULL,
  -- 佣金金额
  commission_amount DECIMAL(18, 6) NOT NULL,
  -- 是否已发放
  is_credited BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. 在 user_profits 表添加佣金相关字段
ALTER TABLE user_profits 
ADD COLUMN IF NOT EXISTS total_commission_earned DECIMAL(18, 6) DEFAULT 0,
ADD COLUMN IF NOT EXISTS available_commission DECIMAL(18, 6) DEFAULT 0;

-- =====================================================
-- ROW LEVEL SECURITY
-- =====================================================

-- referral_commission_rates: 所有人可读
ALTER TABLE referral_commission_rates ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can read commission rates" ON referral_commission_rates FOR SELECT USING (true);

-- referral_commissions: 用户可读自己获得的佣金
ALTER TABLE referral_commissions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can read own commissions" ON referral_commissions FOR SELECT USING (auth.uid() = beneficiary_id);

-- =====================================================
-- INDEXES
-- =====================================================
CREATE INDEX IF NOT EXISTS idx_referral_commissions_beneficiary ON referral_commissions(beneficiary_id);
CREATE INDEX IF NOT EXISTS idx_referral_commissions_source ON referral_commissions(source_user_id);
CREATE INDEX IF NOT EXISTS idx_referral_commissions_round ON referral_commissions(round_id);

-- =====================================================
-- FUNCTION: 获取用户的所有上线（最多6层）
-- =====================================================
CREATE OR REPLACE FUNCTION get_upline_chain(user_id UUID, max_levels INTEGER DEFAULT 6)
RETURNS TABLE (
  upline_id UUID,
  level INTEGER
) AS $$
DECLARE
  current_id UUID := user_id;
  current_level INTEGER := 0;
  referrer UUID;
BEGIN
  LOOP
    current_level := current_level + 1;
    
    -- 超过最大层级则退出
    IF current_level > max_levels THEN
      EXIT;
    END IF;
    
    -- 获取当前用户的推荐人
    SELECT p.referrer_id INTO referrer
    FROM profiles p
    WHERE p.id = current_id;
    
    -- 没有推荐人则退出
    IF referrer IS NULL THEN
      EXIT;
    END IF;
    
    -- 返回这一层的上线
    upline_id := referrer;
    level := current_level;
    RETURN NEXT;
    
    -- 继续向上查找
    current_id := referrer;
  END LOOP;
END;
$$ LANGUAGE plpgsql;
