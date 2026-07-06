-- =====================================================
-- Bonus 维持期审批（防刷奖励）
-- Run in Supabase SQL editor
-- =====================================================
-- 场景：某人领取等级奖池（如 L2 Silver $100）时，若其团队 staking 比例
-- （AlphaStake 合约本金 ÷ 团队总 volume）< 50%，管理员可选择“批准但需维持”：
--   · 等级立即升、每日收益照常；但这笔奖金冻结。
--   · 需在“领取时等级的解锁门槛”上累计维持 N 天（非连续）才发放，
--     或任意时点团队 staking 比例 ≥ 50% 提前放行。
--
-- community_pool_claims.status 取值扩展：
--   pending / completed / rejected / revoked / maintenance
--   maintenance = 已批准、资金冻结、等待达标或 staking≥50% 放行。

ALTER TABLE public.community_pool_claims
  ADD COLUMN IF NOT EXISTS maintenance_required_days INTEGER,          -- 需维持的达标天数（管理员填，默认 15）
  ADD COLUMN IF NOT EXISTS maintenance_days_done INTEGER NOT NULL DEFAULT 0, -- 已累计的达标天数
  ADD COLUMN IF NOT EXISTS maintenance_threshold DECIMAL(18,6),        -- 定格标尺：领取时等级的解锁门槛
  ADD COLUMN IF NOT EXISTS maintenance_last_counted_date DATE,         -- 当天防重（每 UTC 天最多计一次）
  ADD COLUMN IF NOT EXISTS maintenance_started_at TIMESTAMPTZ,         -- 进入维持期的时间
  ADD COLUMN IF NOT EXISTS staking_ratio_at_approval DECIMAL(6,4);     -- 批准时的 staking 比例存档（参考）

-- 按 status 快速取出维持中的 claim（推进 / 放行时用）
CREATE INDEX IF NOT EXISTS idx_community_pool_claims_maintenance
  ON public.community_pool_claims(status)
  WHERE status = 'maintenance';
