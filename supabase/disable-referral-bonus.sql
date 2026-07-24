-- 推荐奖励活动下线（2026-07-24）
-- 摘掉"下线绑钱包 → 给推荐人自动发 $1"的触发器，停止新增 referral_task_bonus。
-- 保留表、函数和历史数据；想恢复就重跑 new-tasks-schema.sql 里的 CREATE TRIGGER 段。

DROP TRIGGER IF EXISTS trigger_create_referral_task_bonus ON public.profiles;

-- 校验：应返回 0 行
-- SELECT tgname FROM pg_trigger WHERE tgname = 'trigger_create_referral_task_bonus';
