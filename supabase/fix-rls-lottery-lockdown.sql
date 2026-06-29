-- =====================================================
-- SECURITY FIX — lock down lottery tables RLS
-- =====================================================
-- Bug: these tables had `FOR ALL USING(true) WITH CHECK(true)` policies
-- (mislabeled "service role only"). With no role restriction the policy
-- applies to `public`, so ANY client holding the public anon key could
-- INSERT/UPDATE/DELETE rows — e.g. set user_lottery_spins.total_spins to
-- an arbitrary value and farm withdrawable USDC.
--
-- service_role BYPASSES RLS, so the server (using SUPABASE_SERVICE_ROLE_KEY)
-- keeps full write access after these policies are dropped. Clients keep
-- only the read-own SELECT policy (default-deny on writes), matching the
-- secure pattern already used by user_profits / community_* tables.
-- =====================================================

-- 1) user_lottery_spins — remove the open write policy
DROP POLICY IF EXISTS "Service role can manage lottery spins" ON public.user_lottery_spins;

-- 2) lottery_spin_grants — remove the open write policy
DROP POLICY IF EXISTS "Service role can manage spin grants" ON public.lottery_spin_grants;

-- 3) lottery_records — remove the open INSERT policy
DROP POLICY IF EXISTS "Service role can insert lottery records" ON public.lottery_records;

-- (Optional hardening — keep server writes explicit & self-documenting.
--  Not required, since service_role already bypasses RLS. Uncomment if you
--  prefer an explicit service-role policy like system_cache uses.)
-- CREATE POLICY "service_role writes lottery spins"
--   ON public.user_lottery_spins FOR ALL
--   USING (auth.role() = 'service_role') WITH CHECK (auth.role() = 'service_role');
-- CREATE POLICY "service_role writes spin grants"
--   ON public.lottery_spin_grants FOR ALL
--   USING (auth.role() = 'service_role') WITH CHECK (auth.role() = 'service_role');
-- CREATE POLICY "service_role writes lottery records"
--   ON public.lottery_records FOR INSERT
--   WITH CHECK (auth.role() = 'service_role');

-- =====================================================
-- VERIFY: list remaining policies on these tables (run after)
--   SELECT tablename, policyname, cmd, roles, qual, with_check
--   FROM pg_policies
--   WHERE tablename IN ('user_lottery_spins','lottery_spin_grants','lottery_records');
-- Expect: only the "Users can read own ..." SELECT policies remain.
-- =====================================================
