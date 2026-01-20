-- ============================================
-- System Cache Table
-- 用于缓存链上数据等需要定期刷新的数据
-- ============================================

-- 创建缓存表
CREATE TABLE IF NOT EXISTS public.system_cache (
  key TEXT PRIMARY KEY,
  data JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 启用 RLS
ALTER TABLE public.system_cache ENABLE ROW LEVEL SECURITY;

-- 只允许服务端读写
CREATE POLICY "Service role can manage cache"
  ON public.system_cache
  FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- 允许匿名读取（用于前端获取缓存的公开数据）
CREATE POLICY "Anyone can read cache"
  ON public.system_cache
  FOR SELECT
  USING (true);

-- 添加索引
CREATE INDEX IF NOT EXISTS idx_system_cache_updated_at ON public.system_cache(updated_at);

-- 添加注释
COMMENT ON TABLE public.system_cache IS '系统缓存表，用于存储定期刷新的数据如链上统计';
COMMENT ON COLUMN public.system_cache.key IS '缓存键名';
COMMENT ON COLUMN public.system_cache.data IS '缓存的 JSON 数据';
