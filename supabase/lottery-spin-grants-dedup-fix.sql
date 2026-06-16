-- =====================================================
-- 抽奖 spin 发放漏洞修复:去重 + 重算 + 唯一约束
-- Run in Supabase SQL editor (一次性)
--
-- 漏洞:check-spins 用 .maybeSingle() 判重,一旦出现 2 条重复就报错返回 null,
--       导致"已发放?"永远假阴性 → 每次打开抽奖页都再发一次 spin(welcome/referral
--       runaway)。lottery_spin_grants 又没有唯一约束兜底。
-- 影响:3 个用户共 910 条重复发放(白嫖 910 次 spin)。
-- 处理:删重复(每个逻辑键保留最早一条)→ 重算受影响用户 total_spins → 加唯一索引。
--       已提现部分不追回。
-- =====================================================

BEGIN;

-- 1) 先记录"有重复"的受影响用户(去重前)
CREATE TEMP TABLE _affected_users ON COMMIT DROP AS
SELECT DISTINCT user_id FROM (
  SELECT user_id
  FROM public.lottery_spin_grants
  GROUP BY user_id, grant_reason,
    COALESCE(referral_id, '00000000-0000-0000-0000-000000000000'::uuid),
    COALESCE(milestone_count, 0)
  HAVING COUNT(*) > 1
) d;

-- 2) 删除重复发放行,每个逻辑键(user+reason+referral+milestone)保留最早一条
DELETE FROM public.lottery_spin_grants g
USING (
  SELECT id,
    ROW_NUMBER() OVER (
      PARTITION BY user_id, grant_reason,
        COALESCE(referral_id, '00000000-0000-0000-0000-000000000000'::uuid),
        COALESCE(milestone_count, 0)
      ORDER BY created_at ASC, id ASC
    ) AS rn
  FROM public.lottery_spin_grants
) d
WHERE g.id = d.id AND d.rn > 1;

-- 3) 受影响用户 total_spins 重算 = 去重后 grants 之和(清掉白嫖的余额)
--    used_spins 不动;remaining = total - used 变负数会被前端 clamp 到 0,
--    即这些号无法再抽,已抽出的不追回。
UPDATE public.user_lottery_spins uls
SET total_spins = COALESCE(sub.s, 0), updated_at = NOW()
FROM (
  SELECT user_id, SUM(spins_granted) AS s
  FROM public.lottery_spin_grants
  WHERE user_id IN (SELECT user_id FROM _affected_users)
  GROUP BY user_id
) sub
WHERE uls.user_id = sub.user_id;

-- 4) 唯一约束兜底:同一逻辑键只能有一条发放记录(并发也插不进第二条)
CREATE UNIQUE INDEX IF NOT EXISTS uq_lottery_spin_grants_key
ON public.lottery_spin_grants (
  user_id, grant_reason,
  COALESCE(referral_id, '00000000-0000-0000-0000-000000000000'::uuid),
  COALESCE(milestone_count, 0)
);

COMMIT;
