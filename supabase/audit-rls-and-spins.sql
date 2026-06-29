-- =====================================================
-- SECURITY AUDIT QUERIES (read-only) — run in Supabase SQL Editor
-- =====================================================

-- A) Tables in `public` with RLS DISABLED (anyone with anon key can read/write).
--    Expect: zero rows. Any row here is a hole — enable RLS on it.
select schemaname, tablename, rowsecurity
from pg_tables
where schemaname = 'public' and rowsecurity = false
order by tablename;

-- B) Permissive WRITE policies open to anon/authenticated/public — the exact
--    bug that was exploited (FOR ALL/INSERT/UPDATE/DELETE with USING/CHECK = true).
--    Expect: zero rows after the lockdown migration.
select schemaname, tablename, policyname, cmd, roles, qual, with_check
from pg_policies
where schemaname = 'public'
  and cmd in ('ALL','INSERT','UPDATE','DELETE')
  and (qual = 'true' or with_check = 'true')
  and roles && array['public','anon','authenticated']::name[]
order by tablename, policyname;

-- C) RLS enabled but NO policies at all (writes default-deny — usually fine,
--    but flags tables you may have forgotten to add a read policy to).
select t.tablename
from pg_tables t
left join pg_policies p on p.schemaname = t.schemaname and p.tablename = t.tablename
where t.schemaname = 'public' and t.rowsecurity = true and p.policyname is null
order by t.tablename;

-- =====================================================
-- D) SPIN-ABUSE AUDIT — used more spins than were ever legitimately granted.
--    You can't spend spins you were never given through the app, so any large
--    `used_beyond_ledger` means spins were injected by a direct out-of-band write.
-- =====================================================
select s.user_id, p.email, p.username,
       s.total_spins, s.used_spins,
       coalesce(g.granted, 0)               as ledger_granted,
       s.used_spins - coalesce(g.granted,0) as used_beyond_ledger
from user_lottery_spins s
left join (
  select user_id, sum(spins_granted) as granted
  from lottery_spin_grants group by user_id
) g on g.user_id = s.user_id
left join profiles p on p.id = s.user_id
where s.used_spins > coalesce(g.granted, 0) + 3   -- +3 tolerance for streak noise
order by used_beyond_ledger desc;
