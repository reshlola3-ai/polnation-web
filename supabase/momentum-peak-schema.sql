-- Momentum 峰值高水位线（2026-08-02）
-- 规则：momentum 恢复 1.0 需团队 L1-3 业绩 **超过历史最高(峰值) > 3% 且高出 ≥ $10**；
-- 否则每次发放 -0.2（到 0）。峰值只升不降——撤走再冲回旧水平不算增长，防止反复刷。

ALTER TABLE public.user_community_status
  ADD COLUMN IF NOT EXISTS peak_volume_l123 DECIMAL(18,6) DEFAULT 0;

-- 回填：以现有团队业绩与上次快照的较大者为初始峰值，
-- 避免上线当天所有人立刻从 1.0 掉倍率（否则峰值=0 时任何正业绩都会"达标"）。
UPDATE public.user_community_status
SET peak_volume_l123 = GREATEST(
  COALESCE(team_volume_l123, 0),
  COALESCE(last_volume_snapshot, 0),
  COALESCE(peak_volume_l123, 0)
)
WHERE COALESCE(peak_volume_l123, 0) < GREATEST(COALESCE(team_volume_l123, 0), COALESCE(last_volume_snapshot, 0));

-- 校验：看几个人的峰值 vs 当前业绩
-- SELECT user_id, team_volume_l123, last_volume_snapshot, peak_volume_l123, momentum_multiplier
-- FROM public.user_community_status ORDER BY team_volume_l123 DESC LIMIT 20;
