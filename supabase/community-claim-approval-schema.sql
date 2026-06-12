-- =====================================================
-- 社群奖池 Claim 审批 + 身份验证
-- Run in Supabase SQL editor
-- =====================================================

-- 1) 用户身份（首次 claim 采集，复用）：自拍照片 + 真名
CREATE TABLE IF NOT EXISTS public.user_identity (
  user_id UUID PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
  real_name TEXT NOT NULL,
  photo_path TEXT NOT NULL,                 -- Storage 路径（私有 bucket: claim-identity）
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.user_identity ENABLE ROW LEVEL SECURITY;
CREATE POLICY "No public access user_identity"
  ON public.user_identity FOR ALL USING (false);

-- 2) 账号级冻结标记（驳回 claim 时冻结整账号的 claim）
ALTER TABLE public.user_community_status
  ADD COLUMN IF NOT EXISTS claims_frozen BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS frozen_reason TEXT,
  ADD COLUMN IF NOT EXISTS frozen_at TIMESTAMPTZ;

-- 3) claim 审批字段（status 已存在：pending / completed / rejected）
ALTER TABLE public.community_pool_claims
  ADD COLUMN IF NOT EXISTS reviewed_by TEXT,
  ADD COLUMN IF NOT EXISTS reviewed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS rejected_reason TEXT;

-- 旧记录默认是 'completed'，新 claim 将以 'pending' 插入。
-- UNIQUE(user_id, level) 仍然有效：每个等级一条记录（pending 占位，approve 后转 completed）。

-- 4) 私有 Storage bucket（存自拍照片）
INSERT INTO storage.buckets (id, name, public)
VALUES ('claim-identity', 'claim-identity', false)
ON CONFLICT (id) DO NOTHING;

-- bucket 不加任何 public/anon 策略；仅服务端用 service role 读写 + 签名 URL。
