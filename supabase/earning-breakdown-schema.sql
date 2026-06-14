-- 收入构成：单独记录 AlphaStake 质押利润（与 agentic 分开）
-- Run in Supabase SQL editor
-- 说明：profit_history.profit_earned 仍是「agentic + 质押」合计；
--      alpha_earned 是其中质押部分。agentic = profit_earned - alpha_earned。
--      仅对执行本迁移之后发放的轮次生效（历史轮 alpha_earned = 0）。

ALTER TABLE public.airdrop_calculations
  ADD COLUMN IF NOT EXISTS alpha_profit_usdc DECIMAL(18,6) NOT NULL DEFAULT 0;

ALTER TABLE public.profit_history
  ADD COLUMN IF NOT EXISTS alpha_earned DECIMAL(18,6) NOT NULL DEFAULT 0;
