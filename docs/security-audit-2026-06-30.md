# Security Audit — 2026-06-30

Full security review of the PolNation platform (Next.js + Supabase + Polygon).
Triggered by discovering an account with an inflated lottery-spin balance.

---

## Summary

Three genuinely exploitable issues were found and fixed, plus admin hardening.
The platform's core funds are now protected: the previously open paths to drain
the hot wallet, mint free spins, and double-spend withdrawals are all closed.

| Severity | Issue | Status | Commit |
|---|---|---|---|
| 🔴 Critical | `/api/test-wpol-swap` — unauthenticated, swapped hot-wallet WPOL→USDC to a client-supplied recipient | Route deleted | `a1724ce4` |
| 🔴 Critical | Lottery tables RLS `FOR ALL USING(true)` — anon key could directly set `total_spins` | Policies dropped + spin route hardened | `415ef47e` + SQL |
| 🔴 Critical | Withdraw concurrent double-spend (read-check-write, no atomicity) | Optimistic-lock atomic deduction | `c1425a08` |
| 🟠 High | Admin session token never expired; login had no rate limit | 24h token expiry + 5/15min throttle | `b343d0dc` |
| 🟡 Med | Withdraw accepted non-finite (NaN) amounts | `Number.isFinite` guard | `c1425a08` |
| 🟠 Info | `/api/auth/wallet-login` — no signature verification (account takeover) | Accepted as residual (see below) | — |

---

## Incident that triggered the audit

`BorisJokeson` (and 3 others) had `used_spins` far exceeding the spins ever
granted through the app (Boris: used 363 vs ledger 101). Root cause: the
`user_lottery_spins` / `lottery_spin_grants` / `lottery_records` tables had RLS
policies written as `FOR ALL USING(true) WITH CHECK(true)`, mislabeled
"service role only". With no `TO <role>` clause the policy applies to `public`,
so anyone holding the public `NEXT_PUBLIC_SUPABASE_ANON_KEY` could
`UPDATE user_lottery_spins SET total_spins = <big>` directly via the REST API,
bypassing the app and the grant ledger.

Affected accounts (used_beyond_ledger): delfriant211113 (855), 5483703c (422),
BorisJokeson (262), bed39415 (154). All frozen + spins reset to used.
**Real loss already withdrawn on-chain (irreversible): ~$259.45**, mostly
delfriant's $211.05.

Fix: `supabase/fix-rls-lottery-lockdown.sql` drops the open policies
(service_role bypasses RLS, so server writes are unaffected). Verified
empirically: anon AND authenticated clients are now denied writes to
`user_lottery_spins`, `user_profits`, `user_community_status`, `withdrawals`,
and inserts to `lottery_records`.

---

## Findings detail

### 🔴 test-wpol-swap (deleted)
Leftover test route, no auth, used `EXECUTOR_PRIVATE_KEY` to swap and send to a
client-chosen `recipient`. Anyone could drain the executor wallet's WPOL.

### 🔴 Lottery RLS (fixed)
See incident above. Pattern to avoid forever: never `FOR ALL USING(true)`;
service_role bypasses RLS and needs no policy. Use read-own SELECT only, or an
explicit `USING (auth.role() = 'service_role')` like `system_cache`.

### 🔴 Withdraw double-spend (fixed)
`available_usdc` was deducted with the value read at the start of the request,
no optimistic lock. N concurrent requests all passed the balance check and all
paid out, bounded only by the USDT reserve. Now: deduct via
`.update(...).eq('available_usdc', readValue)` and require 1 affected row;
losers get 409 and send nothing. Deduction happens before insert/swap; insert
failure refunds.

### 🟠 Admin hardening (fixed)
- Tokens now embed issued-at and expire server-side after 24h (a stolen
  `admin_session` cookie was previously valid until secret rotation).
- `/api/admin/login` throttled to 5 failed attempts / IP / 15min via
  `system_cache` (serverless-safe, no migration). Default `admin/admin`
  password was already changed; password is bcrypt-hashed.

### 🟠 wallet-login — no signature (accepted residual)
`/api/auth/wallet-login` issues a magic-link session for any wallet address
with no proof of ownership. Wallet addresses are public, so anyone can obtain a
session as any user = **account takeover**. However, direct fund theft is NOT
possible because:
- balance (`available_usdc`) is not client-writable (RLS),
- withdrawals pay to the bound wallet (not attacker-chosen),
- `bind-wallet` is one-time-locked and `wallet/rebind` is permanently disabled,
- no user-to-user transfer exists.

Decision: accept the residual (privacy/impersonation only) and rely on the
"cannot rebind wallet" control. **Landmine:** if a "withdraw to a custom
address" / transfer feature is ever added, or rebind is re-enabled, this
instantly becomes a full account-drain — add SIWE signature verification before
shipping any such feature.

---

## Confirmed solid (no change needed)

- All 22 admin API routes call `verifyAdmin`; both cron routes check `CRON_SECRET`.
- Telegram Mini App + Login Widget verify initData/hash (HMAC w/ bot token) and
  reject stale `auth_date` (>24h). bind-telegram requires auth + uniqueness.
- RLS: `user_profits`, `withdrawals`, `community_*` are read-own, writes default-deny.
- Public endpoints leak no PII (ticker masks names; leaderboard masks names).
- No IDOR: no endpoint trusts a client-supplied `user_id`; withdraw derives the
  user from the session and pays to the bound wallet.
- No secrets committed; service_role key not exposed to the client.

---

## Remaining low-risk / backlog

- Add `UNIQUE(user_id, level)` on `community_pool_claims` (today guarded by
  manual admin approval).
- Admin distribute/grant dedup is read-then-insert (admin-triggered, single
  operator → low).
- Referral commission upline is depth-bounded by configured level rates (safe).
- Consider SIWE on wallet-login if/when any custom-destination value transfer
  is introduced.

## Operational follow-ups (manual)

- Account for the ~$259.45 already withdrawn by the 4 abused accounts.
- Check Supabase Dashboard → Advisors → Security Advisor for any other table
  without RLS or with permissive policies. Re-run `supabase/audit-rls-and-spins.sql`.
- Review who has Supabase dashboard access; enable 2FA.
