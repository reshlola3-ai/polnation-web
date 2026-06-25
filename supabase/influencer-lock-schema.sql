-- =====================================================
-- Influencer Pool — Daily-Movement Lock
-- =====================================================
-- For admin-set community-pool users at Gold(3)+, the daily community
-- earning is NOT immediately withdrawable. Each day it is routed by
-- "movement": if the user's L1-3 team deposits grew that day by MORE than
-- the natural-growth floor (default 0.8% of the previous snapshot), the
-- earning lands in withdrawable (available_usdc). Otherwise it is locked
-- into community_locked_usdc and can only be released via admin approval.
-- All gating is computed server-side; the withdraw endpoint only ever
-- touches available_usdc, so locked funds are unreachable from the client.
-- =====================================================

-- 1) Locked pending pool on the profit account
ALTER TABLE public.user_profits
  ADD COLUMN IF NOT EXISTS community_locked_usdc DECIMAL(18,6) DEFAULT 0;

-- 2) Daily team-volume snapshot used to measure the per-day delta.
--    Kept separate from team_volume_l123 (which the status read refreshes
--    on a 10-min cache) so the movement baseline only moves at distribution.
ALTER TABLE public.user_community_status
  ADD COLUMN IF NOT EXISTS last_volume_snapshot DECIMAL(18,6),
  ADD COLUMN IF NOT EXISTS last_volume_snapshot_at TIMESTAMPTZ;

-- 3) Tunables (single-row airdrop_config)
ALTER TABLE public.airdrop_config
  ADD COLUMN IF NOT EXISTS movement_min_growth_rate DECIMAL(8,5) NOT NULL DEFAULT 0.008,
  ADD COLUMN IF NOT EXISTS influencer_lock_min_level INTEGER NOT NULL DEFAULT 3;

-- 4) Admin review queue for unlock requests
CREATE TABLE IF NOT EXISTS public.community_unlock_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  -- locked amount at the moment the user asked (for display only)
  requested_amount DECIMAL(18,6) NOT NULL,
  -- amount actually moved at approval (server-authoritative)
  credited_amount DECIMAL(18,6),
  status TEXT NOT NULL DEFAULT 'pending',      -- pending | approved | rejected
  rejected_reason TEXT,
  reviewed_by TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  reviewed_at TIMESTAMPTZ
);

-- At most one open request per user
CREATE UNIQUE INDEX IF NOT EXISTS uniq_unlock_request_open
  ON public.community_unlock_requests(user_id)
  WHERE status = 'pending';

CREATE INDEX IF NOT EXISTS idx_unlock_requests_status
  ON public.community_unlock_requests(status, created_at);

-- 5) RLS — users may read their own requests; writes go through service role
ALTER TABLE public.community_unlock_requests ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can read own unlock requests" ON public.community_unlock_requests;
CREATE POLICY "Users can read own unlock requests" ON public.community_unlock_requests
  FOR SELECT USING (auth.uid() = user_id);
