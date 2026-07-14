-- =====================================================
-- Bonus 分期发放审批（达标后按天匀速兑付）
-- Run in Supabase SQL editor
-- =====================================================
-- 场景：某人达标领取等级奖池（如 L2 Silver $100），管理员选择“批准但分期发放”：
--   · 等级立即升、每日收益照常（与维持一致）。
--   · 这笔奖金不一次性放出，而是按天匀速解锁到 available_usdc：
--     每天放 round(总额 ÷ 总天数, 6)，最后一天补足余数，保证总和精确等于奖金。
--   · 无条件时间 vesting —— 不看团队 volume、不看质押，到点就放（与维持的“带条件”区分）。
--   · 由每日发放任务（airdrop/distribute 与 community/daily-earnings 两条路径）推进，
--     靠 installment_last_date 每 UTC 天防重。
--
-- community_pool_claims.status 取值再扩展：
--   pending / completed / rejected / revoked / maintenance / installment
--   installment = 已批准、按天分期发放中；发满后转 completed。

ALTER TABLE public.community_pool_claims
  ADD COLUMN IF NOT EXISTS installment_total_days INTEGER,               -- 总分期天数（管理员填，默认 10）
  ADD COLUMN IF NOT EXISTS installment_days_done INTEGER NOT NULL DEFAULT 0,   -- 已发放天数
  ADD COLUMN IF NOT EXISTS installment_released DECIMAL(18,6) NOT NULL DEFAULT 0, -- 已累计发放金额（用于最后一天补足余数）
  ADD COLUMN IF NOT EXISTS installment_last_date DATE,                   -- 当天防重（每 UTC 天最多发一次）
  ADD COLUMN IF NOT EXISTS installment_started_at TIMESTAMPTZ;           -- 进入分期的时间

-- 按 status 快速取出分期中的 claim（每日推进时用）
CREATE INDEX IF NOT EXISTS idx_community_pool_claims_installment
  ON public.community_pool_claims(status)
  WHERE status = 'installment';
