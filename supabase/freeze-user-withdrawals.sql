-- =====================================================
-- 账户级提现冻结(欺诈处置)
-- Run in Supabase SQL editor
-- 用途:封禁刷 spin 漏洞的用户提现 + 清零其可提现余额。
--       withdraw 接口会读 user_profits.withdrawals_frozen,为 true 直接 403。
-- =====================================================

ALTER TABLE public.user_profits
  ADD COLUMN IF NOT EXISTS withdrawals_frozen BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS frozen_reason TEXT,
  ADD COLUMN IF NOT EXISTS frozen_at TIMESTAMPTZ;

-- 封禁 + 清零(spin 发放漏洞,白嫖 910 次)
UPDATE public.user_profits
SET withdrawals_frozen = true,
    frozen_reason = 'spin-grant duplication exploit (910 illegitimate spins)',
    frozen_at = NOW(),
    available_usdc = 0,
    available_matic = 0,
    available_commission = 0
WHERE user_id = 'f7601ebd-bdd8-4739-8cc6-8e83b3d04d17';

-- 解封某个用户(需要时):
-- UPDATE public.user_profits
-- SET withdrawals_frozen = false, frozen_reason = NULL, frozen_at = NULL
-- WHERE user_id = '<uuid>';
