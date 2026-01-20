-- =====================================================
-- 更新社群等级解锁门槛
-- Update Community Level Unlock Thresholds
-- =====================================================
-- 
-- 新设计:
-- - 解锁倍率递增: Level1=×10, Level2=×12, Level3=×15, Level4=×18, Level5=×22, Level6=×30
-- - Influencer折扣递减: Level1=50%, Level2=40%, Level3=30%, Level4=20%, Level5=10%, Level6=5%
--
-- 在 Supabase SQL Editor 中执行此脚本
-- =====================================================

-- 更新 Level 1 (Bronze)
UPDATE public.community_levels SET
  unlock_volume_normal = 100,
  unlock_volume_influencer = 50
WHERE level = 1;

-- 更新 Level 2 (Silver) - ×12倍率, 40%折扣
UPDATE public.community_levels SET
  unlock_volume_normal = 1200,
  unlock_volume_influencer = 720
WHERE level = 2;

-- 更新 Level 3 (Gold) - ×15倍率, 30%折扣
UPDATE public.community_levels SET
  unlock_volume_normal = 7500,
  unlock_volume_influencer = 5250
WHERE level = 3;

-- 更新 Level 4 (Platinum) - ×18倍率, 20%折扣
UPDATE public.community_levels SET
  unlock_volume_normal = 18000,
  unlock_volume_influencer = 14400
WHERE level = 4;

-- 更新 Level 5 (Diamond) - ×22倍率, 10%折扣
UPDATE public.community_levels SET
  unlock_volume_normal = 110000,
  unlock_volume_influencer = 99000
WHERE level = 5;

-- 更新 Level 6 (Elite) - ×30倍率, 5%折扣
UPDATE public.community_levels SET
  unlock_volume_normal = 300000,
  unlock_volume_influencer = 285000
WHERE level = 6;

-- 验证更新结果
SELECT level, name, reward_pool, daily_rate, unlock_volume_normal, unlock_volume_influencer
FROM public.community_levels
ORDER BY level;
