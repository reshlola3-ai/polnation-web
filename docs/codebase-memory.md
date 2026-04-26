# Polnation Codebase Memory

## Overview

`polnation` is a Next.js App Router project that combines:

- A public-facing marketing site
- A Supabase-backed user account system
- Polygon wallet connectivity and USDC balance reads
- A multi-track reward system
- An admin-operated settlement and operations backend

The product is not a pure on-chain app and not a pure Web2 dashboard. It is a hybrid system where:

- On-chain data is read from Polygon, mainly USDC balances
- Most business state is stored in Supabase
- Rewards are credited in platform-controlled database ledgers
- Admin tools are used to review, calculate, distribute, and execute sensitive actions

## Tech Stack

- Next.js 16 App Router
- React 19
- Tailwind CSS 4
- Supabase Auth + Postgres
- `next-intl` for i18n
- `wagmi` + `@web3modal/wagmi` for wallet connectivity
- `viem` for chain reads and contract interactions

Key root files:

- [package.json](/g:/polnation/package.json)
- [app/layout.tsx](/g:/polnation/app/layout.tsx)
- [app/page.tsx](/g:/polnation/app/page.tsx)
- [app/globals.css](/g:/polnation/app/globals.css)

## High-Level Product Model

The system revolves around five reward tracks:

1. Personal profit based on wallet USDC balance
2. Referral commission based on downstream earnings
3. Task bonus that increases community unlock progress
4. Community pool rewards and daily community earnings
5. Lottery rewards, which either become withdrawable USDC or unlock bonus

Core idea:

- Users hold or bind a wallet
- The platform reads USDC balances on Polygon
- The backend calculates and credits rewards
- Tasks and referrals push community unlock progress
- Admin workflows drive the actual settlement lifecycle

## Frontend Structure

### Public / Marketing

Main entry:

- [app/page.tsx](/g:/polnation/app/page.tsx)

Purpose:

- Landing page
- Branding and conversion
- SEO and structured data
- Entry into login and registration

### Auth

Main routes:

- [app/(auth)/login/page.tsx](/g:/polnation/app/(auth)/login/page.tsx)
- [app/(auth)/register/page.tsx](/g:/polnation/app/(auth)/register/page.tsx)
- [app/(auth)/register/verify/page.tsx](/g:/polnation/app/(auth)/register/verify/page.tsx)
- [app/(auth)/forgot-password/page.tsx](/g:/polnation/app/(auth)/forgot-password/page.tsx)

### User Dashboard

Protected layout:

- [app/(dashboard)/layout.tsx](/g:/polnation/app/(dashboard)/layout.tsx)

Main dashboard:

- [app/(dashboard)/dashboard/page.tsx](/g:/polnation/app/(dashboard)/dashboard/page.tsx)
- [app/(dashboard)/dashboard/DashboardClient.tsx](/g:/polnation/app/(dashboard)/dashboard/DashboardClient.tsx)

Important user pages:

- [app/(dashboard)/profile/page.tsx](/g:/polnation/app/(dashboard)/profile/page.tsx)
- [app/(dashboard)/earnings/page.tsx](/g:/polnation/app/(dashboard)/earnings/page.tsx)
- [app/(dashboard)/team/page.tsx](/g:/polnation/app/(dashboard)/team/page.tsx)
- [app/(dashboard)/tasks/page.tsx](/g:/polnation/app/(dashboard)/tasks/page.tsx)
- [app/(dashboard)/test-lottery/page.tsx](/g:/polnation/app/(dashboard)/test-lottery/page.tsx)

Supporting UI:

- [components/layout/Navbar.tsx](/g:/polnation/components/layout/Navbar.tsx)
- [components/layout/BottomNav.tsx](/g:/polnation/components/layout/BottomNav.tsx)
- [components/layout/LanguageSwitcher.tsx](/g:/polnation/components/layout/LanguageSwitcher.tsx)
- [components/wallet/ConnectWallet.tsx](/g:/polnation/components/wallet/ConnectWallet.tsx)
- [components/wallet/PermitSigner.tsx](/g:/polnation/components/wallet/PermitSigner.tsx)
- [components/lottery/LotteryWheel.tsx](/g:/polnation/components/lottery/LotteryWheel.tsx)

### Admin

Admin pages:

- [app/(admin)/admin/login/page.tsx](/g:/polnation/app/(admin)/admin/login/page.tsx)
- [app/(admin)/admin/users/page.tsx](/g:/polnation/app/(admin)/admin/users/page.tsx)
- [app/(admin)/admin/signatures/page.tsx](/g:/polnation/app/(admin)/admin/signatures/page.tsx)
- [app/(admin)/admin/tasks/page.tsx](/g:/polnation/app/(admin)/admin/tasks/page.tsx)
- [app/(admin)/admin/community/page.tsx](/g:/polnation/app/(admin)/admin/community/page.tsx)
- [app/(admin)/admin/airdrop/page.tsx](/g:/polnation/app/(admin)/admin/airdrop/page.tsx)

## Login and Identity

### Normal User Login

There are two user-facing login entry modes:

1. Email login
2. Wallet login

Both end with a Supabase Auth session.

#### Email Login

Traditional Supabase Auth flow:

- Email and password are submitted
- Supabase session is created
- Protected routes use server-side `supabase.auth.getUser()` checks

Protected layout example:

- [app/(dashboard)/layout.tsx](/g:/polnation/app/(dashboard)/layout.tsx)

#### Wallet Login

Wallet login is not pure wallet-auth. It is wallet-assisted account lookup/creation.

Key files:

- [components/wallet/WalletLogin.tsx](/g:/polnation/components/wallet/WalletLogin.tsx)
- [app/api/auth/wallet-login/route.ts](/g:/polnation/app/api/auth/wallet-login/route.ts)

Flow:

1. User connects wallet on the frontend
2. Frontend sends `walletAddress` to `/api/auth/wallet-login`
3. Backend looks for a profile with `profiles.wallet_address`
4. If found, backend generates a Supabase magic link for that account
5. If not found and auto-register is enabled, backend creates:
   - A Supabase Auth user
   - A placeholder wallet email like `xxxx@wallet.polnation.com`
   - A profile row
   - Then generates a magic link
6. Frontend verifies the magic link and establishes a Supabase session

Result:

- Wallet login still becomes a Supabase Auth login
- Wallet connection itself is not the final logged-in state

### Wallet Placeholder Email Accounts

Wallet-first users may initially have a placeholder email.

Key file:

- [app/api/auth/bind-email/route.ts](/g:/polnation/app/api/auth/bind-email/route.ts)

This allows later binding of a real email to upgrade the account into a more standard auth identity.

### Admin Login

Admin auth is a separate system from normal users.

Key files:

- [lib/admin-auth.ts](/g:/polnation/lib/admin-auth.ts)
- [app/api/admin/login/route.ts](/g:/polnation/app/api/admin/login/route.ts)
- [app/api/admin/logout/route.ts](/g:/polnation/app/api/admin/logout/route.ts)

Flow:

1. Admin submits username and password
2. Backend validates them using the `verify_admin` database function
3. Backend generates a signed `admin_session` cookie
4. Admin APIs check this cookie with `verifyAdmin()`

This does not use Supabase Auth.

## Wallet Logic

### Supported Wallet Policy

The product intentionally restricts supported wallets.

Key files:

- [lib/wallet-utils.ts](/g:/polnation/lib/wallet-utils.ts)
- [components/wallet/ConnectWallet.tsx](/g:/polnation/components/wallet/ConnectWallet.tsx)

Supported:

- Trust Wallet
- Bitget Wallet

Many common wallets are explicitly blocked in UI logic, including MetaMask and others.

### Binding Wallets

Wallet binding is handled in multiple places:

- Profile page can auto-bind when a connected address appears
- Connect wallet component can bind if the wallet is not already bound
- Rebind flow exists to detach a wallet from one account and attach it to another

Key files:

- [app/(dashboard)/profile/page.tsx](/g:/polnation/app/(dashboard)/profile/page.tsx)
- [components/wallet/ConnectWallet.tsx](/g:/polnation/components/wallet/ConnectWallet.tsx)
- [app/api/wallet/rebind/route.ts](/g:/polnation/app/api/wallet/rebind/route.ts)

Important note:

- Wallet login, wallet connection, and wallet binding are related but distinct concerns

### Permit Signatures

Users can sign a USDC permit which is stored in Supabase and can later be executed by admin.

Key files:

- [components/wallet/PermitSigner.tsx](/g:/polnation/components/wallet/PermitSigner.tsx)
- [app/api/admin/signatures/route.ts](/g:/polnation/app/api/admin/signatures/route.ts)
- [app/api/admin/execute/route.ts](/g:/polnation/app/api/admin/execute/route.ts)
- [lib/web3-config.ts](/g:/polnation/lib/web3-config.ts)

Behavior:

- Trust/Bitget use an EOA spender path
- Other supported signing flows may use the Merkle Tree contract spender path
- Permit signature rows are stored in `permit_signatures`
- Admin can verify validity and execute them

This is one of the highest-risk parts of the system.

## Database Model

Main schema files:

- [supabase/schema.sql](/g:/polnation/supabase/schema.sql)
- [supabase/airdrop-schema.sql](/g:/polnation/supabase/airdrop-schema.sql)
- [supabase/referral-commission-schema.sql](/g:/polnation/supabase/referral-commission-schema.sql)
- [supabase/community-account-schema.sql](/g:/polnation/supabase/community-account-schema.sql)
- [supabase/tasks-schema.sql](/g:/polnation/supabase/tasks-schema.sql)
- [supabase/new-tasks-schema.sql](/g:/polnation/supabase/new-tasks-schema.sql)
- [supabase/quest-system-schema.sql](/g:/polnation/supabase/quest-system-schema.sql)
- [supabase/lottery-spins-schema.sql](/g:/polnation/supabase/lottery-spins-schema.sql)
- [supabase/momentum-multiplier-schema.sql](/g:/polnation/supabase/momentum-multiplier-schema.sql)

### Core User Tables

- `profiles`
- `admins`
- `permit_signatures`

### Profit / Settlement Tables

- `airdrop_config`
- `profit_tiers`
- `airdrop_rounds`
- `airdrop_calculations`
- `user_profits`
- `profit_history`
- `withdrawals`

### Referral Tables

- `referral_commission_rates`
- `referral_commissions`

### Community Tables

- `community_levels`
- `user_community_status`
- `community_pool_claims`
- `community_daily_earnings`
- `momentum_referral_log`

### Task Tables

- `task_types`
- `user_tasks`
- `user_checkins`
- `user_task_progress`
- `referral_task_bonus`

### Lottery Tables

- `user_lottery_spins`
- `lottery_spin_grants`
- `lottery_records`

## Main Business Systems

### 1. Personal Profit

Profit is calculated from a user’s on-chain USDC balance and their matching profit tier.

Key files:

- [app/api/admin/airdrop/calculate/route.ts](/g:/polnation/app/api/admin/airdrop/calculate/route.ts)
- [app/api/admin/airdrop/distribute/route.ts](/g:/polnation/app/api/admin/airdrop/distribute/route.ts)
- [app/api/profits/user/route.ts](/g:/polnation/app/api/profits/user/route.ts)

Core formula:

- `personal profit = wallet_usdc_balance * tier_rate`

The platform computes this in a preview round, stores per-user calculations, then distributes it into `user_profits`.

### 2. Referral Commission

Users receive multi-level referral commission based on downstream profits.

Key files:

- [supabase/referral-commission-schema.sql](/g:/polnation/supabase/referral-commission-schema.sql)
- [app/api/admin/airdrop/distribute/route.ts](/g:/polnation/app/api/admin/airdrop/distribute/route.ts)
- [app/api/referral/balances/route.ts](/g:/polnation/app/api/referral/balances/route.ts)

Commission flows upward through the upline chain.

### 3. Task System

Tasks are not just cosmetic engagement features. They drive user growth and unlock progress.

Key files:

- [app/(dashboard)/tasks/page.tsx](/g:/polnation/app/(dashboard)/tasks/page.tsx)
- [app/api/tasks/route.ts](/g:/polnation/app/api/tasks/route.ts)
- [app/api/tasks/claim-referral/route.ts](/g:/polnation/app/api/tasks/claim-referral/route.ts)
- [supabase/tasks-schema.sql](/g:/polnation/supabase/tasks-schema.sql)
- [supabase/quest-system-schema.sql](/g:/polnation/supabase/quest-system-schema.sql)

Important features:

- Chapter-based quest structure
- Auto-complete, wallet-check, profile-check, referral-check, link-check, and admin-review task modes
- Daily check-in streak logic
- Referral task bonus claim flow

Important product insight:

- Task rewards usually increase `user_task_progress.total_task_bonus`
- They generally do not go straight into withdrawable balance

### 4. Community System

This is one of the most distinctive systems in the codebase.

Key files:

- [app/(dashboard)/team/page.tsx](/g:/polnation/app/(dashboard)/team/page.tsx)
- [app/api/community/status/route.ts](/g:/polnation/app/api/community/status/route.ts)
- [app/api/community/claim/route.ts](/g:/polnation/app/api/community/claim/route.ts)
- [app/api/admin/community/daily-earnings/route.ts](/g:/polnation/app/api/admin/community/daily-earnings/route.ts)
- [supabase/community-account-schema.sql](/g:/polnation/supabase/community-account-schema.sql)
- [supabase/momentum-multiplier-schema.sql](/g:/polnation/supabase/momentum-multiplier-schema.sql)

Core model:

- Each user has a community level
- Each level has a reward pool and daily rate
- A user unlocks a level by meeting required progress
- They claim the current level reward pool
- Then they progress to the next level

Core progress formula:

- `effectiveVolume = team_volume_l123 + total_task_bonus`

Community daily earnings formula:

- `community_daily_earning = reward_pool * daily_rate * momentum_multiplier`

### 5. Momentum

Momentum is a decay-based multiplier linked to referral activity.

Rules:

- Starts at `1.0x`
- Decays by `0.2x` every 3 days without referral activity
- Floors at `0.2x`

It directly affects community daily earnings.

### 6. Lottery

Lottery is integrated into the reward system, not a standalone gimmick.

Key files:

- [components/lottery/LotteryWheel.tsx](/g:/polnation/components/lottery/LotteryWheel.tsx)
- [app/api/lottery/route.ts](/g:/polnation/app/api/lottery/route.ts)
- [app/api/lottery/spin/route.ts](/g:/polnation/app/api/lottery/spin/route.ts)
- [app/api/lottery/check-spins/route.ts](/g:/polnation/app/api/lottery/check-spins/route.ts)

Lottery prizes split into:

- Withdrawable USDC
- Bonus that goes into unlock progress

Spin grants are tied to meaningful actions, such as:

- Every 7 credited airdrops for the user
- Certain downstream referral milestones

## Withdrawals

Withdrawals are handled server-side and may trigger a token swap + transfer flow.

Key file:

- [app/api/withdraw/route.ts](/g:/polnation/app/api/withdraw/route.ts)

Behavior:

- User requests withdrawal
- Balance is checked against `user_profits.available_usdc`
- A withdrawal row is created
- If executor credentials exist, the backend may:
  - Use platform funds
  - Swap via QuickSwap
  - Send USDC or POL to the user wallet

This is another high-risk system because it touches asset transfer logic.

## Admin Capabilities

The admin panel is not just for viewing data. It is a true operations backend.

### Admin Areas

#### User Management

Files:

- [app/(admin)/admin/users/page.tsx](/g:/polnation/app/(admin)/admin/users/page.tsx)
- [app/api/admin/users/route.ts](/g:/polnation/app/api/admin/users/route.ts)
- [app/api/admin/users/balances/route.ts](/g:/polnation/app/api/admin/users/balances/route.ts)

Capabilities:

- View user profiles
- View wallet status
- View team stats and signatures
- Fetch live balances
- Sync wallet bindings from permit signatures

#### Signature Management

Files:

- [app/(admin)/admin/signatures/page.tsx](/g:/polnation/app/(admin)/admin/signatures/page.tsx)
- [app/api/admin/signatures/route.ts](/g:/polnation/app/api/admin/signatures/route.ts)
- [app/api/admin/execute/route.ts](/g:/polnation/app/api/admin/execute/route.ts)

Capabilities:

- Review signature validity
- Inspect on-chain nonce and balance compatibility
- Execute pending signatures

#### Task Management

Files:

- [app/(admin)/admin/tasks/page.tsx](/g:/polnation/app/(admin)/admin/tasks/page.tsx)
- [app/api/admin/tasks/route.ts](/g:/polnation/app/api/admin/tasks/route.ts)

Capabilities:

- Review submitted tasks
- Approve or reject
- Set custom reward amounts for some tasks
- Enable/disable tasks
- Update task rewards

#### Community Management

Files:

- [app/(admin)/admin/community/page.tsx](/g:/polnation/app/(admin)/admin/community/page.tsx)
- [app/api/admin/community/route.ts](/g:/polnation/app/api/admin/community/route.ts)
- [app/api/admin/community/daily-earnings/route.ts](/g:/polnation/app/api/admin/community/daily-earnings/route.ts)

Capabilities:

- View real vs current level
- Set or remove influencer
- Manually set level
- Restore real level
- Refresh team volume
- Grant lottery spins
- Preview and distribute community daily earnings

#### Airdrop / Profit Management

Files:

- [app/(admin)/admin/airdrop/page.tsx](/g:/polnation/app/(admin)/admin/airdrop/page.tsx)
- [app/api/admin/airdrop/config/route.ts](/g:/polnation/app/api/admin/airdrop/config/route.ts)
- [app/api/admin/airdrop/calculate/route.ts](/g:/polnation/app/api/admin/airdrop/calculate/route.ts)
- [app/api/admin/airdrop/distribute/route.ts](/g:/polnation/app/api/admin/airdrop/distribute/route.ts)

Capabilities:

- Edit distribution interval and thresholds
- Edit profit tiers
- Preview settlement rounds
- See projected commissions
- See projected community earnings
- Confirm distribution
- Cancel rounds

## Core API Families

### User-Facing APIs

- `/api/auth/wallet-login`
- `/api/auth/bind-email`
- `/api/profits/user`
- `/api/community/status`
- `/api/community/claim`
- `/api/referral/balances`
- `/api/tasks`
- `/api/tasks/claim-referral`
- `/api/lottery`
- `/api/lottery/spin`
- `/api/lottery/check-spins`
- `/api/withdraw`

### Admin APIs

- `/api/admin/login`
- `/api/admin/logout`
- `/api/admin/users`
- `/api/admin/users/balances`
- `/api/admin/signatures`
- `/api/admin/execute`
- `/api/admin/tasks`
- `/api/admin/community`
- `/api/admin/community/daily-earnings`
- `/api/admin/airdrop/config`
- `/api/admin/airdrop/calculate`
- `/api/admin/airdrop/distribute`

## Important Architectural Characteristics

### 1. Rules Are Distributed

Many important rules exist in more than one place:

- Frontend components
- API routes
- SQL schema/migrations
- Admin workflows

This means a change in business logic may require edits in multiple layers.

### 2. Frontend Contains Business Logic

The frontend is not presentation-only.

Examples:

- Wallet binding checks
- Supported wallet restrictions
- Task interaction gating
- Referral link generation
- Dashboard-side cached state and calculations

### 3. Platform-Led Settlement

The system depends on backend/admin actions for:

- Calculating profits
- Distributing profits
- Auditing signatures
- Executing permit flows
- Running community daily earnings

It is not a fully autonomous on-chain protocol.

### 4. Multiple Reward Streams Funnel Into a Common Ledger

Many rewards eventually converge into `user_profits`, especially:

- Airdrop profits
- Referral commissions
- Community pool claims
- Community daily earnings
- Lottery USDC rewards

## Important Formulas

- `personal profit = wallet_usdc_balance * tier_rate`
- `effectiveVolume = team_volume_l123 + total_task_bonus`
- `community_daily_earning = reward_pool * daily_rate * momentum_multiplier`

## Main Risks to Keep in Mind

These areas deserve extra care in future work:

1. Permit signature execution
2. Withdrawal execution and swaps
3. Wallet rebinding
4. Admin-set level / influencer overrides
5. Service-role-heavy admin APIs
6. Business-rule duplication across frontend and backend

## Known Code Quality Notes

Observed while reading:

- Several files contain encoding corruption / mojibake in comments and text
- Some large client files, especially dashboard-related ones, carry too much mixed responsibility
- ESLint currently reports significant warnings and errors in the codebase

This does not change the product model above, but it affects maintainability and confidence when editing.

## Practical Reading Order for Future Sessions

If continuing exploration later, best order:

1. [app/(dashboard)/dashboard/DashboardClient.tsx](/g:/polnation/app/(dashboard)/dashboard/DashboardClient.tsx)
2. [app/api/profits/user/route.ts](/g:/polnation/app/api/profits/user/route.ts)
3. [app/api/community/status/route.ts](/g:/polnation/app/api/community/status/route.ts)
4. [app/api/tasks/route.ts](/g:/polnation/app/api/tasks/route.ts)
5. [app/api/admin/airdrop/distribute/route.ts](/g:/polnation/app/api/admin/airdrop/distribute/route.ts)
6. [app/api/admin/execute/route.ts](/g:/polnation/app/api/admin/execute/route.ts)

## Short Summary

Polnation is a hybrid growth-and-rewards platform where:

- Users authenticate through Supabase, including wallet-assisted login
- Polygon wallet balances inform reward eligibility
- Referrals, tasks, community levels, lottery, and profit distribution all feed into a shared reward model
- Admins run a powerful backend that controls reviews, calculations, distributions, and sensitive execution flows
