-- 每日 spin 连胜
-- Run in Supabase SQL editor
ALTER TABLE public.user_lottery_spins
  ADD COLUMN IF NOT EXISTS last_spin_date DATE,
  ADD COLUMN IF NOT EXISTS current_streak INTEGER NOT NULL DEFAULT 0;
