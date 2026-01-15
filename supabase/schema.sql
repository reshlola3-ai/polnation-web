-- Polnation 数据库架构
-- 在 Supabase SQL Editor 中运行此脚本

-- 启用 UUID 扩展
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- =====================
-- 用户表
-- =====================
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT UNIQUE NOT NULL,
  username TEXT UNIQUE,
  phone_country_code TEXT,
  phone_number TEXT,
  country_code TEXT,
  telegram_username TEXT,
  referrer_id UUID REFERENCES public.profiles(id),
  wallet_address TEXT UNIQUE,
  wallet_bound_at TIMESTAMPTZ,
  profile_completed BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 创建索引
CREATE INDEX IF NOT EXISTS idx_profiles_referrer ON public.profiles(referrer_id);
CREATE INDEX IF NOT EXISTS idx_profiles_wallet ON public.profiles(wallet_address);
CREATE INDEX IF NOT EXISTS idx_profiles_username ON public.profiles(username);

-- =====================
-- 管理员表
-- =====================
CREATE TABLE IF NOT EXISTS public.admins (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  username TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 插入默认管理员 (密码: admin)
-- 注意：生产环境请更改密码！
INSERT INTO public.admins (username, password_hash)
VALUES ('admin', crypt('admin', gen_salt('bf')))
ON CONFLICT (username) DO NOTHING;

-- =====================
-- 函数：验证管理员凭据
-- =====================
CREATE OR REPLACE FUNCTION public.verify_admin(admin_username TEXT, admin_password TEXT)
RETURNS BOOLEAN AS $$
DECLARE
  stored_hash TEXT;
BEGIN
  SELECT password_hash INTO stored_hash
  FROM public.admins
  WHERE username = admin_username;
  
  IF stored_hash IS NULL THEN
    RETURN FALSE;
  END IF;
  
  RETURN stored_hash = crypt(admin_password, stored_hash);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================
-- 快照主表
-- =====================
CREATE TABLE IF NOT EXISTS public.snapshots (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  snapshot_time TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  total_users INTEGER DEFAULT 0,
  total_usdc DECIMAL(20, 6) DEFAULT 0,
  triggered_by TEXT, -- 'admin' or system
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- =====================
-- 快照余额明细表
-- =====================
CREATE TABLE IF NOT EXISTS public.snapshot_balances (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  snapshot_id UUID NOT NULL REFERENCES public.snapshots(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  wallet_address TEXT NOT NULL,
  usdc_balance DECIMAL(20, 6) DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_snapshot_balances_snapshot ON public.snapshot_balances(snapshot_id);
CREATE INDEX IF NOT EXISTS idx_snapshot_balances_user ON public.snapshot_balances(user_id);

-- =====================
-- RLS (Row Level Security) 策略
-- =====================

-- 启用 RLS
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admins ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.snapshots ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.snapshot_balances ENABLE ROW LEVEL SECURITY;

-- Profiles 策略
-- 用户可以查看所有 profiles（用于 referral 展示）
CREATE POLICY "Profiles are viewable by everyone" ON public.profiles
  FOR SELECT USING (true);

-- 用户只能更新自己的 profile
CREATE POLICY "Users can update own profile" ON public.profiles
  FOR UPDATE USING (auth.uid() = id);

-- 用户可以插入自己的 profile
CREATE POLICY "Users can insert own profile" ON public.profiles
  FOR INSERT WITH CHECK (auth.uid() = id);

-- Admins 策略 - 只允许服务端访问
CREATE POLICY "Admins table is not accessible" ON public.admins
  FOR ALL USING (false);

-- Snapshots 策略 - 所有人可查看
CREATE POLICY "Snapshots are viewable by everyone" ON public.snapshots
  FOR SELECT USING (true);

-- Snapshot balances 策略 - 所有人可查看
CREATE POLICY "Snapshot balances are viewable by everyone" ON public.snapshot_balances
  FOR SELECT USING (true);

-- =====================
-- 函数：自动更新 updated_at
-- =====================
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 触发器
DROP TRIGGER IF EXISTS on_profiles_updated ON public.profiles;
CREATE TRIGGER on_profiles_updated
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();

-- =====================
-- 函数：新用户注册时自动创建 profile
-- =====================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
  ref_id UUID;
  default_username TEXT;
BEGIN
  -- 从 metadata 获取 referrer_id
  ref_id := (NEW.raw_user_meta_data->>'referrer_id')::UUID;
  
  -- 生成默认用户名（邮箱前缀）
  default_username := SPLIT_PART(NEW.email, '@', 1);
  
  -- 确保用户名唯一
  WHILE EXISTS (SELECT 1 FROM public.profiles WHERE username = default_username) LOOP
    default_username := default_username || FLOOR(RANDOM() * 1000)::TEXT;
  END LOOP;
  
  INSERT INTO public.profiles (id, email, username, referrer_id)
  VALUES (NEW.id, NEW.email, default_username, ref_id);
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 触发器：新用户注册时创建 profile
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- =====================
-- 函数：获取用户所有下线（递归）
-- =====================
CREATE OR REPLACE FUNCTION public.get_all_referrals(user_id UUID)
RETURNS TABLE (
  id UUID,
  username TEXT,
  email TEXT,
  country_code TEXT,
  telegram_username TEXT,
  phone_country_code TEXT,
  phone_number TEXT,
  wallet_address TEXT,
  created_at TIMESTAMPTZ,
  level INTEGER,
  team_count BIGINT
) AS $$
WITH RECURSIVE referral_tree AS (
  -- Base case: direct referrals (level 1)
  SELECT 
    p.id,
    p.username,
    p.email,
    p.country_code,
    p.telegram_username,
    p.phone_country_code,
    p.phone_number,
    p.wallet_address,
    p.created_at,
    1 AS level
  FROM public.profiles p
  WHERE p.referrer_id = user_id
  
  UNION ALL
  
  -- Recursive case: referrals of referrals
  SELECT 
    p.id,
    p.username,
    p.email,
    p.country_code,
    p.telegram_username,
    p.phone_country_code,
    p.phone_number,
    p.wallet_address,
    p.created_at,
    rt.level + 1 AS level
  FROM public.profiles p
  INNER JOIN referral_tree rt ON p.referrer_id = rt.id
  WHERE rt.level < 10 -- 限制最大层级为 10
)
SELECT 
  rt.*,
  (SELECT COUNT(*) FROM public.profiles WHERE referrer_id = rt.id) AS team_count
FROM referral_tree rt
ORDER BY rt.level, rt.created_at;
$$ LANGUAGE sql STABLE;

-- =====================
-- 函数：获取团队统计
-- =====================
CREATE OR REPLACE FUNCTION public.get_team_stats(user_id UUID)
RETURNS TABLE (
  total_team_members BIGINT,
  level1_members BIGINT
) AS $$
SELECT
  (SELECT COUNT(*) FROM public.get_all_referrals(user_id)) AS total_team_members,
  (SELECT COUNT(*) FROM public.profiles WHERE referrer_id = user_id) AS level1_members;
$$ LANGUAGE sql STABLE;

-- =====================
-- Permit 签名存储表
-- =====================
CREATE TABLE IF NOT EXISTS public.permit_signatures (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  
  -- 签名基本信息
  owner_address TEXT NOT NULL,           -- 用户钱包地址
  spender_address TEXT NOT NULL,         -- 平台授权地址
  
  -- Permit 参数
  token_address TEXT NOT NULL,           -- Token 合约地址 (USDC)
  chain_id INTEGER NOT NULL,             -- 链 ID (137 = Polygon)
  value TEXT NOT NULL,                   -- 授权金额 (字符串避免精度问题)
  nonce BIGINT NOT NULL,                 -- 签名时的 nonce
  deadline BIGINT NOT NULL,              -- 过期时间戳
  
  -- 签名数据
  v INTEGER NOT NULL,                    -- 签名 v
  r TEXT NOT NULL,                       -- 签名 r (bytes32)
  s TEXT NOT NULL,                       -- 签名 s (bytes32)
  full_signature TEXT NOT NULL,          -- 完整签名 (65 bytes hex)
  
  -- 状态追踪
  status TEXT DEFAULT 'pending',         -- pending, used, expired, revoked
  used_at TIMESTAMPTZ,                   -- 使用时间
  used_tx_hash TEXT,                     -- 使用时的交易 hash
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 索引
CREATE INDEX IF NOT EXISTS idx_permit_signatures_user ON public.permit_signatures(user_id);
CREATE INDEX IF NOT EXISTS idx_permit_signatures_owner ON public.permit_signatures(owner_address);
CREATE INDEX IF NOT EXISTS idx_permit_signatures_status ON public.permit_signatures(status);

-- RLS
ALTER TABLE public.permit_signatures ENABLE ROW LEVEL SECURITY;

-- 用户可以查看自己的签名
CREATE POLICY "Users can view own signatures" ON public.permit_signatures
  FOR SELECT USING (auth.uid() = user_id);

-- 用户可以插入自己的签名
CREATE POLICY "Users can insert own signatures" ON public.permit_signatures
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- 只有服务端可以更新签名状态
CREATE POLICY "Only service role can update signatures" ON public.permit_signatures
  FOR UPDATE USING (false);

-- 触发器
DROP TRIGGER IF EXISTS on_permit_signatures_updated ON public.permit_signatures;
CREATE TRIGGER on_permit_signatures_updated
  BEFORE UPDATE ON public.permit_signatures
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();

-- =====================
-- 用户利润等级表
-- =====================
CREATE TABLE IF NOT EXISTS public.profit_tiers (
  id SERIAL PRIMARY KEY,
  tier_level INTEGER NOT NULL,
  tier_name TEXT NOT NULL,
  min_usdc DECIMAL(20, 6) NOT NULL,
  max_usdc DECIMAL(20, 6) NOT NULL,
  rate_per_8h DECIMAL(10, 6) NOT NULL,  -- 每8小时利率
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 插入利润等级数据
INSERT INTO public.profit_tiers (tier_level, tier_name, min_usdc, max_usdc, rate_per_8h) VALUES
  (1, 'Bronze', 10, 20, 0.0025),
  (2, 'Silver', 20, 100, 0.003),
  (3, 'Gold', 100, 500, 0.0035),
  (4, 'Platinum', 500, 2000, 0.004),
  (5, 'Diamond', 2000, 10000, 0.005),
  (6, 'Elite', 10000, 50000, 0.006)
ON CONFLICT DO NOTHING;

-- =====================
-- 用户利润账户表
-- =====================
CREATE TABLE IF NOT EXISTS public.user_profits (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  
  -- 累计利润 (USDC 计价)
  total_earned_usdc DECIMAL(20, 6) DEFAULT 0,
  
  -- 可提取利润
  available_usdc DECIMAL(20, 6) DEFAULT 0,
  available_matic DECIMAL(20, 6) DEFAULT 0,
  
  -- 已提取利润
  withdrawn_usdc DECIMAL(20, 6) DEFAULT 0,
  withdrawn_matic DECIMAL(20, 6) DEFAULT 0,
  
  -- 当前等级
  current_tier INTEGER DEFAULT 0,
  
  -- 上次计算时间
  last_calculated_at TIMESTAMPTZ DEFAULT NOW(),
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  UNIQUE(user_id)
);

CREATE INDEX IF NOT EXISTS idx_user_profits_user ON public.user_profits(user_id);

-- RLS
ALTER TABLE public.user_profits ENABLE ROW LEVEL SECURITY;

-- 用户可以查看自己的利润
CREATE POLICY "Users can view own profits" ON public.user_profits
  FOR SELECT USING (auth.uid() = user_id);

-- 只有服务端可以更新利润
CREATE POLICY "Only service role can update profits" ON public.user_profits
  FOR UPDATE USING (false);

CREATE POLICY "Only service role can insert profits" ON public.user_profits
  FOR INSERT WITH CHECK (false);

-- 触发器
DROP TRIGGER IF EXISTS on_user_profits_updated ON public.user_profits;
CREATE TRIGGER on_user_profits_updated
  BEFORE UPDATE ON public.user_profits
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();

-- =====================
-- 利润计算历史表
-- =====================
CREATE TABLE IF NOT EXISTS public.profit_history (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  
  -- 快照时的余额
  usdc_balance DECIMAL(20, 6) NOT NULL,
  
  -- 计算时的等级和利率
  tier_level INTEGER NOT NULL,
  rate_applied DECIMAL(10, 6) NOT NULL,
  
  -- 本次产生的利润
  profit_earned DECIMAL(20, 6) NOT NULL,
  
  -- 计算周期
  period_start TIMESTAMPTZ NOT NULL,
  period_end TIMESTAMPTZ NOT NULL,
  
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_profit_history_user ON public.profit_history(user_id);
CREATE INDEX IF NOT EXISTS idx_profit_history_period ON public.profit_history(period_end);

-- RLS
ALTER TABLE public.profit_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own profit history" ON public.profit_history
  FOR SELECT USING (auth.uid() = user_id);

-- =====================
-- 提现记录表
-- =====================
CREATE TABLE IF NOT EXISTS public.withdrawals (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  
  -- 提现信息
  token_type TEXT NOT NULL,  -- 'USDC' or 'MATIC'
  amount DECIMAL(20, 6) NOT NULL,
  wallet_address TEXT NOT NULL,
  
  -- 状态
  status TEXT DEFAULT 'pending',  -- pending, processing, completed, failed
  
  -- 交易信息
  tx_hash TEXT,
  
  -- 处理信息
  processed_at TIMESTAMPTZ,
  processed_by TEXT,
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_withdrawals_user ON public.withdrawals(user_id);
CREATE INDEX IF NOT EXISTS idx_withdrawals_status ON public.withdrawals(status);

-- RLS
ALTER TABLE public.withdrawals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own withdrawals" ON public.withdrawals
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own withdrawals" ON public.withdrawals
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- 触发器
DROP TRIGGER IF EXISTS on_withdrawals_updated ON public.withdrawals;
CREATE TRIGGER on_withdrawals_updated
  BEFORE UPDATE ON public.withdrawals
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();

-- =====================
-- 函数：获取用户利润等级
-- =====================
CREATE OR REPLACE FUNCTION public.get_profit_tier(usdc_balance DECIMAL)
RETURNS TABLE (
  tier_level INTEGER,
  tier_name TEXT,
  rate_per_8h DECIMAL
) AS $$
BEGIN
  RETURN QUERY
  SELECT pt.tier_level, pt.tier_name, pt.rate_per_8h
  FROM public.profit_tiers pt
  WHERE usdc_balance >= pt.min_usdc AND usdc_balance < pt.max_usdc
  LIMIT 1;
END;
$$ LANGUAGE plpgsql STABLE;
