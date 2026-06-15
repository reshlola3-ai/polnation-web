-- =====================================================
-- 社群奖池 Claim 身份验证（电话版）· 自包含、可重复执行
-- Run in Supabase SQL editor
-- 说明：首次 claim 采集真名 + 电话（带区号），不再采集照片。
--      本脚本无论 user_identity 是否已存在都能安全跑。
-- =====================================================

-- 1) 身份表：真名 + 电话（photo_path 保留但可空，兼容老照片记录）
CREATE TABLE IF NOT EXISTS public.user_identity (
  user_id UUID PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
  real_name TEXT NOT NULL,
  phone TEXT,
  photo_path TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 若表是更早的照片版（photo_path NOT NULL、无 phone），补齐/放宽：
ALTER TABLE public.user_identity ADD COLUMN IF NOT EXISTS phone TEXT;
ALTER TABLE public.user_identity ALTER COLUMN photo_path DROP NOT NULL;

ALTER TABLE public.user_identity ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "No public access user_identity" ON public.user_identity;
CREATE POLICY "No public access user_identity"
  ON public.user_identity FOR ALL USING (false);

-- 2) 账号级 claim 冻结标记（claim 路由 + 管理员审批用）
ALTER TABLE public.user_community_status
  ADD COLUMN IF NOT EXISTS claims_frozen BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS frozen_reason TEXT,
  ADD COLUMN IF NOT EXISTS frozen_at TIMESTAMPTZ;

-- 3) claim 审批字段
ALTER TABLE public.community_pool_claims
  ADD COLUMN IF NOT EXISTS reviewed_by TEXT,
  ADD COLUMN IF NOT EXISTS reviewed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS rejected_reason TEXT;

-- 4) 强制 PostgREST 重新加载 schema 缓存
--    （否则即使表已建好，App 经 REST 插入仍可能报 PGRST205 → "failed to save identity"）
NOTIFY pgrst, 'reload schema';
