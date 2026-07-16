-- =====================================================
-- 佣金发放比例（可配置打折）
-- Run in Supabase SQL editor
-- =====================================================
-- 推荐佣金发放时按此比例打折：commission = profit × rate% × (commission_payout_pct / 100)。
-- 默认 100 = 全额；设 50 = 五折；设 0 = 暂停发佣金。只影响 referral_commissions，
-- 不影响空投利润与社群日薪。底层 referral_commission_rates 的比例不变。

ALTER TABLE public.airdrop_config
  ADD COLUMN IF NOT EXISTS commission_payout_pct DECIMAL(6,2) NOT NULL DEFAULT 100;
