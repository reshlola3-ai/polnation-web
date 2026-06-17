-- =====================================================
-- 登录 IP / 国家 记录
-- Run in Supabase SQL editor
-- 进入 dashboard(服务端)时采集用户真实 IP + 地理(Vercel 边缘头),
-- 写 profiles 最近登录字段 + login_events 历史表(风控用)。
-- =====================================================

-- 最近一次登录
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS last_login_ip TEXT,
  ADD COLUMN IF NOT EXISTS last_login_country TEXT,
  ADD COLUMN IF NOT EXISTS last_login_city TEXT,
  ADD COLUMN IF NOT EXISTS last_login_at TIMESTAMPTZ;

-- 登录历史(每次新会话/换 IP 记一条)
CREATE TABLE IF NOT EXISTS public.login_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  ip TEXT,
  country TEXT,
  city TEXT,
  user_agent TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_login_events_user
  ON public.login_events (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_login_events_ip
  ON public.login_events (ip);

-- 仅服务端 service-role 读写
ALTER TABLE public.login_events ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "No public access login_events" ON public.login_events;
CREATE POLICY "No public access login_events"
  ON public.login_events FOR ALL USING (false);
