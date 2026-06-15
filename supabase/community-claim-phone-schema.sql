-- =====================================================
-- 社群奖池 Claim 身份验证：照片 → 电话
-- Run in Supabase SQL editor
-- 说明：不再采集自拍照片，首次 claim 改为采集真名 + 电话（带区号）。
-- =====================================================

-- 1) 新增电话字段
ALTER TABLE public.user_identity
  ADD COLUMN IF NOT EXISTS phone TEXT;

-- 2) 旧的 photo_path 不再必填（新记录不带照片）。老记录保留原值。
ALTER TABLE public.user_identity
  ALTER COLUMN photo_path DROP NOT NULL;

-- 注：claim-identity Storage bucket 保留即可（老照片仍在），无需删除。
