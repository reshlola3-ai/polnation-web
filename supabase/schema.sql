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
