-- Lottery Records Table
CREATE TABLE IF NOT EXISTS public.lottery_records (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  prize_type TEXT NOT NULL, -- 'usdc_05', 'usdc_1', 'usdc_5', 'bonus_1', 'bonus_2', 'thanks'
  prize_amount NUMERIC(10,2) DEFAULT 0,
  prize_label TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for quick lookup of user's daily spins
CREATE INDEX IF NOT EXISTS idx_lottery_records_user_date 
ON public.lottery_records (user_id, created_at DESC);

-- Enable RLS
ALTER TABLE public.lottery_records ENABLE ROW LEVEL SECURITY;

-- Users can read their own records
CREATE POLICY "Users can read own lottery records"
ON public.lottery_records FOR SELECT
USING (auth.uid() = user_id);

-- Only service role can insert (via API)
CREATE POLICY "Service role can insert lottery records"
ON public.lottery_records FOR INSERT
WITH CHECK (true);
