-- =====================================================
-- 余额快照(风控/业绩分析):每次发放时给每个用户拍一张余额
-- Run in Supabase SQL editor
-- =====================================================
-- 用来区分"团队业绩增长"到底是【真入金】还是【只是吃息(自然增长)】还是【撤资】。
--
-- 每张快照记三个数(都来自发放流程已有的数据，零额外链上读取):
--   chain_usdc        = 钱包 USDC + AlphaStake 未平仓本金（refreshAllNaturalLevels 已读）
--   available_usdc    = 平台可提现余额（user_profits）
--   total_earned_usdc = 累计平台收益（user_profits）→ 相邻两张之差 = 该周期吃的息
--
-- 分析（相邻两张快照）：
--   总资产      = chain_usdc + available_usdc
--   自然增长(息) = Δtotal_earned_usdc
--   净外部流水   = Δ总资产 − 自然增长   （>0 入金 / <0 撤资 / ≈0 纯吃息）

CREATE TABLE IF NOT EXISTS public.user_balance_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  taken_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  chain_usdc DECIMAL(18,6) NOT NULL DEFAULT 0,
  available_usdc DECIMAL(18,6) NOT NULL DEFAULT 0,
  total_earned_usdc DECIMAL(18,6) NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_balance_snapshots_user
  ON public.user_balance_snapshots (user_id, taken_at DESC);
CREATE INDEX IF NOT EXISTS idx_balance_snapshots_taken
  ON public.user_balance_snapshots (taken_at DESC);

-- 仅服务端 service-role 读写
ALTER TABLE public.user_balance_snapshots ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "No public access balance_snapshots" ON public.user_balance_snapshots;
CREATE POLICY "No public access balance_snapshots"
  ON public.user_balance_snapshots FOR ALL USING (false);
