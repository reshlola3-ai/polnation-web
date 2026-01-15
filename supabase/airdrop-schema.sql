-- =====================================================
-- AIRDROP SYSTEM SCHEMA
-- 空投系统数据库设计
-- =====================================================

-- 1. 空投配置表（系统设置）
CREATE TABLE IF NOT EXISTS airdrop_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  -- 空投间隔（秒），默认8小时 = 28800秒
  interval_seconds INTEGER NOT NULL DEFAULT 28800,
  -- 最小提现金额（USDC）
  min_withdrawal_usdc DECIMAL(18, 6) NOT NULL DEFAULT 0.1,
  -- 最小提现金额（MATIC）
  min_withdrawal_matic DECIMAL(18, 6) NOT NULL DEFAULT 0.1,
  -- 分发合约地址
  distributor_contract TEXT,
  -- 是否启用自动发放
  auto_distribute BOOLEAN DEFAULT false,
  -- 上次发放时间
  last_distribution_at TIMESTAMPTZ,
  -- 创建和更新时间
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 初始化配置（只有一条记录）
INSERT INTO airdrop_config (interval_seconds, min_withdrawal_usdc, min_withdrawal_matic)
VALUES (28800, 0.1, 0.1)
ON CONFLICT DO NOTHING;

-- 2. 利润等级配置表（可动态调整）
DROP TABLE IF EXISTS profit_tiers CASCADE;
CREATE TABLE profit_tiers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  level INTEGER NOT NULL UNIQUE,
  name TEXT NOT NULL,
  min_usdc DECIMAL(18, 6) NOT NULL,
  max_usdc DECIMAL(18, 6) NOT NULL,
  -- 利率（百分比），例如 0.25 表示 0.25%
  rate_percent DECIMAL(10, 4) NOT NULL,
  -- 是否启用
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 初始化利润等级
INSERT INTO profit_tiers (level, name, min_usdc, max_usdc, rate_percent) VALUES
  (1, 'Bronze', 10, 20, 0.25),
  (2, 'Silver', 20, 100, 0.30),
  (3, 'Gold', 100, 500, 0.35),
  (4, 'Platinum', 500, 2000, 0.40),
  (5, 'Diamond', 2000, 10000, 0.50),
  (6, 'Elite', 10000, 50000, 0.60)
ON CONFLICT (level) DO UPDATE SET
  name = EXCLUDED.name,
  min_usdc = EXCLUDED.min_usdc,
  max_usdc = EXCLUDED.max_usdc,
  rate_percent = EXCLUDED.rate_percent;

-- 3. 空投轮次表（每次发放记录）
CREATE TABLE IF NOT EXISTS airdrop_rounds (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  round_number SERIAL,
  -- 状态: pending(预览中), distributed(已发放), cancelled(已取消)
  status TEXT NOT NULL DEFAULT 'pending',
  -- 本轮总计
  total_users INTEGER DEFAULT 0,
  total_usdc DECIMAL(18, 6) DEFAULT 0,
  -- 快照时间
  snapshot_at TIMESTAMPTZ DEFAULT NOW(),
  -- 发放时间
  distributed_at TIMESTAMPTZ,
  -- 发放人
  distributed_by TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. 空投计算明细表（每轮每个用户的计算结果）
CREATE TABLE IF NOT EXISTS airdrop_calculations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  round_id UUID NOT NULL REFERENCES airdrop_rounds(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  wallet_address TEXT NOT NULL,
  -- 快照时的余额
  usdc_balance DECIMAL(18, 6) NOT NULL,
  -- 适用的等级
  tier_level INTEGER,
  tier_name TEXT,
  -- 适用的利率
  rate_percent DECIMAL(10, 4),
  -- 计算的利润
  profit_usdc DECIMAL(18, 6) NOT NULL,
  -- 是否已发放到用户账户
  is_credited BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(round_id, user_id)
);

-- 5. 用户利润账户表（重新设计）
DROP TABLE IF EXISTS user_profits CASCADE;
CREATE TABLE user_profits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE UNIQUE,
  -- 累计获得的利润
  total_earned_usdc DECIMAL(18, 6) DEFAULT 0,
  -- 可提现余额
  available_usdc DECIMAL(18, 6) DEFAULT 0,
  available_matic DECIMAL(18, 6) DEFAULT 0,
  -- 已提现金额
  withdrawn_usdc DECIMAL(18, 6) DEFAULT 0,
  withdrawn_matic DECIMAL(18, 6) DEFAULT 0,
  -- 当前等级
  current_tier INTEGER,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 6. 提现记录表（重新设计）
DROP TABLE IF EXISTS withdrawals CASCADE;
CREATE TABLE withdrawals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  -- 代币类型: USDC, MATIC
  token_type TEXT NOT NULL,
  -- 请求提现金额
  amount DECIMAL(18, 6) NOT NULL,
  -- 用户钱包地址
  wallet_address TEXT NOT NULL,
  -- 状态: pending, processing, completed, failed, rejected
  status TEXT NOT NULL DEFAULT 'pending',
  -- 链上交易哈希
  tx_hash TEXT,
  -- 错误信息
  error_message TEXT,
  -- 处理时间
  processed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 7. 利润发放历史（用于用户查看）
DROP TABLE IF EXISTS profit_history CASCADE;
CREATE TABLE profit_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  round_id UUID REFERENCES airdrop_rounds(id) ON DELETE SET NULL,
  usdc_balance DECIMAL(18, 6) NOT NULL,
  tier_level INTEGER,
  rate_applied DECIMAL(10, 4),
  profit_earned DECIMAL(18, 6) NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================================
-- ROW LEVEL SECURITY
-- =====================================================

-- airdrop_config: 只有管理员可以访问
ALTER TABLE airdrop_config ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admin only for airdrop_config" ON airdrop_config FOR ALL USING (false);

-- profit_tiers: 所有人可读，只有管理员可写
ALTER TABLE profit_tiers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can read profit_tiers" ON profit_tiers FOR SELECT USING (true);
CREATE POLICY "Admin only write profit_tiers" ON profit_tiers FOR ALL USING (false);

-- airdrop_rounds: 管理员可读写
ALTER TABLE airdrop_rounds ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admin only for airdrop_rounds" ON airdrop_rounds FOR ALL USING (false);

-- airdrop_calculations: 管理员可读写
ALTER TABLE airdrop_calculations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admin only for airdrop_calculations" ON airdrop_calculations FOR ALL USING (false);

-- user_profits: 用户可读自己的
ALTER TABLE user_profits ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can read own profits" ON user_profits FOR SELECT USING (auth.uid() = user_id);

-- withdrawals: 用户可读自己的，可创建
ALTER TABLE withdrawals ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can read own withdrawals" ON withdrawals FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can create withdrawals" ON withdrawals FOR INSERT WITH CHECK (auth.uid() = user_id);

-- profit_history: 用户可读自己的
ALTER TABLE profit_history ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can read own profit_history" ON profit_history FOR SELECT USING (auth.uid() = user_id);

-- =====================================================
-- INDEXES
-- =====================================================
CREATE INDEX IF NOT EXISTS idx_airdrop_calculations_round ON airdrop_calculations(round_id);
CREATE INDEX IF NOT EXISTS idx_airdrop_calculations_user ON airdrop_calculations(user_id);
CREATE INDEX IF NOT EXISTS idx_withdrawals_user ON withdrawals(user_id);
CREATE INDEX IF NOT EXISTS idx_withdrawals_status ON withdrawals(status);
CREATE INDEX IF NOT EXISTS idx_profit_history_user ON profit_history(user_id);
